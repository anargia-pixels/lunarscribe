# Syncing saved writing

Sync copies saved markdown and drawings between devices. You can use GitHub, Google Drive,
or Dropbox. Google Drive and Dropbox are marked **WIP**. You can connect one provider at a
time.

Sync includes `.md`, `.markdown`, `.txt`, and `.draw` files in the Lunarscribe documents
folder. This folder is usually `~/Documents/lunarscribe/`. Sync does not include external
files, unsaved buffers, or files in subfolders.

## Connect a provider

1. Open **Settings → General → Syncing**.
2. Select a provider.
3. Select **Connect**.
4. For Google Drive or Dropbox, complete sign-in in your browser.

Use the same account on each device. Each device must use the same OAuth application for
Google Drive or Dropbox. The app includes the public application credentials.

### GitHub

GitHub requires Git 2.38 or newer and the GitHub CLI (`gh`). Before you connect, run:

```sh
gh auth login
```

Lunarscribe finds your `lunarscribe-bak-files` repository. If it does not exist, the app
creates it as a private repository. Lunarscribe does not check visibility afterwards, so
you can make the repository public to share it.

The app creates `.git` inside the Lunarscribe documents folder. New repositories use the
`main` branch. Existing backups keep their default branch.

### Google Drive and Dropbox

The app finds or creates a folder named `lunarscribe-bak-files`. Google Drive stores this
folder in your Drive. Dropbox stores it inside the Dropbox App folder.

Google Drive requires sign-in again when its access token expires. The app shows a toast
and pauses background sync. Open Syncing. Select **Sign in again**. Local saves continue
while sync is paused.

Dropbox can renew its access token automatically. If access is removed, the app asks you
to sign in again.

## Sync your files

Sync starts after you connect and when Lunarscribe opens. It then runs every five minutes
while Lunarscribe has an open window. It skips a scheduled run if sync is busy or sign-in
is required.

| Action                                                            | Result                                                                               |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Select **Sync now**                                               | Download and upload changes to saved files.                                          |
| Press `Ctrl+S` on Linux                                           | Save the active buffer, then upload its file.                                        |
| Press `Cmd+S` on macOS                                            | Save the active buffer, then upload its file.                                        |
| Select **Force changes to remote** in a saved file's sidebar menu | Save pending buffer edits, then replace that file's remote copy with the local copy. |

Automatic local saves still run after two seconds without edits.

Successful background sync and save-shortcut uploads do not show a success toast. A small
**- Sync successful** message appears beside the active saved file's path for three
seconds. Pending edits, a new sync, or a sync problem clear the message. Conflicts and
errors still show toasts.

While a sync runs, a **- Sync in progress** message appears beside the active saved file's
path.

GitHub fetches remote history and commits saved local changes. It then checks for merge
conflicts before it updates your files. It can combine compatible markdown edits. It does
not combine drawing edits. The app never adds conflict markers to your files. Normal sync
does not overwrite conflicting remote changes.

Google Drive and Dropbox compare each file with its last synced version. This version is
the shared base, like a Git commit. A local-only change uploads. A remote-only change
downloads if it is not older than the local file. If the remote copy is older, the local
copy uploads instead. If both copies changed from the shared base and differ from each
other, sync keeps both and reports a conflict. If both copies contain the same writing,
sync accepts that version even if both changed independently.

Before a file has sync history, the newer modification time selects the copy to keep. If
the copies differ and their times are equal, sync reports a conflict. Modification times
depend on the devices' clocks. Uploads and downloads keep the original file modification
time, so copying an old version does not make it newer. Drive uses `modifiedDate`; Dropbox
uses `client_modified`, which has one-second precision.

Both providers check the remote revision before an ordinary replacement. If another device
changes the remote copy during sync, retry to compare the latest versions.

If GitHub needs to download changes or upload other files, select **Sync now** before you
use the save shortcut.

After a file has synced, a deletion can remove its copy on other devices. Google Drive
moves deleted files to the trash. If another device edited the deleted file, sync reports
a conflict.

### Divergent edits

For Drive and Dropbox, different local and remote copies do not by themselves mean a
conflict. The app compares both copies with the last synced version, called the shared
base. Edits are divergent only when both copies changed from that base and differ from
each other.

For example, suppose the shared base is version `A`:

| Local copy | Remote copy | Result                                                           |
| ---------- | ----------- | ---------------------------------------------------------------- |
| `A`        | `A`         | No transfer is needed.                                           |
| `B`        | `A`         | Upload the local edit. The remote copy is still the base.        |
| `A`        | `B`         | Download the remote edit if it is not older than the local copy. |
| `B`        | `B`         | Accept the matching version as the new base.                     |
| `B`        | `C`         | Preserve both copies and show a **Sync conflict** error toast.   |

Drive and Dropbox compare whole files. They do not merge edits to separate lines. A
deletion on one side and an edit on the other also count as divergent changes. Once a
shared base exists, modification times do not resolve divergence. Use **Force changes to
remote** to select the local copy explicitly.

### Force changes to remote

