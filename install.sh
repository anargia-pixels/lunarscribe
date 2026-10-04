#!/usr/bin/env bash
# Install the release into the application folder for this operating system and architecture.
set -euo pipefail

REPO="anargia-pixels/lunarscribe"
VERSION="${LUNARSCRIBE_VERSION:-latest}"
TMP_DIR=""
MOUNT_PATH=""
STAGE_DIR=""
APPLICATION_FOLDER=""
INSTALL_COMPLETE="false"
INSTALL_RESULT="Installed"

fail() {
  echo "error: $*" >&2
  exit 1
}

cleanup() {
  if [[ -n "$MOUNT_PATH" ]]; then
    hdiutil detach "$MOUNT_PATH" -quiet || true
  fi
  if [[ -n "$STAGE_DIR" ]]; then
    if [[ -d "$STAGE_DIR/previous.app" && "$INSTALL_COMPLETE" != "true" ]]; then
      if [[ -e "$APPLICATION_FOLDER" || -L "$APPLICATION_FOLDER" ]]; then
        mv "$APPLICATION_FOLDER" "$STAGE_DIR/failed.app"
      fi
      mv "$STAGE_DIR/previous.app" "$APPLICATION_FOLDER"
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
    APPLICATION_FOLDER="${INSTALL_DIR%/}"
    for command in sha256sum unzip dd od; do
      command -v "$command" >/dev/null || fail "Install $command before running this installer."
    done
    ;;
  Darwin)
    [[ "$(uname -m)" == "arm64" ]] || fail "The macOS release requires Apple Silicon (arm64)."
    ASSET="lunarscribe-macos-arm64.dmg"
    INSTALL_DIR="${LUNARSCRIBE_INSTALL_DIR:-$HOME/Applications}"
    APPLICATION_FOLDER="$INSTALL_DIR/Lunarscribe.app"
    for command in hdiutil ditto shasum; do
      command -v "$command" >/dev/null || fail "Required command not found: $command"
    done
    ;;
  *) fail "Lunarscribe supports Linux and macOS."
    ;;
esac

HEADERS=(-H "X-GitHub-Api-Version: 2022-11-28")

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
  fail "Cannot access the release. Check your connection and try again."

VERSION=$(jq -er '.tag_name' "$TMP_DIR/release.json")

installed_version() {
  if [[ "$(uname -s)" == "Darwin" ]]; then
    /usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' \
      "$APPLICATION_FOLDER/Contents/Info.plist" 2>/dev/null
    return
  fi

  local archive="$APPLICATION_FOLDER/resources/app.asar"
  local header_size json_size offset size
  [[ -f "$archive" ]] || return 1

  # ASAR stores its JSON header after four 32-bit integers, then the packed files.
  header_size=$(od -An -tu4 -j4 -N4 "$archive") || return 1
  json_size=$(od -An -tu4 -j12 -N4 "$archive") || return 1
  [[ "$header_size" =~ ^[[:space:]]*[0-9]+[[:space:]]*$ &&
     "$json_size" =~ ^[[:space:]]*[0-9]+[[:space:]]*$ ]] || return 1
  dd if="$archive" bs=1 skip=16 count="$((json_size))" 2>/dev/null \
    > "$TMP_DIR/installed-header.json" || return 1
  read -r offset size < <(jq -er '.files["package.json"] | "\(.offset) \(.size)"' \
    "$TMP_DIR/installed-header.json") || return 1
  [[ "$offset" =~ ^[0-9]+$ && "$size" =~ ^[0-9]+$ ]] || return 1
  dd if="$archive" bs=1 skip="$((8 + header_size + offset))" count="$size" 2>/dev/null |
    jq -er '.version | select(type == "string" and length > 0)'
}

if [[ -e "$APPLICATION_FOLDER" || -L "$APPLICATION_FOLDER" ]]; then
  CURRENT_VERSION=$(installed_version) || CURRENT_VERSION=""
  if [[ -n "$CURRENT_VERSION" ]]; then
    CURRENT_VERSION="v${CURRENT_VERSION#v}"
  else
    CURRENT_VERSION="unknown version"
  fi
  echo "Updating Lunarscribe: $CURRENT_VERSION -> $VERSION"
  INSTALL_RESULT="Updated"
else
  echo "Fresh install: Lunarscribe $VERSION"
fi

download_asset() {
  local name="$1"
  local url
  local progress=(--silent)
  if [[ "$name" == "$ASSET" ]]; then
    progress=(--progress-bar)
  fi
  url=$(jq -er --arg name "$name" '.assets[] | select(.name == $name) | .browser_download_url' \
    "$TMP_DIR/release.json") || fail "Release $VERSION does not contain $name."
  curl -fL --show-error "${progress[@]}" --retry 3 "$url" -o "$TMP_DIR/$name"
}

