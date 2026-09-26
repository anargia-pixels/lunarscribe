import "@/app/globals.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import RootLayout from "@/app/layout";
import Page from "@/app/page";

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