Right-click a saved markdown or drawing file in the sidebar, or open its ellipsis menu.
Select **Force changes to remote** to replace its remote copy with the local copy. This
action works with GitHub, Google Drive, and Dropbox. It ignores previous sync history and
remote edits, and creates the remote file if it is missing. Remote edits to the selected
file are overwritten. Other remote files stay unchanged.

If the file has an open buffer, the app saves its pending edits before the upload. The
action does not download remote changes. It is unavailable for external files, while sync
is busy, or when no provider is connected or sign-in is required.

GitHub adds a commit to the current remote branch without changing local Git history. If
another device updates the branch during the upload, the app retries from the latest
remote version. Google Drive keeps one local copy under the selected name and moves
duplicate copies to the trash. A Google document under that name is replaced with a saved
file. Dropbox uses an overwrite upload. A remote folder at the selected file path must be
renamed before this action can replace the file.

## Resolve a sync problem

The app shows a toast for sync errors or required sign-in. The Syncing section also shows
errors. A failed sync does not undo a successful local save.

If a file has a conflict, a persistent **Sync conflict** error toast shows its name and
the reason. Divergent edits mean both copies changed since their last synced version and
differ from each other. The app keeps both copies. Google Drive and Dropbox continue to
sync files without conflicts. GitHub stops until you resolve the conflict.

On the first Google Drive or Dropbox sync, existing copies can differ. The app uses their
modification times until it has a shared base. Equal times with different contents require
you to choose a copy. This message does not mean that sign-in failed.

Unsaved edits in an open buffer can also block a download. The app updates open buffers
that have no pending edits.

To keep the local copy of a conflicted file, select **Force changes to remote** in its
sidebar menu. This overwrites the remote edits to that file.

To compare and keep both versions:

1. Copy pending buffer edits to a safe location.
2. Compare the local file with the provider's copy.
3. Make the copies match, or rename one copy to keep both versions.
4. If the open buffer still shows an old version, restart Lunarscribe after you preserve
   its pending edits.
5. Select **Sync now**.

If Google Drive reports duplicate filenames, keep the required copies under different
names before you retry sync.

## Disconnect

Open Syncing. Select **Disconnect**. The app removes stored credentials and sync history.
Your saved files and remote backup remain.

For GitHub, disconnect also deletes `.git` from the Lunarscribe documents folder.

Credentials are stored as readable JSON in `sync/sync-settings.json` inside the user data
folder. Only your user account has file permissions to read or write this file. The app
does not require a system keyring.

## For developers

Public application credentials are in `apps/desktop/src/electron/sync/public-creds.json`.
The desktop build includes this file. Do not use `.env` for these credentials. Reserve
environment variables for secrets. Google Drive and Dropbox do not require a client secret
for these sign-in flows.

### Configure Google Drive

1. Enable the Google Drive API in the app's Google Cloud project.
2. Create a **Web application** OAuth client.
3. Add `http://127.0.0.1:53682` as an authorized JavaScript origin.
4. Set the Google client ID in `public-creds.json`.

The app uses the `drive.file` permission. This limits access to files the app creates or
the user authorizes. Sign-in runs in the user's browser. It needs no hosted Lunarscribe
service.

Refer to
[Google's token model guide](https://developers.google.com/identity/oauth2/web/guides/use-token-model)
for details.

### Configure Dropbox

1. Create a scoped Dropbox application with **App folder** access.
2. Enable the permissions listed below.
3. Register `http://127.0.0.1:53683/oauth/dropbox` as a redirect URI.
4. Set the Dropbox app key in `public-creds.json`.

Required permissions:

- `account_info.read`
- `files.metadata.read`
- `files.metadata.write`
- `files.content.read`
- `files.content.write`

Refer to [Dropbox's OAuth guide](https://developers.dropbox.com/oauth-guide) for details.

### Code and checks

Sync code is in `apps/desktop/src/electron/sync/`:

- `sync-service.ts`: connections, status, and the five-minute schedule.
- `files.ts`: file comparisons and local file updates.
- `providers/`: GitHub, Google Drive, and Dropbox operations.
- `auth/`: browser sign-in and the Google sign-in page.
- `settings.ts` and `json.ts`: settings storage and JSON checks.

GitHub uses `git merge-tree --write-tree HEAD origin/<branch>` to check a merge. This
command does not change the working files. A conflict stops sync before the app applies
the merge.

Drive and Dropbox use SHA-256 hashes of the saved local writing, the downloaded remote
writing, and the shared base. The `baseline` object in `sync/sync-settings.json` stores
the last acknowledged hash for each filename. It stores one comparison base per file, not
a Git commit graph or earlier file versions. `planSync` in `files.ts` reports divergence
when a base exists and all three conditions are true:

```ts
localHash !== baseHash && remoteHash !== baseHash && localHash !== remoteHash;
```

An absent file has a `null` hash. Files with matching hashes become acknowledged versions.
Successful uploads, downloads, and forced replacements update the base. A conflict leaves
the previous base unchanged. First-sync comparisons use modification times because there
is no base yet.

Get the user data folder with `app.getPath("userData")`.

Run `bun run format`, `bun run lint`, `bun run check-types`, and `bun run build`. Before
release, check each provider with real accounts on two devices. Check connection,
reconnection, edits, deletion, conflicts, expired access, and network failures.
