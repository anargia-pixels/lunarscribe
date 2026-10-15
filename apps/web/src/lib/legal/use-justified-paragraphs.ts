/** Justifies the legal paragraphs after the bundled fonts load. */

import { useNavigate } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef } from "react";

import { justifyParagraph } from "./justify";

/**
 * Justifies each paragraph in the element that gets the returned ref.
 * The server sends plain text, so the page works without script. The fit runs
 * after the fonts load and again when the width changes. On unmount, the hook
 * gives the original nodes back to React.
 */
export function useJustifiedParagraphs<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const navigate = useNavigate();

  // Send same-origin link clicks to the router; line copies have no handler.
  useEffect(() => {
    const root = ref.current;

    if (!root) {
      return;
    }

    const follow = (event: MouseEvent) => {
      const link =
        event.target instanceof Element ? event.target.closest("a") : null;

      if (
        !link ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        link.target ||
        link.hasAttribute("download") ||
        link.origin !== location.origin
      ) {
        return;
      }

      event.preventDefault();
      void navigate({ href: link.pathname + link.search + link.hash });
    };

    root.addEventListener("click", follow);

    return () => root.removeEventListener("click", follow);
  }, [navigate]);

  // Fit the paragraphs, and fit them again when the width changes.
  useLayoutEffect(() => {
    const root = ref.current;

    if (!root) {
      return;
    }

    const paragraphs = [...root.querySelectorAll("p")].map((host) => ({
      host,
      original: [...host.childNodes],
    }));

    const restore = () => {
      for (const { host, original } of paragraphs) {
        host.replaceChildren(...original);
      }
    };

    let ready = false;
    let disposed = false;
    let width = 0;
    let fittedWidth = 0;
    let frame = 0;

    const fit = () => {
      // Fit again only for a new width. This also stops a resize loop.
      if (!ready || width <= 0 || width === fittedWidth) {
        return;
      }

      fittedWidth = width;
      restore();

      for (const { host } of paragraphs) {
        justifyParagraph(host);
      }

      // Show the text. The server marks it pending to hide the ragged version.
      delete root.dataset.justify;
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    };

    const observer = new ResizeObserver(([entry]) => {
      width = entry?.contentRect.width ?? 0;
      schedule();
    });

    observer.observe(root);

    // Wait for Poppins. Fallback font metrics give wrong line breaks.
    void document.fonts
      .load('1rem "Poppins"')
      .then(() => document.fonts.ready)
      .then(() => {
        if (disposed) {
          return;
        }

        ready = true;
        schedule();
      });

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      restore();
    };
  }, []);

  return ref;
}
