#!/usr/bin/env bash
# Install the release for this operating system and architecture.
set -euo pipefail

REPO="anargia-pixels/lunarscribe"
TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
VERSION="${LUNARSCRIBE_VERSION:-latest}"
TMP_DIR=""
MOUNT_PATH=""
STAGE_DIR=""
APP_PATH=""

fail() {
  echo "error: $*" >&2
  exit 1
}

cleanup() {
  if [[ -n "$MOUNT_PATH" ]]; then
    hdiutil detach "$MOUNT_PATH" -quiet || true
  fi
  if [[ -n "$STAGE_DIR" ]]; then
    if [[ -d "$STAGE_DIR/previous.app" && ! -e "$APP_PATH" ]]; then
      mv "$STAGE_DIR/previous.app" "$APP_PATH"
    fi
    rm -rf "$STAGE_DIR"
  fi
  if [[ -n "$TMP_DIR" ]]; then
    rm -rf "$TMP_DIR"
  fi
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

for command in curl jq; do
  command -v "$command" >/dev/null || fail "Install $command before running this installer."
done

case "$(uname -s)" in
  Linux)
    [[ "$(uname -m)" == "x86_64" ]] || fail "The Linux release requires x86_64."
    ASSET="lunarscribe-linux-x86_64.AppImage"
    INSTALL_DIR="${LUNARSCRIBE_INSTALL_DIR:-$HOME/.local/bin}"
    command -v sha256sum >/dev/null || fail "Install sha256sum before running this installer."
    ;;
  Darwin)
    case "$(uname -m)" in
      x86_64) ARCH="x64" ;;
      arm64) ARCH="arm64" ;;
      *) fail "Unsupported macOS architecture: $(uname -m)" ;;
    esac
    ASSET="lunarscribe-macos-${ARCH}.dmg"
    INSTALL_DIR="${LUNARSCRIBE_INSTALL_DIR:-$HOME/Applications}"
    for command in hdiutil ditto shasum; do
      command -v "$command" >/dev/null || fail "Required command not found: $command"
    done
    ;;
  *) fail "Lunarscribe supports Linux and macOS."
    ;;
esac

HEADERS=(-H "X-GitHub-Api-Version: 2022-11-28")
if [[ -n "$TOKEN" ]]; then
  HEADERS+=(-H "Authorization: Bearer $TOKEN")
fi

if [[ "$VERSION" == "latest" ]]; then
  RELEASE_URL="https://api.github.com/repos/$REPO/releases/latest"
else
  [[ "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail "Use a version such as v0.0.13."
  RELEASE_URL="https://api.github.com/repos/$REPO/releases/tags/$VERSION"
fi

TMP_DIR=$(mktemp -d)
echo "Fetching release metadata..."
curl -fsSL --retry 3 "${HEADERS[@]}" -H "Accept: application/vnd.github+json" \
  "$RELEASE_URL" -o "$TMP_DIR/release.json" ||
  fail "Cannot access the release. For a private repository, set GH_TOKEN to a token with repository read access."

VERSION=$(jq -er '.tag_name' "$TMP_DIR/release.json")

download_asset() {
  local name="$1"
  local url
  url=$(jq -er --arg name "$name" '.assets[] | select(.name == $name) | .url' \
    "$TMP_DIR/release.json") || fail "Release $VERSION does not contain $name."
  curl -fsSL --retry 3 "${HEADERS[@]}" -H "Accept: application/octet-stream" \
    "$url" -o "$TMP_DIR/$name"
}

echo "Downloading Lunarscribe $VERSION ($ASSET)..."
download_asset "$ASSET"
download_asset "sha256sums.txt"
EXPECTED=$(awk -v asset="$ASSET" '$2 == asset { print $1 }' "$TMP_DIR/sha256sums.txt")
[[ "$EXPECTED" =~ ^[0-9a-f]{64}$ ]] || fail "The release checksum is missing or invalid."

if [[ "$(uname -s)" == "Linux" ]]; then
  [[ ! -d "$INSTALL_DIR/lunarscribe" ]] || fail "The install destination is a directory."
  ACTUAL=$(sha256sum "$TMP_DIR/$ASSET")
else
  ACTUAL=$(shasum -a 256 "$TMP_DIR/$ASSET")
fi
[[ "${ACTUAL%% *}" == "$EXPECTED" ]] || fail "The download checksum does not match."

mkdir -p "$INSTALL_DIR"
STAGE_DIR=$(mktemp -d "$INSTALL_DIR/.lunarscribe.XXXXXX")

if [[ "$(uname -s)" == "Linux" ]]; then
  cp "$TMP_DIR/$ASSET" "$STAGE_DIR/lunarscribe"
  chmod +x "$STAGE_DIR/lunarscribe"
  mv -f "$STAGE_DIR/lunarscribe" "$INSTALL_DIR/lunarscribe"
  echo "Installed Lunarscribe $VERSION at $INSTALL_DIR/lunarscribe"
  case ":$PATH:" in
    *":$INSTALL_DIR:"*) ;;
    *) echo "Add $INSTALL_DIR to PATH to run lunarscribe."
      ;;
  esac
else
  mkdir "$TMP_DIR/mount"
  MOUNT_PATH="$TMP_DIR/mount"
  hdiutil attach "$TMP_DIR/$ASSET" -nobrowse -readonly -mountpoint "$MOUNT_PATH" -quiet
  [[ -d "$MOUNT_PATH/Lunarscribe.app" ]] || fail "The disk image does not contain Lunarscribe.app."
  ditto "$MOUNT_PATH/Lunarscribe.app" "$STAGE_DIR/new.app"
  hdiutil detach "$MOUNT_PATH" -quiet
  MOUNT_PATH=""
  APP_PATH="$INSTALL_DIR/Lunarscribe.app"
  if [[ -e "$APP_PATH" ]]; then
    mv "$APP_PATH" "$STAGE_DIR/previous.app"
  fi
  mv "$STAGE_DIR/new.app" "$APP_PATH"
  echo "Installed Lunarscribe $VERSION at $APP_PATH"
  echo "Open Lunarscribe.app to start the app."
fi
