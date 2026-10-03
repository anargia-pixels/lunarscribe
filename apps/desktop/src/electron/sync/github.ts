import { execFile } from "node:child_process";
import { lstat, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";
import { promisify } from "node:util";

import { getFileExtension } from "../../lib/editor-files";
import type { FileSyncProvider, RemoteFiles } from "./provider";
import { SyncSignInRequired } from "./provider";

const execute = promisify(execFile);

const REPOSITORY_NAME = "lunarscribe-bak-files";

async function command(binary: string, args: string[], cwd: string) {
  const result = await execute(binary, args, {
    cwd,
    timeout: 60_000,
    maxBuffer: 32 * 1024 * 1024,
    env: {
      ...process.env,
      // App launchers can omit Homebrew and user executable paths.
      PATH: [
        process.env["PATH"] ?? "/usr/bin:/bin",
        "/opt/homebrew/bin",
        "/usr/local/bin",
        join(homedir(), ".local/bin"),
        join(homedir(), ".linuxbrew/bin"),
      ].join(delimiter),
      GIT_TERMINAL_PROMPT: "0",
      GH_PROMPT_DISABLED: "1",
    },
  });

  return result.stdout.trim();
}

/** Checks prerequisites and checks the authenticated user's repository before creating it. */
export async function connectGithub(cache: string) {
  await mkdir(cache, { recursive: true });

  try {
    await command("git", ["--version"], cache);
    await command("gh", ["--version"], cache);
    await command("gh", ["auth", "status", "--hostname", "github.com"], cache);
  } catch {
    throw new Error(
      "Install git and gh, then sign in with gh auth login before connecting GitHub.",
    );
  }

  const account = await command("gh", ["api", "user", "--jq", ".login"], cache);
  const repository = `${account}/${REPOSITORY_NAME}`;

  // Listing also distinguishes a missing repository from authentication or network failure.
  const repositories = await command(
    "gh",
    [
      "api",
      "user/repos?per_page=100&affiliation=owner",
      "--paginate",
      "--jq",
      ".[].full_name",
    ],
    cache,
  );

  if (!repositories.split("\n").includes(repository)) {
    await command("gh", ["repo", "create", repository, "--private"], cache);
  }

  const visibility = await command(
    "gh",
    ["repo", "view", repository, "--json", "isPrivate", "--jq", ".isPrivate"],
    cache,
  );

  if (visibility !== "true") {
    throw new Error(
      "lunarscribe-bak-files must be private. Make the existing repository private before connecting.",
    );
  }

  return account;
}

/** A disposable checkout is rebuilt from the remote; git never merges writing. */
export function createGithubProvider(
  cache: string,
  account: string,
): FileSyncProvider {
  if (!/^[a-zA-Z0-9-]+$/u.test(account)) {
    throw new Error(
      "Stored GitHub account is invalid. Disconnect and reconnect.",
    );
  }

  const checkout = join(cache, account);
  const repository = `${account}/${REPOSITORY_NAME}`;
  let branch = "master";

  const git = (args: string[]) =>
    command(
      "git",
      [
        "-c",
        "core.hooksPath=/dev/null",
        "-c",
        "core.autocrlf=false",
        "-c",
        "commit.gpgSign=false",
        ...args,
      ],
      checkout,
    );

  // Authenticate HTTPS through gh without persisting credentials or changing global git config.
  const authenticatedGit = (args: string[]) =>
    git([
      "-c",
      "credential.helper=",
      "-c",
      "credential.https://github.com.helper=!gh auth git-credential",
      ...args,
    ]);

  return {
    async read() {
      const currentAccount = await command(
        "gh",
        ["api", "user", "--jq", ".login"],
        cache,
      );

      if (currentAccount !== account) {
        throw new SyncSignInRequired(
          `GitHub CLI is signed in as a different account. Use gh auth switch to sign in as ${account}, then retry sync.`,
        );
      }

      await rm(checkout, { recursive: true, force: true });
      await mkdir(checkout, { recursive: true });
      await git(["init", "-b", "master"]);
      await git([
        "remote",
        "add",
        "origin",
        `https://github.com/${repository}.git`,
      ]);

      const heads = await authenticatedGit([
        "ls-remote",
        "--symref",
        "origin",
        "HEAD",
      ]);

      const match = /ref: refs\/heads\/(\S+)\s+HEAD/u.exec(heads);
      branch = match?.[1] ?? "master";
      const files: RemoteFiles = new Map();

      if (heads) {
        await authenticatedGit(["fetch", "--depth=1", "origin", branch]);
        await git(["checkout", "-B", branch, "FETCH_HEAD"]);
        const revision = await git(["rev-parse", "HEAD"]);
        const tree = await git(["ls-tree", "-z", "HEAD"]);

        for (const entry of tree.split("\0")) {
          const separator = entry.indexOf("\t");
          const name = entry.slice(separator + 1);

          // Never follow remote symlinks or treat folders as saved files.
          if (/^100(?:644|755) blob /u.test(entry) && getFileExtension(name)) {
            files.set(name, {
              content: await readFile(join(checkout, name), "utf8"),
              revision,
            });
          } else if (getFileExtension(name)) {
            files.set(name, { content: "", revision, blocked: true });
          }
        }
      }

      return files;
    },
    async write(changes) {
      if (changes.length === 0) {
        return;
      }

      // Recheck visibility so a repository made public cannot receive another backup.
      const visibility = await command(
        "gh",
        [
          "repo",
          "view",
          repository,
          "--json",
          "isPrivate",
          "--jq",
          ".isPrivate",
        ],
        cache,
      );

      if (visibility !== "true") {
        throw new Error(
          "GitHub sync stopped because the backup repository is no longer private.",
        );
      }

      for (const change of changes) {
        try {
          if (!(await lstat(join(checkout, change.name))).isFile()) {
            throw new Error(
              `The repository path ${change.name} is not a regular file. Resolve this path before syncing.`,
            );
          }
        } catch (cause) {
          if (
            !(
              cause instanceof Error &&
              "code" in cause &&
              cause.code === "ENOENT"
            )
          ) {
            throw cause;
          }
        }

        if (change.content === null) {
          await rm(join(checkout, change.name), { force: true });
        } else {
          await writeFile(join(checkout, change.name), change.content);
        }

        await git(["--literal-pathspecs", "add", "--", change.name]);
      }

      await git([
        "-c",
        "user.name=Lunarscribe",
        "-c",
        `user.email=${account}@users.noreply.github.com`,
        "commit",
        "-m",
        "Sync Lunarscribe files",
      ]);

      try {
        // Normal pushes reject concurrent changes. Never force push or merge.
        await authenticatedGit(["push", "origin", `HEAD:refs/heads/${branch}`]);
      } catch {
        throw new Error(
          "GitHub could not accept the sync. Another device may have changed the repository, or the connection failed. Your local writing is safe; retry sync.",
        );
      }
    },
  };
}
