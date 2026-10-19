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
          mountedRef.current = mount(element, code, { zoom: interactive });
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

    // Pele measures labels with the buffer font, so measure again when the
    // appearance styles change it.
    const observer = new MutationObserver(() => mountedRef.current?.refresh());

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style"],
    });

    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [code, interactive]);

  useEffect(() => () => mountedRef.current?.destroy(), []);

  return <div data-mermaid-render data-mermaid-pending="true" ref={ref} />;
}
