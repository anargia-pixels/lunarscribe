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
    ASSET="lunarscribe-linux-x64.zip"
    INSTALL_DIR="${LUNARSCRIBE_INSTALL_DIR:-$HOME/.local/lunarscribe.app}"
    DESKTOP_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
    for command in sha256sum unzip; do
      command -v "$command" >/dev/null || fail "Install $command before running this installer."
    done
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
  ACTUAL=$(sha256sum "$TMP_DIR/$ASSET")
else
  ACTUAL=$(shasum -a 256 "$TMP_DIR/$ASSET")
fi
[[ "${ACTUAL%% *}" == "$EXPECTED" ]] || fail "The download checksum does not match."

if [[ "$(uname -s)" == "Linux" ]]; then
  INSTALL_DIR="${INSTALL_DIR%/}"
  [[ -n "$INSTALL_DIR" && "$INSTALL_DIR" != *$'\n'* && "$INSTALL_DIR" != *$'\r'* ]] ||
    fail "Use an install path without line breaks."
  [[ ! -e "$INSTALL_DIR" || -d "$INSTALL_DIR" ]] ||
    fail "The install destination is not a directory."
  INSTALL_PARENT=$(dirname "$INSTALL_DIR")
  mkdir -p "$INSTALL_PARENT" "$DESKTOP_DIR"
  APP_PATH="$(cd "$INSTALL_PARENT" && pwd -P)/$(basename "$INSTALL_DIR")"
  STAGE_DIR=$(mktemp -d "$INSTALL_PARENT/.lunarscribe.XXXXXX")
  unzip -q "$TMP_DIR/$ASSET" -d "$STAGE_DIR/new.app"
  [[ -f "$STAGE_DIR/new.app/lunarscribe" && -f "$STAGE_DIR/new.app/resources/app.asar" ]] ||
    fail "The ZIP does not contain the Lunarscribe app."
  chmod +x "$STAGE_DIR/new.app/lunarscribe"

  # Escape the quoted Exec argument, then the desktop entry's string value.
  EXEC_PATH="$APP_PATH/lunarscribe"
  EXEC_PATH="${EXEC_PATH//\\/\\\\}"
  EXEC_PATH="${EXEC_PATH//\"/\\\"}"
  EXEC_PATH="${EXEC_PATH//\$/\\\$}"
  EXEC_PATH="${EXEC_PATH//\`/\\\`}"
  EXEC_PATH="${EXEC_PATH//%/%%}"
  EXEC_PATH="${EXEC_PATH//\\/\\\\}"
  cat > "$STAGE_DIR/lunarscribe.desktop" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Lunarscribe
Comment=Write markdown and create drawings
Exec="$EXEC_PATH" %U
Icon=accessories-text-editor
Terminal=false
Categories=Office;TextEditor;
MimeType=text/markdown;text/x-markdown;text/plain;x-scheme-handler/lunarscribe;
EOF
  chmod 644 "$STAGE_DIR/lunarscribe.desktop"
  if [[ -e "$APP_PATH" || -L "$APP_PATH" ]]; then
    mv "$APP_PATH" "$STAGE_DIR/previous.app"
  fi
  mv "$STAGE_DIR/new.app" "$APP_PATH"
  mv -f "$STAGE_DIR/lunarscribe.desktop" "$DESKTOP_DIR/lunarscribe.desktop"
  if command -v update-desktop-database >/dev/null; then
    update-desktop-database "$DESKTOP_DIR" || true
  fi
  echo "Installed Lunarscribe $VERSION at $APP_PATH"
  echo "Installed desktop entry at $DESKTOP_DIR/lunarscribe.desktop"
  echo "Select Lunarscribe in your application menu to start the app."
else
  mkdir -p "$INSTALL_DIR"
  STAGE_DIR=$(mktemp -d "$INSTALL_DIR/.lunarscribe.XXXXXX")
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
