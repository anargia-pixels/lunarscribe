import { createFileRoute, Link } from "@tanstack/react-router";

import {
  LegalHeading,
  LegalList,
  LegalDocument,
} from "@/components/legal-document";
import { EXTERNAL_LINKS } from "@/lib/external-links";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/(site)/terms/")({
  head: () =>
    pageHead({
      title: "Terms of Service | Lunarscribe",
      description:
        "The terms for using Lunarscribe, the open source markdown writing app.",
      path: "/terms",
    }),
  component: TermsOfService,
});

/** Mirrors terms-of-service.md at the repository root; keep the two in sync. */
function TermsOfService() {
  return (
    <LegalDocument title="Terms of Service" effectiveDate="October 16, 2026">
      <p>
        These terms apply when you use Lunarscribe, a markdown writing app for
        desktop, web, and mobile. By using Lunarscribe, you agree to these
        terms.
      </p>

      <LegalHeading>Using Lunarscribe</LegalHeading>
      <p>
        You may use Lunarscribe for personal or commercial writing. Do not use
        it to break the law or to break the terms of a sync provider.
      </p>

      <LegalHeading>Your content</LegalHeading>
      <p>
        You own everything you write and draw in Lunarscribe. Lunarscribe does
        not claim any rights to your content, and its developers do not receive
        it. You are responsible for your content and for keeping your own
        backups, because sync is a convenience and not a guaranteed backup. The{" "}
        <Link to="/privacy">Privacy Policy</Link> explains what data Lunarscribe
        uses and where that data goes.
      </p>

      <LegalHeading>Sync providers</LegalHeading>
      <p>
        Sync with GitHub, Google Drive, or Dropbox is optional. When you connect
        a provider, your use of that service follows the provider&apos;s own
        terms. Lunarscribe is not affiliated with or endorsed by Google,
        Dropbox, or GitHub.
      </p>
      <LegalList>
        <li>
          <Link to={EXTERNAL_LINKS.googleTerms}>Google Terms of Service</Link>
        </li>
        <li>
          <Link to={EXTERNAL_LINKS.dropboxTerms}>Dropbox Terms of Service</Link>
        </li>
        <li>
          <Link to={EXTERNAL_LINKS.githubTerms}>GitHub Terms of Service</Link>
        </li>
      </LegalList>

      <LegalHeading>No warranty</LegalHeading>
      <p>
        Lunarscribe is provided &quot;as is&quot;, without warranty of any kind.
        Its developers do not promise that it will be free of errors, that sync
        will always succeed, or that your data will never be lost or
        overwritten.
      </p>

      <LegalHeading>Limitation of liability</LegalHeading>
      <p>
        To the extent the law allows, the developers of Lunarscribe are not
        liable for any loss of data, profits, or other damages that come from
        using or being unable to use Lunarscribe.
      </p>

      <LegalHeading>License</LegalHeading>
      <p>
        Lunarscribe is open source software licensed under the{" "}
        <Link to={EXTERNAL_LINKS.agpl}>
          GNU Affero General Public License v3.0
        </Link>{" "}
        or any later version. The license covers the software&apos;s source
        code. It does not cover your content, and it does not replace these
        terms. You may use, copy, change, and redistribute Lunarscribe for any
        purpose, including commercial ones, and the source code is published in
        the <Link to={EXTERNAL_LINKS.repository}>Lunarscribe repository</Link>.
      </p>
      <p>
        If you change Lunarscribe and let others interact with your version over
        a network, such as a hosted copy, a web app, or an API, you must offer
        those users the complete source code of your version.
      </p>

      <LegalHeading>Changes and contact</LegalHeading>
      <p>
        These terms may change. The new version will be published at this
        location with a new effective date, and if you keep using Lunarscribe
        after a change, you accept the new terms. For questions about these
        terms, open an issue in the{" "}
        <Link to={EXTERNAL_LINKS.issues}>Lunarscribe issue tracker</Link>.
      </p>
    </LegalDocument>
  );
}
