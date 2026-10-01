import "@/app/globals.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import RootLayout from "@/app/layout";
import Page from "@/app/page";

// Excalidraw loads its fonts from the copy bundled next to index.html (see
// electron.vite.config.ts) instead of its CDN, so drawings render offline.
window.EXCALIDRAW_ASSET_PATH = new URL("./", window.location.href).href;

if (import.meta.env.DEV) {
  void import("react-grab");
}

const container = document.getElementById("root");

if (!container) {
  throw new Error("Missing #root element in index.html");
}

createRoot(container).render(
  <StrictMode>
    <RootLayout>
      <Page />
    </RootLayout>
  </StrictMode>,
);
