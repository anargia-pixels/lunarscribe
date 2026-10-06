# Syncing saved writing

Sync copies saved markdown and drawings between devices. Every app compares files the same
way. The apps differ in which providers they offer, where they keep files, and how sign-in
works.

| App     | Providers                     | Google Drive sign-in              |
| ------- | ----------------------------- | --------------------------------- |
| Desktop | GitHub, Google Drive, Dropbox | Renews automatically.             |
| Web     | Google Drive, Dropbox         | Sign in again about once an hour. |
| Mobile  | Google Drive, Dropbox         | Renews automatically.             |

Google Drive and Dropbox are marked **WIP**. You can connect one provider at a time. Use
the same account on each device.

Sync includes saved files with the `.md`, `.markdown`, `.txt`, or `.draw` extension. It
does not include unsaved buffers, external files, or files in subfolders.

## Connect a provider

1. Open **Settings → General → Syncing**.
2. Select a provider.
3. Select **Connect**, then finish sign-in in the browser.

Google Drive and Dropbox use a folder named `lunarscribe-bak-files`. The app finds it or
creates it. Google Drive keeps it in your Drive. Dropbox keeps it in the Dropbox App
folder. If Google Drive has more than one folder with this name, Connect fails. Keep one
folder, then connect again.

Sync starts right after you connect.

## Sync your files

Sync runs when the app opens and every five minutes while it is open. A scheduled run is
skipped when sync is busy or sign-in is required.

| Action                                              | Result                                               |
| --------------------------------------------------- | ---------------------------------------------------- |
| Select **Sync now**                                 | Download and upload changes to saved files.          |
| Press `Ctrl+S` (Linux) or `Cmd+S` (macOS)           | Save the active buffer, then upload its file.        |
| Select **Force changes to remote** in a file's menu | Replace that file's remote copy with the local copy. |

Automatic local saves still run after two seconds without edits. A failed sync never
undoes a local save.

Successful syncs show no toast. A **- Sync in progress** message, then a **- Sync
successful** message, appears beside the active file's path. Conflicts and errors show
toasts.

## How sync decides which copy to keep

### Google Drive and Dropbox

Each file has a **shared base**: the version from its last successful sync. Sync compares
the local copy and the remote copy with that base.

| Local copy | Remote copy | Result                                                     |
| ---------- | ----------- | ---------------------------------------------------------- |
| `A`        | `A`         | Nothing to do.                                             |
| `B`        | `A`         | Upload the local edit.                                     |
| `A`        | `B`         | Download the remote edit, unless it is older.              |
| `B`        | `B`         | Accept the matching version.                               |
| `B`        | `C`         | Keep both copies and show a **Sync conflict** error toast. |

Before a file has a shared base, the newer modification time wins. If the times are equal
and the contents differ, sync reports a conflict. Uploads and downloads keep the original
modification time.

Sync compares whole files. It does not merge edits. A deletion on one side and an edit on
the other is a conflict. Otherwise, a deletion removes the file on other devices. Google
Drive moves deleted files to the trash.

### GitHub (desktop only)

GitHub fetches remote history and commits saved local changes. It combines compatible
markdown edits but never drawing edits. It never adds conflict markers to your files. A
conflict stops sync until you resolve it.

## Force changes to remote

Right-click a saved file in the sidebar, or open its ellipsis menu. Select **Force changes
to remote**. The app saves any pending edits, then replaces the remote copy with the local
copy. It creates the remote file if it is missing. Other remote files do not change.

The action is unavailable for external files, while sync is busy, or when sign-in is
required.

## Resolve a sync problem

A **Sync conflict** toast shows the file name and the reason. The app keeps both copies.
Google Drive and Dropbox keep syncing the other files. GitHub stops until you resolve the
conflict.

To keep the local copy, select **Force changes to remote** for the file.

To keep both versions:

1. Copy any unsaved edits to a safe place.
2. Compare the local file with the provider's copy.
3. Make the copies match, or rename one copy.
4. Select **Sync now**.

Unsaved edits in an open buffer block a download of that file. Open buffers without
pending edits update automatically.

## Disconnect

Open Syncing and select **Disconnect**. The app removes its credentials and sync history.
Your saved files and the remote backup stay. On desktop, Disconnect also revokes the app's
access, so a copied credentials file stops working:

- **Dropbox:** only this device loses access.
- **Google Drive:** Google revokes access for the whole app, so every device signed in to
  that Google account must select **Sign in again**. The app asks you to confirm first.

## Desktop

- **Files:** the Lunarscribe documents folder, usually `~/Documents/lunarscribe/`.
- **Credentials:** `sync/sync-settings.json` in the user data folder, readable only by
  your user account.
- **Google Drive and Dropbox:** both renew their access automatically. If you remove the
  app's access, the app shows a toast and pauses background sync. Open Syncing and select
  **Sign in again**.

### GitHub

GitHub needs Git 2.38 or newer and the GitHub CLI. Before you connect, run:

```sh
gh auth login
```

