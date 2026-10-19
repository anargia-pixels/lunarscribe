import { errorMessage } from "@lunarscribe/utils/error-message";
import type { Mounted } from "pele";
import { useEffect, useRef } from "react";

/**
 * Renders Mermaid text with Pele. Colors come from CSS variables, so theme
 * changes need no redraw. `interactive` adds zoom and pan.
 */
export function MermaidPreview({
  code,
  interactive = false,
}: {
  code: string;
  interactive?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mountedRef = useRef<Mounted>(undefined);

  useEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    let isCancelled = false;

    const unmount = () => {
      mountedRef.current?.destroy();
      mountedRef.current = undefined;
    };

    const renderDiagram = async () => {
      try {
        if (!code.trim()) {
          unmount();
          element.textContent = "Enter Mermaid text to preview a diagram.";
          delete element.dataset.mermaidError;

          return;
        }

        const { mount } = await import("pele");

        await document.fonts.ready;

        if (isCancelled) {
          return;
        }

        if (mountedRef.current) {
          mountedRef.current.update(code);
        } else {
          mountedRef.current = mount(element, code, {
            zoom: interactive,
            watch: false,
          });
        }

        delete element.dataset.mermaidError;
      } catch (cause) {
        if (!isCancelled) {
          unmount();
          element.textContent = errorMessage(
            cause,
            "Unable to render Mermaid diagram.",
          );
          element.dataset.mermaidError = "true";
        }
      } finally {
        if (!isCancelled) {
          delete element.dataset.mermaidPending;
        }
      }
    };

    element.dataset.mermaidPending = "true";

    // Rendering takes under a millisecond; the delay only keeps half-typed
    // definitions from flashing errors.
    const timeoutId = window.setTimeout(renderDiagram, 150);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [code, interactive]);

  // Pele's own watcher redraws a diagram synchronously on every width change,
  // which during a window or sidebar resize means every diagram on every frame.
  // Instead redraw once the width settles, and only near the viewport; an
  // off-screen diagram redraws when it scrolls into view.
  useEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    let width = element.clientWidth;
    let isVisible = false;
    let pending: (() => void) | null = null;
    let timeoutId: number | undefined;

    const redraw = (draw: () => void) => {
      if (isVisible) {
        pending = null;
        draw();
      } else {
        pending = draw;
      }
    };

    const fit = () => mountedRef.current?.fit();
    const refresh = () => mountedRef.current?.refresh();

    const resizeObserver = new ResizeObserver(([entry]) => {
      const nextWidth = entry?.contentRect.width ?? width;

      if (nextWidth === width) {
        return;
      }

      width = nextWidth;
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(
        () => redraw(pending === refresh ? refresh : fit),
        150,
      );
    });

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry?.isIntersecting ?? false;

        if (isVisible && pending) {
          redraw(pending);
        }
      },
      { rootMargin: "50%" },
    );

    // Pele measures labels with the buffer font, so measure again when the
    // appearance styles change it.
    const styleObserver = new MutationObserver(() => redraw(refresh));

    resizeObserver.observe(element);
    intersectionObserver.observe(element);
    styleObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style"],
    });

    return () => {
      window.clearTimeout(timeoutId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      styleObserver.disconnect();
    };
  }, []);

  useEffect(() => () => mountedRef.current?.destroy(), []);

  return <div data-mermaid-render data-mermaid-pending="true" ref={ref} />;
}
