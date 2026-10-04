# Syncing saved writing in the web app

The web app keeps saved files in browser storage. If the user clears site data, those
files are lost. Sync copies saved markdown and drawings to Google Drive or Dropbox, and
other devices and browsers can then get the same files. This document describes the web
sync and how it differs from the desktop sync in [001-syncing.md](001-syncing.md).

The web sync uses the same comparison rules as the desktop sync. The difference is where
data is kept, how sign-in works, and how browser tabs share one sync.

## Scope

Sync includes saved files in browser storage with the `.md`, `.markdown`, `.txt`, or
`.draw` extension. [001-file-saving.md](../001-file-saving.md#web-app) describes how the
web app stores these files.

Sync does not include these items:

- External files. The browser writes them through file handles, and the files stay on the
  device.
- Unsaved buffers.
- GitHub. The web app has Google Drive and Dropbox only.

## Non-goals

- **GitHub sync.** The desktop app uses Git and the GitHub CLI in Electron's main process.
  A browser cannot run these tools. The GitHub OAuth token exchange needs a client secret
  and does not accept requests from browser pages. A GitHub provider must have a server
  route for the token exchange. Add it only with that server.
- **A Lunarscribe server.** The web app keeps files and credentials only in the browser.
  Sign-in uses public client IDs and no client secret.
- **Merging edits.** Google Drive and Dropbox compare whole files, as on desktop.

## User-visible behavior

### Connect a provider

1. Open **Settings → General → Syncing**.
2. Select **Google Drive** or **Dropbox**. Google Drive is the default.
3. Select **Connect Google Drive** or **Connect Dropbox**. Sign-in opens in a pop-up
   window. If the browser blocks pop-ups, the app shows an error. Allow pop-ups for the
   site, then try again.
4. To stop a sign-in, select **Cancel sign-in**. A sign-in that does not complete in three
   minutes fails.

After sign-in, the app finds or creates the `lunarscribe-bak-files` folder. It then starts
a sync. In Google Drive, this folder is in the user's Drive. In Dropbox, the folder is in
the App folder. If Google Drive has more than one `lunarscribe-bak-files` folder, Connect
fails. Keep one folder, then connect again.

If you connect again to the same provider, account, and folder, the app keeps the sync
history. Otherwise, the first sync uses modification times, as on desktop.

### Sync your files

| Action                                               | Result                                                      |
| ---------------------------------------------------- | ----------------------------------------------------------- |
| Open or reload a Lunarscribe tab                     | Sync all saved files in the background.                     |
| A Lunarscribe tab is open for five minutes           | Sync all saved files in the background.                     |
| Select **Sync now**                                  | Sync all saved files.                                       |
| Press `Ctrl+S` on Linux or `Cmd+S` on macOS          | Save the active buffer, then upload its saved file.         |
| Select **Force changes to remote** in a sidebar menu | Replace the remote copy of that saved file with local copy. |

Background sync, including the sync when a tab opens, skips a run when sync is busy,
sign-in is required, or another tab is syncing. Toasts, the sync messages beside the file
path, and the conflict rules are the same as on desktop.

### Sign-in expiry

Google gives the browser an access token without a refresh token. The token expires after
about one hour. The app then shows that sign-in is required and stops background sync.
Select **Sign in again** in Syncing. Local saves continue during the pause.

Dropbox sign-in requests offline access. The app renews the Dropbox access token
automatically with its refresh token. If the user removes access, the app asks for sign-in
again.

### Disconnect

Select **Disconnect** in Syncing. The app removes the stored credentials and sync history
from the browser. Saved files in the browser and the remote backup do not change.

## Design

### Stored state

| Data                      | Location                                                        |
| ------------------------- | --------------------------------------------------------------- |
| Saved files               | IndexedDB database `lunarscribe`, object store `files`.         |
| Provider, account, folder | localStorage key `lunarscribe-sync-settings`.                   |
| OAuth tokens              | The same localStorage key.                                      |
| Shared base for each file | The `baseline` object in the same key: a SHA-256 hash per name. |
| Last successful sync time | The `lastSyncedAt` field in the same key.                       |

All tabs of the same origin read the same settings. The app reads the settings again
before each sync operation. When another tab changes the settings, the `storage` event
updates the sync status in this tab.

The OAuth tokens are plain text in localStorage. Any script that runs on the site can read
them. Keep the site free of third-party scripts other than Google Identity Services.

### Tabs and the sync lock

Each tab loads its own sync service. These rules prevent two tabs from syncing at the same
time:

- A sync operation requests the Web Lock `lunarscribe-sync` with `ifAvailable`. If another
  tab holds the lock, the operation fails with a message to try again. A background run
  skips without an error.
- The `lunarscribe-sync` BroadcastChannel sends sync results and downloaded files to other
  tabs. Each tab then updates its own open buffers.
- Each tab sends the names of saved files that have unsaved edits in its buffers. The tab
  that syncs protects all these names from downloads. When a tab closes, it sends an empty
  list.

### Comparison and downloads

`planSync` in `apps/web/src/lib/sync/files.ts` uses the desktop rules. It compares the
SHA-256 hash of the local copy, the remote copy, and the shared base. Hashes come from
`crypto.subtle`, so `planSync` is asynchronous in the web app.

A download goes through `applySyncedFile` in `saved-files.ts`. It writes to IndexedDB only
if the stored record still has the same content and modification time as at the start of
the sync. If a tab saved the file during the sync, the download stops. The app reports a
conflict and keeps both copies. The previous shared base stays.

A download also stops if any tab has unsaved edits in a buffer for that file.

### Providers

Both providers use the shared JSON checks and provider types in
`packages/utils/src/sync/`.

- **Google Drive** uses Drive API v2 and the `drive.file` scope. Browsers have no MD5 hash
  function, so the app checks each download with the `sha256Checksum` field from Drive.
  The desktop app uses `md5Checksum`.
- **Dropbox** uses the same code as on desktop. File modification times have one-second
  precision.

### Sign-in

- **Google Drive:** the app loads Google Identity Services from
  `https://accounts.google.com/gsi/client` on the first sign-in. It requests a token with
  the token client.
- **Dropbox:** the app opens the pop-up before any `await`, so the browser accepts it as
  part of the click. The app uses OAuth with PKCE. Dropbox sends the user to
  `<origin>/oauth/dropbox`. That route sends the code and state to the opening tab on the
  `lunarscribe-oauth` BroadcastChannel, then closes the pop-up. The opening tab checks the
  state and gets the tokens.

## Developer setup

Public client IDs are in `apps/web/src/lib/sync/public-creds.json`. They have the same
values as the desktop file. They are not secrets.

For Google Drive, add each web app origin as an authorized JavaScript origin of the OAuth
client. For example, add `http://localhost:3000` for development.

For Dropbox, register `<origin>/oauth/dropbox` as a redirect URI for each origin. For
example, register `http://localhost:3000/oauth/dropbox`. The required permissions are the
same as on desktop.

## Code references

Sync code is in `apps/web/src/lib/sync/`:

- `sync-service.ts`: connections, status, the Web Lock, tab messages, the sync when a tab
  opens, and the five-minute schedule.
- `files.ts`: file comparisons and local file updates.
- `google-drive.ts` and `dropbox.ts`: provider operations.
- `oauth.ts`: Google and Dropbox sign-in.
- `settings.ts`: settings in localStorage.
- `sync-types.ts`: providers, status, and results that the UI uses.

The UI uses `components/use-sync.ts` and `components/settings-dialog/syncing-pane.tsx`.
The Dropbox redirect route is `routes/oauth.dropbox.tsx`.

## Acceptance criteria and checks

Run `bun run format`, `bun run lint`, `bun run check-types`, and `bun run build`.

Do these checks manually, with real accounts:

1. Connect each provider. The `lunarscribe-bak-files` folder exists, and the first sync
   uploads the saved files.
2. Edit a saved file in one browser and sync. Sync in a second browser. The second browser
   gets the edit, and its open buffer shows it.
3. Edit the same file in two browsers and sync both. The second sync reports a conflict
   and keeps both copies.
4. Open two tabs. Start **Sync now** in both at the same time. One tab syncs. The other
   tab shows that another tab is syncing.
5. Open two tabs at the same time. One tab syncs. The other tab shows no error.
6. Type in a saved file in one tab without a save. Sync from a second tab with a remote
   change to that file. The download stops and the unsaved edits stay.
7. Block pop-ups, then select the Connect button. The app shows an error, and the settings
   do not change. Close the sign-in pop-up. The app reports that sign-in was cancelled.
8. Wait for the Google access token to expire. Background sync stops, and Syncing asks for
   sign-in. **Sign in again** restores sync and keeps the sync history.
9. Disconnect. The localStorage key has no provider, tokens, or baseline. The saved files
   and remote backup stay.
