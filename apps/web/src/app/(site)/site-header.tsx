import { Button } from "@lunarscribe/components/ui/button";
import { Link } from "@tanstack/react-router";

import { EXTERNAL_LINKS } from "@/lib/external-links";

/** The logo and the GitHub and web app links. */
export function SiteHeader() {
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
      <Link to="/" className="font-logo text-primary text-3xl">
        Lunarscribe
      </Link>
      <nav className="flex items-center gap-1">
        <Button
          variant="ghost"
          className="max-sm:hidden"
          nativeButton={false}
          render={<Link to={EXTERNAL_LINKS.repository} />}
        >
          GitHub
        </Button>
        <Button nativeButton={false} render={<Link to="/app" />}>
          Open web app
        </Button>
      </nav>
    </header>
  );
}
