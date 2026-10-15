import { useEffect } from "react";

// Types

type FiberRoot = { containerInfo: object };

type CommitHandler = (
  rendererId: number,
  root: FiberRoot,
  priority?: number,
) => void;

declare global {
  interface Window {
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: { onCommitFiberRoot?: CommitHandler };
  }
}

// Page state

/** Shadow roots that hold Mesurer. react-scan ignores their renders. */
const mesurerRoots = new WeakSet<object>();

/** The react-scan start, shared by all mounts. */
let scanning: Promise<void> | undefined;

/** True after the commit hook skips Mesurer commits. */
let filtering = false;

// Helpers

/** Loads react-grab and starts react-scan one time for each page. */
function startScan() {
  scanning ??= (async () => {
    await import("react-grab");
    const { scan } = await import("react-scan");

    scan();
  })();

  return scanning;
}

/**
 * Wraps the React DevTools commit hook to drop Mesurer commits before
 * react-scan and react-grab get them. Call it after scan(), because it wraps
 * the handler that scan() installs.
 */
function skipMesurerCommits() {
  const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  const forward = hook?.onCommitFiberRoot;

  if (filtering || !hook || !forward) {
    return;
  }

  filtering = true;
  hook.onCommitFiberRoot = (rendererId, root, priority) => {
    if (mesurerRoots.has(root.containerInfo)) {
      return;
    }

    forward.call(hook, rendererId, root, priority);
  };
}

// Component

/**
 * Loads the development overlays. react-grab copies the component and source
 * of an element, react-scan shows renders, and Mesurer measures the layout.
 * Render it only behind a development check, such as `import.meta.env.DEV`, so
 * production builds drop it and the tools it loads.
 */
export function DevTools() {
  useEffect(() => {
    // Mesurer gets its own shadow root and React root, apart from the app.
    const host = document.createElement("div");

    host.style.display = "contents";

    const shadowRoot = host.attachShadow({ mode: "open" });

    document.body.append(host);

    let unmount: (() => void) | undefined;
    let cancelled = false;

    void Promise.all([
      import("react-dom/client"),
      import("mesurer"),
      startScan(),
    ]).then(([{ createRoot }, { Mesurer }]) => {
      if (cancelled) {
        return;
      }

      skipMesurerCommits();
      mesurerRoots.add(shadowRoot);

      const root = createRoot(shadowRoot);

      root.render(
        <Mesurer
          initialState={{
            enabled: false, // do not take the page's clicks; M turns it on
            minimized: true, // show only a small button
          }}
          portalTarget={shadowRoot}
        />,
      );
      unmount = () => root.unmount();
    });

    return () => {
      cancelled = true;
      // Unmount later. React warns when a root unmounts during a render.
      queueMicrotask(() => unmount?.());
      host.remove();
    };
  }, []);

  return null;
}
