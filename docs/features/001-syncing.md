# Syncing saved writing

Syncing copies saved markdown and drawings between devices. Open Settings → General →
Syncing and connect GitHub, Google Drive, or Dropbox. Only one provider can be connected.
Each device must connect to the same account and the same OAuth application.

Public OAuth identifiers belong in `apps/desktop/src/electron/sync/public-creds.json`.
Environment variables are reserved for secrets; the public identifiers do not use them.

The first connection runs sync immediately. While Lunarscribe has an open window, a
background task runs every five minutes. Sync now pulls and pushes saved files. `Ctrl+S`
on Linux and `Cmd+S` on macOS save the active buffer locally, then push that saved file.
Automatic local saves keep their existing two-second delay. External files and unsaved
buffers are outside sync.

Sync includes `.md`, `.markdown`, `.txt`, and `.draw` files directly inside the
Lunarscribe documents folder. It does not include nested folders.

## GitHub setup

Install `git` and `gh`. Run `gh auth login` with the account that owns the backup. Connect
checks for that account's `lunarscribe-bak-files` repository. If the repository does not
exist, Lunarscribe creates it as private. An existing public repository must be made
private before connecting. Lunarscribe checks privacy again before pushing.

The app uses a disposable checkout in its app data folder. GitHub CLI supplies HTTPS
authentication. Lunarscribe does not change global Git settings. It uses the remote
default branch, or `master` for a new empty repository. It does not merge, rebase, or
force push. A concurrent remote commit rejects the push and shows a toast.

## Google Drive setup

Enable the Google Drive API in the app's Google Cloud project. Create a **Web
application** OAuth client. Add this authorized JavaScript origin:

```text
http://127.0.0.1:53682
```

The public Google OAuth client ID is stored in
`apps/desktop/src/electron/sync/public-creds.json` and bundled with every desktop build.
Users select Google Drive and connect without entering app credentials. No `.env` file,
environment variable, or client secret is needed.

Connect opens a temporary page on the device in the user's browser. The user selects Sign
in with Google. Google Identity Services grants the `drive.file` scope, which limits
access to files the app creates or the user authorizes for the app. The app finds or
creates `lunarscribe-bak-files` in the signed-in user's Drive.

This flow does not use a refresh token. When the access token expires, the app shows a
Sign-in required toast and pauses background sync. Open Syncing and select Sign in again.
Reconnecting the same destination keeps the last sync comparison. Local saving continues
while sign-in is required. No hosted Lunarscribe service is needed.

The Drive API v2 exposes ETags for conditional file updates and trash operations.
Lunarscribe checks these ETags before replacing a remote file. Concurrent creation can
produce two files with the same name. The app preserves both and reports the duplicate on
the next sync. Resolve duplicates in Drive before retrying.

See
[Google's token model guide](https://developers.google.com/identity/oauth2/web/guides/use-token-model)
for the browser flow and token lifetime.

## Dropbox setup

Create a scoped Dropbox application with **App folder** access. Enable these permissions:

- `account_info.read`
- `files.metadata.read`
- `files.metadata.write`
- `files.content.read`
- `files.content.write`

Register this redirect URI:

```text
http://127.0.0.1:53683/oauth/dropbox
```

The public Dropbox app key is stored in `apps/desktop/src/electron/sync/public-creds.json`
and bundled with every desktop build. Users select Dropbox and connect without entering
app credentials. Connect opens Dropbox sign-in in the user's browser. PKCE and a random
state value protect the callback. No `.env` file, environment variable, or app secret is
needed.

The app finds or creates `lunarscribe-bak-files` inside its Dropbox App folder. Uploads
and deletions use the last read revision. A different revision rejects the operation.
Refresh tokens allow background sync to continue without repeated browser sign-in. Revoked
access shows a Sign-in required toast.

See [Dropbox's OAuth guide](https://developers.dropbox.com/oauth-guide).

## Conflicts and failures

The app stores a hash of each file's last acknowledged version. It compares the local and
remote file against that hash. A change on one side can be copied to the other side.
Different changes on both sides preserve both versions and show a toast. Sync continues
for files without conflicts. The app never inserts merge markers into writing.

A changed open buffer blocks an incoming remote change. Clean open buffers refresh after a
pull. A local save checks the file version loaded by the buffer. If that version has
changed, the save preserves the buffer and shows a toast instead of replacing the saved
file.

To resolve a conflict, first copy pending buffer edits somewhere safe. Compare the saved
local copy with the provider's copy. Edit the copies so they agree, or rename one copy to
keep both versions. Reload a stale buffer by restarting Lunarscribe only after preserving
its pending edits. Run Sync now again. Lunarscribe does not choose a winning version
automatically.

Saved-file deletions propagate after the file has a last acknowledged version. Google
Drive deletions move files to the trash. If the other device edited the deleted file, sync
reports a conflict. Renames are a creation and deletion of saved names.

Network, prerequisite, sign-in, and provider failures show toasts and appear in Syncing.
Failed sync does not roll back a successful local save. A provider can accept some file
writes before another write fails; the next sync compares those files again.

OAuth tokens stay in the Electron main process and are stored as readable JSON in
`sync/sync-settings.json` inside the app data folder from `app.getPath("userData")`. The
file has owner-only read and write permissions (`0600`). No system keyring is required.
Previously encrypted credentials require browser sign-in again; the saved destination and
comparison history are preserved when reconnecting the same account. Disconnect removes
the stored tokens and comparison history. Remote backups and local saved files remain.

## Validation

Run `bun run format`, `bun run lint`, `bun run check-types`, and `bun run build`. Live
account validation requires the OAuth applications to have the settings above and browser
sign-in. Validate first connection and reconnection, two-device edits and deletion, token
expiry or revocation, concurrent pushes, and offline retries before release.
