#!/usr/bin/env bash
# Publishes one built asset to the GitHub release for $RELEASE_TAG as soon as its job
# finishes, so one platform's release does not wait on, or fail with, another's build.
# Usage: publish-asset.sh <asset-path>
# Needs GH_TOKEN, GITHUB_REPOSITORY and RELEASE_TAG in the environment.
set -euo pipefail

asset=$1

# The first job to finish creates the release. Two jobs can race here, so a failed
# create is fine as long as the release exists afterwards.
if ! gh release view "$RELEASE_TAG" >/dev/null 2>&1; then
  gh release create "$RELEASE_TAG" --verify-tag \
    --title "Lunarscribe $RELEASE_TAG" --notes "" ||
    gh release view "$RELEASE_TAG" >/dev/null
fi

gh release upload "$RELEASE_TAG" "$asset" install.sh --clobber

# Older releases shipped an AppImage; rebuilding one removes it before the checksums are listed.
old_asset=$(gh release view "$RELEASE_TAG" --json assets \
  --jq '.assets[] | select(.name == "lunarscribe-linux-x86_64.AppImage") | .name')

if [ -n "$old_asset" ]; then
  gh release delete-asset "$RELEASE_TAG" "$old_asset" --yes
fi

# install.sh verifies downloads against sha256sums.txt, so it must list every app asset
# on the release. GitHub records each asset's SHA-256, so the list is rebuilt from the
# release itself; whichever job writes it last, it covers what other jobs uploaded.
list_checksums() {
  gh api "repos/$GITHUB_REPOSITORY/releases/tags/$RELEASE_TAG" --jq '
    .assets[]
    | select(.name | startswith("lunarscribe-"))
    | "\(.digest // "missing" | sub("^sha256:"; ""))  \(.name)"' | sort -k2
}

for attempt in 1 2 3 4 5; do
  list_checksums >sha256sums.txt

  # GitHub fills in a new asset's digest shortly after the upload.
  if ! grep -q '^missing ' sha256sums.txt; then
    gh release upload "$RELEASE_TAG" sha256sums.txt --clobber
    sleep 5

    # Another job may have uploaded its asset while this one wrote the list.
    if [ "$(list_checksums)" = "$(cat sha256sums.txt)" ]; then
      break
    fi
  fi

  if [ "$attempt" = 5 ]; then
    echo "Could not write a stable sha256sums.txt; rerun this job." >&2
    exit 1
  fi

  sleep 5
done
