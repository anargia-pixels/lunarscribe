import { createFileRoute } from "@tanstack/react-router";

/** The installer script on the default branch, as the readme's raw URL serves it. */
const INSTALL_SCRIPT_URL =
  "https://raw.githubusercontent.com/anargia-pixels/lunarscribe/main/install.sh";

// `curl -fsSL <origin>/install | bash` follows this redirect to the script.
export const Route = createFileRoute("/install")({
  server: {
    handlers: {
      GET: () => Response.redirect(INSTALL_SCRIPT_URL, 302),
    },
  },
});
