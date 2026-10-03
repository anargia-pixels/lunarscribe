# Release guide for agents

Use this guide when the user requests a new Lunarscribe version or a release. Write the
version changes locally. GitHub Actions builds the release packages and publishes them
after the version tag is pushed. A push to `main` alone does not start a release.

## 1. Select the version

Read [AGENTS.md](../AGENTS.md), [GLOSSARY.md](../GLOSSARY.md), the
[desktop package](../apps/desktop/package.json), and the
[release workflow](../.github/workflows/release.yml). Check `git status` and preserve
unrelated changes. Fetch tags and list the released versions:

```sh
git fetch origin --tags
git tag --list 'v*' --sort=-version:refname
```

Compare the changes since the latest release. Use the user's requested version when one is
given. Otherwise, select the next version with these rules:

| Change                                                      | Version change                                                                         | Example             |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------- |
| Fixes without new features or breaking changes              | Increase the patch number.                                                             | `0.0.13` → `0.0.14` |
| New features that preserve existing behavior and saved data | Increase the minor number and reset the patch number.                                  | `0.0.13` → `0.1.0`  |
| Breaking changes while the major number is `0`              | Increase the minor number and reset the patch number. Document the required migration. | `0.1.4` → `0.2.0`   |
| First stable release, when requested by the user            | Set the version to `1.0.0`.                                                            | `0.9.4` → `1.0.0`   |
| Breaking changes after `1.0.0`                              | Increase the major number and reset the minor and patch numbers.                       | `1.2.4` → `2.0.0`   |

If a release has several types of changes, use the largest required increase.
Documentation changes alone do not require an app version bump unless the user requests a
release. Use an unused version that is higher than the latest released version.

This step is complete when the selected version and the reason for the increase are clear.
The examples below use `0.0.14` for a patch release. Replace it with the selected version.

## 2. Prepare the version changes

1. Set `version` in `apps/desktop/package.json` to the selected version, without `v`.
2. Run `bun install` from the project root to update the desktop workspace version in
   `bun.lock`. Review the diff for unrelated dependency changes.
3. Update the README or feature docs for changed behavior. Keep historical version
   examples unless their meaning must change.
4. Run the repository checks:

   ```sh
   bun run format
   bun run lint
   bun run check-types
   ```

5. Review the final diff. Confirm that the package version and the lockfile workspace
   version match.

The app release version belongs to `apps/desktop/package.json`. The root catalog stores
dependency versions. Shared package versions do not need to change for an app release.

GitHub Actions runs the checks again, builds the project, and packages Linux x86_64 and
macOS Apple Silicon. Use this automated build for a release. A local package build is only
needed when the user requests it or when diagnosing a packaging failure.

This step is complete when the version changes are ready for review and all local checks
pass. If commit or push approval is needed under `AGENTS.md`, request it now. Use existing
user authorization when it covers these actions.

## 3. Commit and push the release tag

Commit on the current branch. Include the intended release changes and exclude unrelated
user changes. If the app changes are already committed, the version commit can use:

```sh
release_version=0.0.14
release_tag="v$release_version"
git add apps/desktop/package.json bun.lock
git commit -m "Release $release_tag"
git push origin HEAD
git tag -a "$release_tag" -m "Lunarscribe $release_tag"
git push origin "$release_tag"
```

Stage any requested documentation changes explicitly before the commit. Create the tag on
the commit that contains the complete release. The tag must be `v` followed by the exact
desktop package version. The workflow rejects a mismatch.

This step is complete when the release commit and its tag are on GitHub and the Release
workflow has started.

## 4. Verify publication

Find the run for the pushed tag:

```sh
gh run list --workflow release.yml --branch "$release_tag" --limit 5
```

Use its run ID to monitor it:

```sh
gh run watch RUN_ID --exit-status
gh release view "$release_tag"
```

Replace `RUN_ID` with the selected run ID. Confirm that both build jobs and the publish
job pass. Confirm that the release contains:

- `lunarscribe-linux-x64.zip`
- `lunarscribe-macos-arm64.dmg`
- `sha256sums.txt`
- `install.sh`

The workflow uploads these files and generates release notes for a new release. The curl
installer downloads the latest release by default. Its update replaces the application
folder and preserves the user data folder. Users update with the install command in the
[README](../readme.md).

This step is complete when the run passes and all four assets are published. Report the
version, release URL, and workflow result. If a job fails, report the failure and resolve
it before claiming that the release is complete.

## Rebuild an existing release

For a temporary runner or network failure, rerun the failed jobs for the same commit. For
an intentional rebuild, the workflow supports manual dispatch:

```sh
gh workflow run release.yml --ref "$release_tag" -f tag="$release_tag"
```

Set `release_tag` to the existing tag first. That tag must contain a workflow with
`workflow_dispatch` support. The `--ref` selects the code to build; the `tag` input
selects the release to update. Keep them equal when rebuilding the same release. The
publish job replaces existing assets with the same names.

Use a new version for app source changes after publication. Preserve published tags. If an
older tag lacks manual dispatch support, report that limitation and prepare a new version
for the corrected source or workflow.
