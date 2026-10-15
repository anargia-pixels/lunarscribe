import { createFileRoute, Link } from "@tanstack/react-router";

import {
  LegalCode,
  LegalHeading,
  LegalList,
  LegalDocument,
  LegalSubheading,
} from "@/components/legal-document";
import { EXTERNAL_LINKS } from "@/lib/external-links";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/(site)/privacy/")({
  head: () =>
    pageHead({
      title: "Privacy Policy | Lunarscribe",
      description:
        "What data Lunarscribe uses and where it goes: your writing stays on your device, no analytics, and sync only to the provider you choose.",
      path: "/privacy",
    }),
  component: PrivacyPolicy,
});

/** Mirrors privacy-policy.md at the repository root; keep the two in sync. */
function PrivacyPolicy() {
  return (
    <LegalDocument title="Privacy Policy" effectiveDate="October 16, 2026">
      <p>
        Lunarscribe is a markdown writing app for desktop, web, and mobile. This
        policy explains what data Lunarscribe uses and where that data goes.
      </p>

      <LegalHeading>Summary</LegalHeading>
      <LegalList>
        <li>
          Lunarscribe has no server that receives your data. Its developers do
          not receive your writing, your account details, or your sign-in
          tokens.
        </li>
        <li>Your files stay on your device unless you turn on sync.</li>
        <li>
          If you turn on sync, your files go only to the provider you choose:
          GitHub, Google Drive, or Dropbox.
        </li>
        <li>Lunarscribe has no analytics, tracking, or advertising.</li>
      </LegalList>

      <LegalHeading>Data stored on your device</LegalHeading>
      <p>
        Lunarscribe keeps a small amount of data on your device, and it stays
        there unless you turn on sync. None of it reaches a Lunarscribe server:
      </p>
      <LegalList>
        <li>Your saved notes and drawings.</li>
        <li>Your app settings, such as theme and appearance.</li>
        <li>
          Sync settings, if you connect a provider: the provider name, your
          account email, the backup folder ID, sign-in tokens, and a hash of
          each file&apos;s last synced version.
        </li>
      </LegalList>
      <p>
        The desktop app keeps these items in your documents folder and its user
        data folder. The mobile app keeps them in its own storage. It keeps
        sign-in tokens in the iOS Keychain or Android Keystore, and the web app
        keeps them in your browser&apos;s storage. You can delete this data at
        any time: delete your files, or uninstall the app, or clear the site
        data in your browser. Disconnect in Syncing removes the sync settings
        and tokens.
      </p>

      <LegalHeading>Website hosting</LegalHeading>
      <p>
        Cloudflare hosts the Lunarscribe website and web app at
        lunarscribe.doctorthe113.com. The site sends your browser its pages and
        files. It does not receive or store your notes, drawings, settings, or
        sign-in tokens. Cloudflare may process technical request data, such as
        your IP address and browser type, to deliver and protect the site. The{" "}
        <Link to={EXTERNAL_LINKS.cloudflarePrivacy}>
          Cloudflare Privacy Policy
        </Link>{" "}
        covers that data.
      </p>

      <LegalHeading>Sync providers</LegalHeading>
      <p>
        Sync is optional. When you connect a provider, Lunarscribe sends your
        saved notes and drawings straight from your device to that provider. The
        data does not pass through any Lunarscribe server.
      </p>

      <LegalSubheading>Google Drive</LegalSubheading>
      <p>
        If you connect Google Drive, Lunarscribe asks for one permission,{" "}
        <LegalCode>drive.file</LegalCode>. It lets Lunarscribe create, read,
        update, and delete only the files and folders that Lunarscribe creates
        or that you open with it. Lunarscribe cannot see other files in your
        Drive. It also reads your Google account email from Drive and shows it
        in Syncing, so you know which account is connected.
      </p>
      <p>
        Lunarscribe uses this access only to keep a backup of your notes and
        drawings in a folder named lunarscribe-bak-files and to sync it with
        your devices. Lunarscribe does not use Google user data for advertising,
        does not sell it, and does not transfer it to anyone. No person reads
        it. Lunarscribe&apos;s use and transfer of information received from
        Google APIs adheres to the{" "}
        <Link to={EXTERNAL_LINKS.googleApiDataPolicy}>
          Google API Services User Data Policy
        </Link>
        , including the Limited Use requirements.
      </p>

      <LegalSubheading>Dropbox</LegalSubheading>
      <p>
        If you connect Dropbox, Lunarscribe uses an App folder in your Dropbox.
        It reads and writes only files in that folder. It also reads your
        account email to show which account is connected.
      </p>

      <LegalSubheading>GitHub</LegalSubheading>
      <p>
        If you connect GitHub, the desktop app uses the GitHub CLI already
        signed in on your computer. It stores your files in a repository named
        lunarscribe-bak-files in your account.
      </p>

      <LegalSubheading>Provider policies</LegalSubheading>
      <p>
        Each provider handles the data you send it under its own privacy policy,
        and that policy applies instead of this one for that data:
      </p>
      <LegalList>
        <li>
          <Link to={EXTERNAL_LINKS.googlePrivacy}>Google Privacy Policy</Link>
        </li>
        <li>
          <Link to={EXTERNAL_LINKS.dropboxPrivacy}>Dropbox Privacy Policy</Link>
        </li>
        <li>
          <Link to={EXTERNAL_LINKS.githubPrivacy}>
            GitHub Privacy Statement
          </Link>
        </li>
      </LegalList>

      <LegalHeading>Revoking access</LegalHeading>
      <p>
        To stop sync, select Disconnect in Settings → General → Syncing.
        Removing access does not delete your backup, so you can delete the
        lunarscribe-bak-files folder or repository yourself when you are ready.
        You can also remove Lunarscribe&apos;s access from your provider
        account:
      </p>
      <LegalList>
        <li>
          Google:{" "}
          <Link to={EXTERNAL_LINKS.googlePermissions}>
            https://myaccount.google.com/permissions
          </Link>
        </li>
        <li>
          Dropbox:{" "}
          <Link to={EXTERNAL_LINKS.dropboxConnectedApps}>
            https://www.dropbox.com/account/connected_apps
          </Link>
        </li>
        <li>
          GitHub:{" "}
          <Link to={EXTERNAL_LINKS.githubApplications}>
            https://github.com/settings/applications
          </Link>
        </li>
      </LegalList>

      <LegalHeading>Children</LegalHeading>
      <p>
        Lunarscribe is not directed at children under 13 and does not knowingly
        collect data from them. Because no Lunarscribe server receives your
        data, there is nowhere for such data to be sent.
      </p>

      <LegalHeading>Changes and contact</LegalHeading>
      <p>
        If this policy changes, the new version will be published at this
        location with a new effective date. For questions about this policy,
        open an issue in the{" "}
        <Link to={EXTERNAL_LINKS.issues}>Lunarscribe issue tracker</Link>.
      </p>
    </LegalDocument>
  );
}