The app finds your `lunarscribe-bak-files` repository, or creates it as a private
repository. It creates `.git` inside the documents folder. New repositories use the `main`
branch. Disconnect deletes that `.git` folder.

If GitHub needs to download changes or upload other files, select **Sync now** before you
use the save shortcut.

## Web

- **Files:** browser storage. Clearing site data deletes them, so sync is your backup.
- **Credentials:** browser localStorage, shared by all tabs of the site.
- **Sign-in:** opens in a pop-up. Allow pop-ups for the site if the browser blocks it. A
  sign-in that does not finish in three minutes fails.
- **Google Drive:** sign-in lasts about one hour. A browser cannot renew Google access
  without a server, so the app then shows a toast and pauses background sync. Select
  **Sign in again** in Syncing. For longer sessions on the web, use Dropbox.
- **Dropbox:** renews its access automatically.
- **Tabs:** only one tab syncs at a time. If you select **Sync now** while another tab is
  syncing, the app asks you to try again. Tabs share downloaded files and protect each
  other's unsaved edits.
- **No GitHub:** a browser cannot run Git, and GitHub sign-in needs a server.

## Mobile

- **Files:** `lunarscribe/` inside the app's Documents folder.
- **Credentials:** sync settings are in `sync-settings.json` in the app's Documents
  folder. The refresh token is in the iOS Keychain or Android Keystore.
- **Google Drive and Dropbox:** both renew their access automatically.
- **Schedule:** sync pauses while the app is in the background and resumes when you return
  to it.
- **No GitHub.**

## For developers

### Public credentials

Lunarscribe has no server. Each app reads public client IDs from a `public-creds.json`
file:

| App     | File                                               |
| ------- | -------------------------------------------------- |
| Desktop | `apps/desktop/src/electron/sync/public-creds.json` |
| Web     | `apps/web/src/lib/sync/public-creds.json`          |
| Mobile  | `apps/mobile/src/lib/sync/public-creds.json`       |

Do not use `.env` for these values.

The desktop file also has `googleClientSecret`. Google requires it for Desktop app clients
and
[does not treat it as secret](https://developers.google.com/identity/protocols/oauth2#installed)
for installed apps, so it ships with the app. Anyone can read it. Users can revoke access
at <https://myaccount.google.com/permissions>. If the client is abused, add a new secret
in the console, delete the old one, and ship the new value.

### Google Cloud setup

The OAuth clients are in the `lunarscribe` Google Cloud project. Enable the Google Drive
API, add the `drive.file` scope, and publish the app to **In production**. In **Testing**,
Google expires refresh tokens after seven days.

| Client type     | Used by          | Settings                                                                                                         |
| --------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------- |
| Desktop app     | Desktop          | None. Google allows any `http://127.0.0.1` redirect.                                                             |
| Web application | Web              | Authorized JavaScript origins: each web origin, such as `http://localhost:3000`.                                 |
| iOS             | Mobile (iOS)     | Bundle ID `com.lunarscribe.app`.                                                                                 |
| Android         | Mobile (Android) | Package `com.lunarscribe.app`, the signing SHA-1, and **Custom URI scheme** enabled under **Advanced settings**. |

Desktop uses OAuth with PKCE and redirects to `http://127.0.0.1:53682/oauth/google-drive`.
Web uses Google's
[token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model),
which gives no refresh token. Mobile uses OAuth with PKCE and redirects to
`com.googleusercontent.apps.<client id>:/oauth2redirect`. `app.config.ts` registers that
scheme from the client IDs.

### Dropbox setup

Create a scoped Dropbox app with **App folder** access, and set its app key in each
`public-creds.json`. Register these redirect URIs:

- Desktop: `http://127.0.0.1:53683/oauth/dropbox`
- Web: `<origin>/oauth/dropbox`, such as `http://localhost:3000/oauth/dropbox`
- Mobile: `lunarscribe://oauth/dropbox`

Required permissions: `account_info.read`, `files.metadata.read`, `files.metadata.write`,
`files.content.read`, and `files.content.write`.

### Code

| App     | Sync code                         |
| ------- | --------------------------------- |
| Desktop | `apps/desktop/src/electron/sync/` |
| Web     | `apps/web/src/lib/sync/`          |
| Mobile  | `apps/mobile/src/lib/sync/`       |

Each folder has `sync-service.ts` (connections, status, schedule), `files.ts` (comparisons
and local updates), the providers, and the OAuth code. Shared JSON checks and provider
types are in `packages/utils/src/sync/`.

`planSync` in `files.ts` compares SHA-256 hashes of the local copy, the remote copy, and
the shared base. The `baseline` object in the sync settings stores one base hash per file.
It reports a conflict when a base exists and:

```ts
localHash !== baseHash && remoteHash !== baseHash && localHash !== remoteHash;
```

GitHub checks a merge with `git merge-tree --write-tree HEAD origin/<branch>`, which does
not change the working files.

### Checks

Run `bun run format`, `bun run lint`, `bun run check-types`, and `bun run build`. Before a
release, test each provider with real accounts on two devices: connect, reconnect, edit,
delete, conflict, expired sign-in, and network failure.