echo "Downloading Lunarscribe $VERSION ($ASSET)..."
download_asset "$ASSET"
download_asset "sha256sums.txt"
echo "Verifying download..."
EXPECTED=$(awk -v asset="$ASSET" '$2 == asset { print $1 }' "$TMP_DIR/sha256sums.txt")
[[ "$EXPECTED" =~ ^[0-9a-f]{64}$ ]] || fail "The release checksum is missing or invalid."

if [[ "$(uname -s)" == "Linux" ]]; then
  ACTUAL=$(sha256sum "$TMP_DIR/$ASSET")
else
  ACTUAL=$(shasum -a 256 "$TMP_DIR/$ASSET")
fi
[[ "${ACTUAL%% *}" == "$EXPECTED" ]] || fail "The download checksum does not match."

echo "Preparing Lunarscribe $VERSION..."
if [[ "$(uname -s)" == "Linux" ]]; then
  INSTALL_DIR="${INSTALL_DIR%/}"
  [[ -n "$INSTALL_DIR" && "$INSTALL_DIR" != *$'\n'* && "$INSTALL_DIR" != *$'\r'* ]] ||
    fail "Use an install path without line breaks."
  [[ ! -e "$INSTALL_DIR" || -d "$INSTALL_DIR" ]] ||
    fail "The install destination is not a directory."
  INSTALL_PARENT=$(dirname "$INSTALL_DIR")
  mkdir -p "$INSTALL_PARENT" "$DESKTOP_DIR"
  APPLICATION_FOLDER="$(cd "$INSTALL_PARENT" && pwd -P)/$(basename "$INSTALL_DIR")"
  STAGE_DIR=$(mktemp -d "$INSTALL_PARENT/.lunarscribe.XXXXXX")
  unzip -q "$TMP_DIR/$ASSET" -d "$STAGE_DIR/new.app"
  [[ -f "$STAGE_DIR/new.app/lunarscribe" && -f "$STAGE_DIR/new.app/resources/app.asar" ]] ||
    fail "The ZIP does not contain the Lunarscribe app."
  chmod +x "$STAGE_DIR/new.app/lunarscribe"

  # Escape the quoted Exec argument, then the desktop entry's string value.
  EXEC_PATH="$APPLICATION_FOLDER/lunarscribe"
  EXEC_PATH="${EXEC_PATH//\\/\\\\}"
  EXEC_PATH="${EXEC_PATH//\"/\\\"}"
  EXEC_PATH="${EXEC_PATH//\$/\\\$}"
  EXEC_PATH="${EXEC_PATH//\`/\\\`}"
  EXEC_PATH="${EXEC_PATH//%/%%}"
  EXEC_PATH="${EXEC_PATH//\\/\\\\}"
  ICON_PATH="$APPLICATION_FOLDER/resources/icons/256x256.png"
  ICON_PATH="${ICON_PATH//\\/\\\\}"
  cat > "$STAGE_DIR/lunarscribe.desktop" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Lunarscribe
Comment=Write markdown and create drawings
Exec="$EXEC_PATH" %U
Icon=$ICON_PATH
Terminal=false
Categories=Office;TextEditor;
MimeType=text/markdown;text/x-markdown;text/plain;x-scheme-handler/lunarscribe;
EOF
  chmod 644 "$STAGE_DIR/lunarscribe.desktop"
  if [[ -e "$APPLICATION_FOLDER" || -L "$APPLICATION_FOLDER" ]]; then
    mv "$APPLICATION_FOLDER" "$STAGE_DIR/previous.app"
  fi
  mv "$STAGE_DIR/new.app" "$APPLICATION_FOLDER"
  mv -f "$STAGE_DIR/lunarscribe.desktop" "$DESKTOP_DIR/lunarscribe.desktop"
  INSTALL_COMPLETE="true"
  if command -v update-desktop-database >/dev/null; then
    update-desktop-database "$DESKTOP_DIR" || true
  fi
  echo "$INSTALL_RESULT Lunarscribe $VERSION at $APPLICATION_FOLDER"
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
  APPLICATION_FOLDER="$INSTALL_DIR/Lunarscribe.app"
  if [[ -e "$APPLICATION_FOLDER" ]]; then
    mv "$APPLICATION_FOLDER" "$STAGE_DIR/previous.app"
  fi
  mv "$STAGE_DIR/new.app" "$APPLICATION_FOLDER"
  INSTALL_COMPLETE="true"
  echo "$INSTALL_RESULT Lunarscribe $VERSION at $APPLICATION_FOLDER"
  echo "Open Lunarscribe.app to start the app."
fi
