import { Button } from "@lunarscribe/components/ui/button";
import { Separator } from "@lunarscribe/components/ui/separator";
import { Link } from "@tanstack/react-router";

import { EXTERNAL_LINKS } from "@/lib/external-links";

/** The logo and the legal and source links. */
export function SiteFooter() {
  return (
    <>
      <Separator />
      <footer className="text-muted-foreground mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm">
        <Link to="/" className="font-logo text-primary text-xl">
          Lunarscribe
        </Link>
        <nav className="flex flex-wrap items-center gap-1">
          <Button
            variant="link"
            nativeButton={false}
            render={<Link to="/privacy" />}
          >
            Privacy Policy
          </Button>
          <Button
            variant="link"
            nativeButton={false}
            render={<Link to="/terms" />}
          >
            Terms of Service
          </Button>
          <Button
            variant="link"
            nativeButton={false}
            render={<Link to={EXTERNAL_LINKS.repository} />}
          >
            Source on GitHub
          </Button>
        </nav>
      </footer>
    </>
  );
}
