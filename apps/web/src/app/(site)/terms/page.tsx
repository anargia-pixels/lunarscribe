import { createFileRoute } from "@tanstack/react-router";

import { InlineLink } from "@/components/inline-link";
import {
  LegalHeading,
  LegalList,
  LegalDocument,
} from "@/components/legal-document";
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
    <LegalDocument title="Terms of Service" effectiveDate="October 6, 2026">
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
        it.
      </p>
      <p>
        You are responsible for your content and for keeping your own backups.
        Sync is a convenience, not a guaranteed backup.
      </p>

      <LegalHeading>Sync providers</LegalHeading>
      <p>
        Sync with GitHub, Google Drive, or Dropbox is optional. When you connect
        a provider, your use of that service follows the provider's own terms:
      </p>
      <LegalList>
        <li>
          <InlineLink to="https://policies.google.com/terms">
            Google Terms of Service
          </InlineLink>
        </li>
        <li>
          <InlineLink to="https://www.dropbox.com/terms">
            Dropbox Terms of Service
          </InlineLink>
        </li>
        <li>
          <InlineLink to="https://docs.github.com/site-policy/github-terms/github-terms-of-service">
            GitHub Terms of Service
          </InlineLink>
        </li>
      </LegalList>
      <p>
        Lunarscribe is not affiliated with or endorsed by Google, Dropbox, or
        GitHub.
      </p>

      <LegalHeading>Privacy</LegalHeading>
      <p>
        The <InlineLink to="/privacy">Privacy Policy</InlineLink> explains what
        data Lunarscribe uses and where it goes.
      </p>

      <LegalHeading>No warranty</LegalHeading>
      <p>
        Lunarscribe is provided "as is", without warranty of any kind. Its
        developers do not promise that it will be free of errors, that sync will
        always succeed, or that your data will never be lost or overwritten.
      </p>

      <LegalHeading>Limitation of liability</LegalHeading>
      <p>
        To the extent the law allows, the developers of Lunarscribe are not
        liable for any loss of data, profits, or other damages that come from
        using or being unable to use Lunarscribe.
      </p>

      <LegalHeading>Changes</LegalHeading>
      <p>
        These terms may change. The new version will be published at this
        location with a new effective date. If you keep using Lunarscribe after
        a change, you accept the new terms.
      </p>

      <LegalHeading>Contact</LegalHeading>
      <p>
        For questions about these terms, open an issue at{" "}
        <InlineLink to="https://github.com/anargia-pixels/lunarscribe/issues">
          https://github.com/anargia-pixels/lunarscribe/issues
        </InlineLink>
        .
      </p>
    </LegalDocument>
  );
}
