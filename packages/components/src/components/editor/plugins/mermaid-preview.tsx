import { errorMessage } from "@lunarscribe/utils/error-message";
import { useEffect, useRef } from "react";

let renderQueue = Promise.resolve();

let nextRenderId = 0;

export function MermaidPreview({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    let isCancelled = false;
    let revision = 0;
    let timeoutId: number | undefined;

    const isCurrent = (renderRevision: number) =>
      !isCancelled && revision === renderRevision;

    const renderDiagram = async (renderRevision: number) => {
      if (!isCurrent(renderRevision)) {
        return;
      }

      try {
        if (!code.trim()) {
          element.textContent = "Enter Mermaid text to preview a diagram.";
          delete element.dataset.mermaidError;

          return;
        }

        const { default: mermaid } = await import("mermaid");

        await document.fonts.ready;

        if (!isCurrent(renderRevision)) {
          return;
        }

        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          suppressErrorRendering: true,
          theme: document.documentElement.classList.contains("dark")
            ? "dark"
            : "default",
          fontFamily: "var(--font-buffer)",
        });

        const id = `mermaid-diagram-${++nextRenderId}`;
        const { svg } = await mermaid.render(id, code);

        if (!isCurrent(renderRevision)) {
          return;
        }

        // Mermaid sanitizes SVG in strict mode before returning it.
        element.innerHTML = svg;
        delete element.dataset.mermaidError;
      } catch (cause) {
        if (isCurrent(renderRevision)) {
          element.textContent = errorMessage(
            cause,
            "Unable to render Mermaid diagram.",
          );
          element.dataset.mermaidError = "true";
        }
      } finally {
        if (isCurrent(renderRevision)) {
          delete element.dataset.mermaidPending;
        }
      }
    };

    const scheduleRender = () => {
      const currentRevision = ++revision;

      window.clearTimeout(timeoutId);
      element.dataset.mermaidPending = "true";
      timeoutId = window.setTimeout(() => {
        // Mermaid shares configuration across renders. Serialize initialization
        // with rendering so concurrent blocks cannot change each other's theme.
        renderQueue = renderQueue.then(() => renderDiagram(currentRevision));
      }, 150);
    };

    scheduleRender();

    const observer = new MutationObserver(scheduleRender);

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });

    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [code]);

  return <div data-mermaid-render data-mermaid-pending="true" ref={ref} />;
}
