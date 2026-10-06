# Privacy Policy

Effective date: October 6, 2026

Lunarscribe is a markdown writing app for desktop, web, and mobile. This policy explains
what data Lunarscribe uses and where that data goes.

## Summary

- Lunarscribe has no server. Its developers do not receive your writing, your account
  details, or your sign-in tokens.
- Your files stay on your device unless you turn on sync.
- If you turn on sync, your files go only to the provider you choose: GitHub, Google
  Drive, or Dropbox.
- Lunarscribe has no analytics, tracking, or advertising.

## Data stored on your device

Lunarscribe stores these items on your device:

- Your saved notes and drawings.
- Your app settings, such as theme and appearance.
- Sync settings, if you connect a provider: the provider name, your account email, the
  backup folder ID, sign-in tokens, and a hash of each file's last synced version.

The desktop app keeps these items in your documents folder and its user data folder. The
mobile app keeps them in its own storage. It keeps sign-in tokens in the iOS Keychain or
Android Keystore. The web app keeps them in your browser's storage.

You can delete this data at any time. Delete your files, or uninstall the app, or clear
the site data in your browser. **Disconnect** in Syncing removes the sync settings and
tokens.

## Sync providers

Sync is optional. When you connect a provider, Lunarscribe sends your saved notes and
drawings straight from your device to that provider. The data does not pass through any
Lunarscribe server.

### Google Drive

If you connect Google Drive, Lunarscribe asks for one permission, `drive.file`. It lets
Lunarscribe create, read, update, and delete only the files and folders that Lunarscribe
creates or that you open with it. Lunarscribe cannot see other files in your Drive.

Lunarscribe also reads your Google account email from Drive and shows it in Syncing, so
you know which account is connected.

Lunarscribe uses this access only to keep a backup of your notes and drawings in a folder
named `lunarscribe-bak-files` and to sync it with your devices. Lunarscribe does not use
Google user data for advertising, does not sell it, and does not transfer it to anyone. No
person reads it.

Lunarscribe's use and transfer of information received from Google APIs adheres to the
[Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy),
including the Limited Use requirements.

### Dropbox

If you connect Dropbox, Lunarscribe uses an App folder in your Dropbox. It reads and
writes only files in that folder. It also reads your account email to show which account
is connected.

### GitHub

If you connect GitHub, the desktop app uses the GitHub CLI already signed in on your
computer. It stores your files in a repository named `lunarscribe-bak-files` in your
account.

### Provider policies

Each provider handles your data under its own privacy policy:

- [Google Privacy Policy](https://policies.google.com/privacy)
- [Dropbox Privacy Policy](https://www.dropbox.com/privacy)
- [GitHub Privacy Statement](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement)

## Revoking access

To stop sync, select **Disconnect** in Settings → General → Syncing. You can also remove
Lunarscribe's access from your provider account:

- Google: <https://myaccount.google.com/permissions>
- Dropbox: <https://www.dropbox.com/account/connected_apps>
- GitHub: <https://github.com/settings/applications>

Removing access does not delete your backup. You can delete the `lunarscribe-bak-files`
folder or repository yourself.

## Children

Lunarscribe is not directed at children under 13 and does not knowingly collect data from
them.

## Changes to this policy

If this policy changes, the new version will be published at this location with a new
effective date.

## Contact

For questions about this policy, open an issue at
<https://github.com/anargia-pixels/lunarscribe/issues>.
