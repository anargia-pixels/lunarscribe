import { execFile } from "node:child_process";
import { lstat, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { promisify } from "node:util";

import type { createOperationQueue } from "@lunarscribe/utils/operation-queue";
import { SyncSignInRequired } from "@lunarscribe/utils/sync/types";

import type {
  SyncConflict,
  SyncResult,
  SyncedFileChange,
} from "../../../lib/sync";
import { getFileChanges, isSavedFileName, readLocalSyncFiles } from "../files";
import type { LocalSyncFiles } from "../files";

// Git commands
type GitCommand = (...args: string[]) => Promise<string>;

type MergeCheck = { tree: string | null; conflicts: SyncConflict[] };

// Command settings
const execute = promisify(execFile);

const REPOSITORY_NAME = "lunarscribe-bak-files";

/** Keep CLI commands noninteractive and limit their runtime and output. */
async function command(
  binary: string,
  args: string[],
  cwd: string,
  environment = process.env,
) {
  const { stdout } = await execute(binary, args, {
    cwd,
    timeout: 60_000,
    maxBuffer: 32 * 1024 * 1024,
    env: {
      ...environment,
      PATH: [
        // Include executables omitted by app launchers.
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

  return stdout.trimEnd();
}

/** Disable hooks and use gh for credentials without changing global settings. */
function createGitCommand(
  folder: string,
  account: string,
  indexPath?: string,
): GitCommand {
  if (!/^[a-zA-Z0-9-]+$/u.test(account)) {
    throw new Error(
      "Stored GitHub account is invalid. Disconnect and reconnect.",
    );
  }

  const configuration = {
    "core.hooksPath": "/dev/null",
    "core.autocrlf": "false",
    "commit.gpgSign": "false",
    "user.name": "Lunarscribe",
    "user.email": `${account}@users.noreply.github.com`,
    "credential.helper": "",
    "credential.https://github.com.helper": "!gh auth git-credential",
  };

  const flags = Object.entries(configuration).flatMap(([key, value]) => [
    "-c",
    `${key}=${value}`,
  ]);

  const environment = { ...process.env };

  if (indexPath) {
    environment["GIT_INDEX_FILE"] = indexPath;
  }

  return (...args) => command("git", [...flags, ...args], folder, environment);
}

/** Check visibility again before each push to prevent public backups. */
async function requirePrivateRepository(folder: string, account: string) {
  const visibility = await command(
    "gh",
    [
      "repo",
      "view",
      `${account}/${REPOSITORY_NAME}`,
      "--json",
      "isPrivate",
      "--jq",
      ".isPrivate",
    ],
    folder,
  );

  if (visibility !== "true") {
    throw new Error("lunarscribe-bak-files must be private before syncing.");
  }
}

// Repository connection
/** Initialize history in Documents without adopting a different remote. */
async function initializeRepository(
  folder: string,
  account: string,
  git: GitCommand,
) {
  try {
    if (!(await lstat(join(folder, ".git"))).isDirectory()) {
      throw new Error(
        "GitHub sync requires a regular .git directory in the Lunarscribe documents folder.",
      );
    }
  } catch (cause) {
    if (!(cause instanceof Error && "code" in cause && cause.code === "ENOENT"))
      throw cause;

    await git("init", "-b", "main");
  }

  const remoteUrl = `https://github.com/${account}/${REPOSITORY_NAME}.git`;

  if ((await git("remote")).split("\n").includes("origin")) {
    if (
      (await git("remote", "get-url", "origin")) !== remoteUrl ||
      (await git("remote", "get-url", "--push", "origin")) !== remoteUrl
    ) {
      throw new Error(
        "The documents folder already uses a different Git origin. Resolve it before connecting GitHub sync.",
      );
    }
  } else {
    await git("remote", "add", "origin", remoteUrl);
  }

  await mkdir(join(folder, ".git", "info"), { recursive: true });
  // Drawing scenes must keep both versions when both devices change them.
  await writeFile(
    join(folder, ".git", "info", "attributes"),
    "* merge=text -filter -text\n*.[dD][rR][aA][wW] -merge -filter -text\n",
  );
}

/** Connect gh's account to a private backup and initialize local Git history. */
export async function connectGithub(
  folder: string,
  queue: ReturnType<typeof createOperationQueue>,
) {
  await mkdir(folder, { recursive: true });
  let version: string;

  try {
    version = await command("git", ["--version"], folder);
    await command("gh", ["--version"], folder);
    await command("gh", ["auth", "status", "--hostname", "github.com"], folder);
  } catch {
    throw new Error(
      "Install git and gh, then sign in with gh auth login before connecting GitHub.",
    );
  }

  const match = /git version (\d+)\.(\d+)/u.exec(version);

  if (
    !match ||
    Number(match[1]) < 2 ||
    (Number(match[1]) === 2 && Number(match[2]) < 38)
  ) {
    throw new Error(
      "GitHub sync requires Git 2.38 or newer for safe merge checks.",
    );
  }

  const account = await command(
    "gh",
    ["api", "user", "--jq", ".login"],
    folder,
  );

  const repository = account + "/" + REPOSITORY_NAME;

  const repositories = await command(
    "gh",
    [
      "api",
      "user/repos?per_page=100&affiliation=owner",
      "--paginate",
      "--jq",
      ".[].full_name",
    ],
    folder,
  );

  if (!repositories.split("\n").includes(repository)) {
    await command("gh", ["repo", "create", repository, "--private"], folder);
  }

  await requirePrivateRepository(folder, account);
  await queue(folder, () =>
    initializeRepository(folder, account, createGitCommand(folder, account)),
  );

  return account;
}

/** Remove only Git history; keep saved writing and the remote backup. */
export async function disconnectGithub(folder: string) {
  await rm(join(folder, ".git"), { recursive: true, force: true });
}

// Saved-file commits
/** Reject symlinks, nested paths, and files outside the saved-writing scope. */
async function validateTree(git: GitCommand, tree: string) {
  for (const entry of (await git("ls-tree", "-r", "-z", tree)).split("\0")) {
    if (!entry) continue;

    const name = entry.slice(entry.indexOf("\t") + 1);

    if (!/^100(?:644|755) blob /u.test(entry) || !isSavedFileName(name)) {
      throw new Error(
        `GitHub contains an unsupported path ${JSON.stringify(name)}. Keep only saved markdown and drawings in the backup repository.`,
      );
    }
  }
}

/** An empty repository has no HEAD until its first saved-file commit. */
async function getHead(git: GitCommand) {
  try {
    return await git("rev-parse", "--verify", "--quiet", "HEAD");
  } catch (cause) {
    if (cause instanceof Error && "code" in cause && cause.code === 1)
      return null;

    throw cause;
  }
}

/** Stage supported saved files and deletions; a shortcut stages one name. */
async function commitSavedFiles(
  git: GitCommand,
  local: LocalSyncFiles,
  name: string | null,
) {
  const previous = await getHead(git);

  if (previous) await validateTree(git, previous);

  const tracked = (await git("ls-files", "-z")).split("\0").filter(Boolean);

  const names =
    name === null
      ? new Set([...tracked, ...local.files.keys()])
      : new Set(
          [name].filter(
            (candidate) =>
              local.files.has(candidate) || tracked.includes(candidate),
          ),
        );

  for (const candidate of names) {
    if (!isSavedFileName(candidate) || local.blockedNames.has(candidate)) {
      throw new Error(
        `GitHub cannot sync the path ${JSON.stringify(candidate)}. Saved writing must be a regular file directly inside the documents folder.`,
      );
    }
  }

  const staged = (await git("diff", "--cached", "--name-only", "-z"))
    .split("\0")
    .filter(Boolean);

  if (staged.some((candidate) => !names.has(candidate))) {
    throw new Error(
      "GitHub sync found other staged changes. Commit or unstage them before syncing this selection.",
    );
  }

  const paths = [...names];

  for (let offset = 0; offset < paths.length; offset += 200) {
    await git(
      "--literal-pathspecs",
      "add",
      "--force",
      "--all",
      "--",
      ...paths.slice(offset, offset + 200),
    );
  }

  if (
    (await git("diff", "--cached", "--name-only", "-z")) ||
    previous === null
  ) {
    await git("commit", "--allow-empty", "-m", "Sync Lunarscribe files");
  }

  return git("rev-parse", "HEAD");
}

// Incoming merge
/** Exit 1 means conflicts; other command failures must stop synchronization. */
async function checkMerge(
  git: GitCommand,
  branch: string,
): Promise<MergeCheck> {
  try {
    const output = await git(
      "merge-tree",
      "--write-tree",
      "--allow-unrelated-histories",
      "--no-messages",
      "--name-only",
      "-z",
      "HEAD",
      `origin/${branch}`,
    );

    return { tree: output.split("\0")[0]!.trim(), conflicts: [] };
  } catch (cause) {
    if (
      cause instanceof Error &&
      "code" in cause &&
      cause.code === 1 &&
      "stdout" in cause &&
      cause.stdout === String(cause.stdout)
    ) {
      const names = String(cause.stdout).split("\0").slice(1).filter(Boolean);

      if (names.length) {
        return {
          tree: null,
          conflicts: names.map((name) => ({
            name,
            reason:
              "Git found a merge conflict. Local and remote copies were preserved without adding conflict markers.",
          })),
        };
      }

      throw new Error(
        "GitHub found a merge conflict. Local and remote writing were preserved; resolve the conflict before retrying.",
      );
    }

    throw new Error(
      "GitHub could not check the merge. Check your Git installation and retry; saved writing was preserved.",
    );
  }
}

/** Read raw names so spaces and newlines cannot change the selected paths. */
async function changedNames(
  git: GitCommand,
  before: string | null,
  after: string,
) {
  const output =
    before === null
      ? await git("ls-tree", "--name-only", "-z", after)
      : await git("diff", "--no-renames", "--name-only", "-z", before, after);

  return output.split("\0").filter(Boolean);
}

/** Apply the checked tree directly; never check out a conflicted merge. */
async function applyMerge(
  git: GitCommand,
  tree: string,
  local: string,
  remote: string,
) {
  const canFastForward =
    (await git("rev-list", "--count", `${remote}..${local}`)) === "0";

  const revision = canFastForward
    ? remote
    : await git(
        "commit-tree",
        tree,
        "-p",
        local,
        "-p",
        remote,
        "-m",
        "Merge synced Lunarscribe files",
      );

  await git("read-tree", "-m", "-u", local, tree);
  await git(
    "update-ref",
    "-m",
    "Merge synced Lunarscribe files",
    "HEAD",
    revision,
    local,
  );

  return revision;
}

// Synchronization
/** Fetch the backup branch after checking the account and repository access. */
async function fetchGithubRemote(
  folder: string,
  account: string,
  git: GitCommand,
) {
  if (
    (await command("gh", ["api", "user", "--jq", ".login"], folder)) !== account
  ) {
    throw new SyncSignInRequired(
      `Use gh auth switch to sign in as ${account}, then retry GitHub sync.`,
    );
  }

  await requirePrivateRepository(folder, account);

  const heads = await git("ls-remote", "--symref", "origin", "HEAD");
  const branch = /ref: refs\/heads\/(\S+)\s+HEAD/u.exec(heads)?.[1] ?? "main";
  let remote: string | null = null;

  if (heads) {
    await git(
      "fetch",
      "--no-tags",
      "origin",
      `+refs/heads/${branch}:refs/remotes/origin/${branch}`,
    );
    remote = await git("rev-parse", `origin/${branch}`);
  }

  return { branch, remote };
}

/** Replace one remote file without changing other files or local Git history. */
export async function forceWriteGithub(
  folder: string,
  account: string,
  name: string,
  content: string,
  queue: ReturnType<typeof createOperationQueue>,
) {
  const temporary = await mkdtemp(join(tmpdir(), "lunarscribe-force-"));

  try {
    const git = createGitCommand(folder, account, join(temporary, "index"));
    await queue(folder, () => initializeRepository(folder, account, git));
    const path = join(temporary, "content");
    await writeFile(path, content, { mode: 0o600 });
    const blob = await git("hash-object", "-w", "--no-filters", "--", path);

    // Rebuild from the latest remote tree if another device wins the push.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { branch, remote } = await fetchGithubRemote(folder, account, git);
      await git("read-tree", remote ?? "--empty");
      await git("update-index", "--add", "--cacheinfo", "100644", blob, name);
      const tree = await git("write-tree");

      const parents = remote ? ["-p", remote] : [];

      const revision = await git(
        "commit-tree",
        tree,
        ...parents,
        "-m",
        "Force selected Lunarscribe file to remote",
      );

      await requirePrivateRepository(folder, account);

      try {
        await git("push", "origin", `${revision}:refs/heads/${branch}`);
      } catch {
        if (attempt < 2) continue;

        throw new Error(
          "GitHub could not replace the remote copy. Check your connection and repository access, then retry.",
        );
      }

      if (remote === null) {
        await command(
          "gh",
          [
            "repo",
            "edit",
            `${account}/${REPOSITORY_NAME}`,
            "--default-branch",
            branch,
          ],
          folder,
        );
      }

      return;
    }
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

/** Fetch outside the save queue; commit and merge inside it; then push. */
export async function syncGithub(
  folder: string,
  account: string,
  name: string | null,
  queue: ReturnType<typeof createOperationQueue>,
  getProtectedNames: () => Set<string>,
  onApplied: (changes: SyncedFileChange[]) => void,
): Promise<SyncResult> {
  const git = createGitCommand(folder, account);
  await queue(folder, () => initializeRepository(folder, account, git));

  const { branch, remote } = await fetchGithubRemote(folder, account, git);

  if (remote) {
    await validateTree(git, remote);
  }

  // Commit and merge: local saves cannot run between the snapshot and checkout.
  const prepared = await queue(folder, async () => {
    const before = await readLocalSyncFiles(folder);
    let revision = await commitSavedFiles(git, before, name);
    let pulled = 0;

    if (remote && remote !== revision) {
      const checked = await checkMerge(git, branch);

      if (checked.tree === null) {
        return { revision, conflicts: checked.conflicts, pushed: 0, pulled: 0 };
      }

      await validateTree(git, checked.tree);

      const incoming = await changedNames(git, revision, checked.tree);
      const conflicts: SyncConflict[] = [];

      for (const incomingName of incoming) {
        if (
          name !== null ||
          getProtectedNames().has(incomingName) ||
          before.blockedNames.has(incomingName)
        ) {
          conflicts.push({
            name: incomingName,
            reason:
              name === null
                ? "An open buffer has pending edits or this path is not a regular file. Preserve your edits before syncing."
                : "GitHub has incoming changes. Run Sync now before pushing this file.",
          });
        }
      }

      if (conflicts.length)
        return { revision, conflicts, pushed: 0, pulled: 0 };

      if (
        (await git("rev-list", "--count", `${revision}..${remote}`)) !== "0"
      ) {
        try {
          revision = await applyMerge(git, checked.tree, revision, remote);
        } finally {
          // Refresh buffers even if a later Git operation fails.
          onApplied(
            getFileChanges(
              before.files,
              (await readLocalSyncFiles(folder)).files,
            ),
          );
        }
      }

      pulled = incoming.length;
    }

    const pushed = await changedNames(git, remote, revision);

    if (name !== null && pushed.some((candidate) => candidate !== name)) {
      return {
        revision,
        pushed: 0,
        pulled: 0,
        conflicts: [
          {
            name,
            reason:
              "Other saved files are pending in GitHub history. Run Sync now to publish them together.",
          },
        ],
      };
    }

    return { revision, conflicts: [], pushed: pushed.length, pulled };
  });

  // Push: keep normal fast-forward checks if another device updates GitHub.
  if (prepared.conflicts.length === 0) {
    await requirePrivateRepository(folder, account);

    try {
      await git("push", "origin", `${prepared.revision}:refs/heads/${branch}`);
    } catch {
      throw new Error(
        "GitHub could not accept the sync. Another device may have changed the repository, or the connection failed. Your local writing is safe; retry sync.",
      );
    }

    if (remote === null) {
      await command(
        "gh",
        [
          "repo",
          "edit",
          `${account}/${REPOSITORY_NAME}`,
          "--default-branch",
          "main",
        ],
        folder,
      );
    }
  }

  return {
    conflicts: prepared.conflicts,
    pushed: prepared.pushed,
    pulled: prepared.pulled,
  };
}
