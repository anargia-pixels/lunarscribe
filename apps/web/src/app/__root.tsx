import { TanStackDevtools } from "@tanstack/react-devtools";
import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

import { SITE_URL } from "@/lib/seo";

import appCss from "@/app/globals.css?url";

/** The 1200×630 social preview image every page shares. */
const OG_IMAGE_URL = `${SITE_URL}/landing/og.jpg`;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Lunarscribe",
      },
      // The app ships its own dark theme, so Dark Reader stays off.
      { name: "darkreader-lock" },
      { name: "theme-color", content: "#181825" },
      // Social previews; each page adds its own title, description and URL.
      { property: "og:site_name", content: "Lunarscribe" },
      { property: "og:type", content: "website" },
      { property: "og:image", content: OG_IMAGE_URL },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      {
        property: "og:image:alt",
        content: "Lunarscribe, an Obsidian OSS alternative",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: OG_IMAGE_URL },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", type: "image/x-icon", href: "/icons/icon.ico" },
      {
        rel: "icon",
        type: "image/png",
        sizes: "32x32",
        href: "/icons/32x32.png",
      },
      { rel: "apple-touch-icon", sizes: "256x256", href: "/icons/256x256.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  );
}
