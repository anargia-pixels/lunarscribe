import { createFileRoute, Outlet } from "@tanstack/react-router";

import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

export const Route = createFileRoute("/(site)")({
  component: SiteLayout,
});

/** The landing and legal pages' skeleton; the header overlays each page's top. */
function SiteLayout() {
  return (
    <div className="dark bg-sidebar text-foreground relative isolate min-h-full">
      <div className="absolute inset-x-0 top-0 z-10">
        <SiteHeader />
      </div>
      <Outlet />
      <SiteFooter />
    </div>
  );
}
