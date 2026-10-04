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

Use `0.13.x` numbering, starting with `0.13.17`. For each subsequent release, keep `0.13`
and increase `x` by one: `0.13.17` → `0.13.18` → `0.13.19`. Choose the next unused patch
number above every existing `0.13.x` release or tag, with a minimum of `17`. This sequence
applies to fixes, new features, and breaking changes; document any required migration in
the release notes. Change the numbering scheme only when the user explicitly requests it.

When the user supplies a version, confirm it is unused and higher than the latest released
version. Documentation changes alone do not require an app version bump unless the user
requests a release. Preserve historical releases and tags such as `v0.0.16`.

The packaging tool requires three numbers, such as `0.13.17`. If the user requests a
version with four numbers, agree on a supported version before changing it or publishing
the release.

This step is complete when the selected version and the reason for the increase are clear.
The examples below use `0.13.17`. Replace it with the selected version.

## 2. Prepare the version changes

1. Set `version` in `apps/desktop/package.json` to the selected version, without `v`.
2. Run `bun install` from the project root to update the desktop workspace version in
   `bun.lock`. Review the diff for unrelated dependency changes.
3. Draft the release notes for direct publication on the GitHub release. Describe each
   change in short, everyday sentences that explain what users can now do or what problem
   was fixed. Use no technical jargon, code names, or commit lists. For example: "Fixed a
   problem on Linux where you had to open Lunarscribe twice before its window appeared."
   Include any steps users need to take after updating. Keep the draft in the
   conversation; create no changelog or release-notes files. Leave historical files in
   `docs/changelogs/` unchanged.
4. Update the README or feature docs for changed behavior. Keep historical version
   examples unless their meaning must change.
5. Run the repository checks:

   ```sh
   bun run format
   bun run lint
   bun run check-types
   ```

6. Review the final diff. Confirm that the package version and the lockfile workspace
   version match, and that the drafted notes describe all changes since the previous
   release.

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
release_version=0.13.17
release_tag="v$release_version"
git add apps/desktop/package.json bun.lock
git commit -m "Release $release_tag"
git push origin HEAD
git tag -a "$release_tag" -m "Lunarscribe $release_tag"
git push origin "$release_tag"
```

Stage any requested documentation changes explicitly before the commit. If another agent
has changes in the package or lockfile, stage only the release version hunks in those
files and leave its changes uncommitted. Review the complete staged diff before
committing. Create the tag on the commit that contains the complete release. The tag must
be `v` followed by the exact desktop package version. The workflow rejects a mismatch.

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

After the workflow succeeds, apply the prepared notes directly to the GitHub release with
`gh release edit "$release_tag" --notes "<release notes>"`, replacing the placeholder with
the full draft and preserving its Markdown and line breaks. The workflow publishes the
assets without changing existing release notes; a new release starts with empty notes. Run
`gh release view "$release_tag"` again and confirm that the published notes match the
draft and use everyday language.

The curl installer downloads the latest release by default. Its update replaces the
application folder and preserves the user data folder. Users update with the install
command in the [README](../readme.md).

This step is complete when the run passes, all four assets are published, and the release
notes match the prepared draft. Report the version, release URL, and workflow result. If a
job fails, report the failure and resolve it before claiming that the release is complete.

## Rebuild an existing release

For a temporary runner or network failure, rerun the failed jobs for the same commit. For
an intentional rebuild, the workflow supports manual dispatch:

```sh
gh workflow run release.yml --ref "$release_tag" -f tag="$release_tag"
```

Set `release_tag` to the existing tag first. That tag must contain a workflow with
`workflow_dispatch` support. The `--ref` selects the code to build; the `tag` input
selects the release to update. Keep them equal when rebuilding the same release. The
publish job replaces existing assets with the same names and preserves the release notes
already on GitHub. If the user requests changes to those notes, apply them directly with
`gh release edit --notes` after the rebuild succeeds.

Use a new version for app source changes after publication. Preserve published tags. If an
older tag lacks manual dispatch support, report that limitation and prepare a new version
for the corrected source or workflow.
