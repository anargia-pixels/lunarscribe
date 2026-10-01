import { Debouncer } from "@tanstack/pacer/debouncer";
import { create } from "zustand";
import { persist } from "zustand/middleware";

/** One open document; `markdown` is the source of truth the editor loads from and saves to. */
type TextBuffer = {
  id: string;
  title: string;
  markdown: string;
  /** Saved file in the documents folder, or null until the first save. */
  fileName: string | null;
};

type BufferStore = {
  buffers: TextBuffer[];
  activeId: string;
  /** File shown when the app last closed, reopened on launch; null for an unsaved buffer. */
  lastOpenedFileName: string | null;
  renameBuffer: (id: string, title: string) => void;
  setMarkdown: (id: string, markdown: string) => void;
  openFile: (name: string) => Promise<void>;
  createBuffer: (fileNames: string[]) => void;
  deleteFile: (name: string) => Promise<void>;
};

const WELCOME_MARKDOWN = `# Welcome to Lunarscribe

Type markdown shortcuts and they turn into rich text:

- \`# \` through \`###### \` for headings
- \`- \` or \`1. \` for lists
- \`> \` for quotes
- \`**bold**\`, \`*italic*\` and \`~~strike~~\` for inline marks
`;

/** Buffer titles are snake_case: lowercase, with whitespace and slashes turned into `_`. */
export function toBufferTitle(input: string) {
  return input.toLowerCase().replaceAll(/[\s/\\]/gu, "_");
}

function patchBuffer(
  buffers: TextBuffer[],
  id: string,
  patch:
    | Pick<TextBuffer, "title">
    | Pick<TextBuffer, "markdown">
    | Pick<TextBuffer, "fileName">,
) {
  return buffers.map((buffer) =>
    buffer.id === id ? { ...buffer, ...patch } : buffer,
  );
}

function createWelcomeBuffer(): TextBuffer {
  return {
    id: crypto.randomUUID(),
    title: "welcome",
    markdown: WELCOME_MARKDOWN,
    fileName: null,
  };
}

const initialBuffer = createWelcomeBuffer();

/**
 * Open buffers and the active selection; each edit is saved to disk 2s after typing stops.
 * Only `lastOpenedFileName` is persisted, since buffers themselves live on disk.
 */
export const useBufferStore = create<BufferStore>()(
  persist(
    (set, get) => ({
      buffers: [initialBuffer],
      activeId: initialBuffer.id,
      lastOpenedFileName: null,

      renameBuffer: (id, rawTitle) => {
        const title = toBufferTitle(rawTitle);

        set((state) => ({
          buffers: patchBuffer(state.buffers, id, { title }),
        }));
        scheduleSave(id);
      },

      setMarkdown: (id, markdown) => {
        set((state) => ({
          buffers: patchBuffer(state.buffers, id, { markdown }),
        }));
        scheduleSave(id);
      },

      openFile: async (name) => {
        const open = get().buffers.find((buffer) => buffer.fileName === name);

        if (open) {
          set({ activeId: open.id });

          return;
        }

        const markdown = await window.lunarscribe.readFile(name);

        const buffer: TextBuffer = {
          id: crypto.randomUUID(),
          title: name.replace(/\.md$/u, ""),
          markdown,
          fileName: name,
        };

        set((state) => ({
          buffers: [...state.buffers, buffer],
          activeId: buffer.id,
        }));
      },

      createBuffer: (fileNames) => {
        // An empty, never-saved buffer is reused instead of stacking up more untitled ones.
        const blank = get().buffers.find(
          (buffer) => buffer.fileName === null && !buffer.markdown.trim(),
        );

        if (blank) {
          set({ activeId: blank.id });

          return;
        }

        const taken = new Set([
          ...fileNames.map((name) => name.replace(/\.md$/u, "")),
          ...get().buffers.map((buffer) => buffer.title),
        ]);

        let title = "untitled";

        for (let suffix = 1; taken.has(title); suffix += 1) {
          title = `untitled_${suffix}`;
        }

        const buffer: TextBuffer = {
          id: crypto.randomUUID(),
          title,
          markdown: "",
          fileName: null,
        };

        set((state) => ({
          buffers: [...state.buffers, buffer],
          activeId: buffer.id,
        }));
      },

      deleteFile: async (name) => {
        await window.lunarscribe.deleteFile(name);

        const open = get().buffers.find((buffer) => buffer.fileName === name);

        if (!open) {
          return;
        }

        // Drop the buffer so a pending save doesn't recreate the file.
        saveDebouncers.get(open.id)?.cancel();
        saveDebouncers.delete(open.id);

        const buffers = get().buffers.filter((buffer) => buffer.id !== open.id);

        if (get().activeId !== open.id) {
          set({ buffers });

          return;
        }

        // Deleting the shown file falls back to the welcome text, reusing an untouched copy.
        const welcome =
          buffers.find(
            (buffer) =>
              buffer.fileName === null && buffer.markdown === WELCOME_MARKDOWN,
          ) ?? createWelcomeBuffer();

        set({
          buffers: buffers.includes(welcome) ? buffers : [...buffers, welcome],
          activeId: welcome.id,
        });
      },
    }),
    {
      name: "lunarscribe-buffers",
      partialize: (state) => ({ lastOpenedFileName: state.lastOpenedFileName }),
    },
  ),
);

// Tracks the shown buffer's file, so opening, saving under a new name and deleting all
// keep the persisted name current.
useBufferStore.subscribe((state) => {
  const fileName =
    state.buffers.find((buffer) => buffer.id === state.activeId)?.fileName ??
    null;

  if (fileName !== state.lastOpenedFileName) {
    useBufferStore.setState({ lastOpenedFileName: fileName });
  }
});

// Reopen the last file; if it is gone, the welcome buffer stays and the name is cleared.
const { lastOpenedFileName } = useBufferStore.getState();

if (lastOpenedFileName) {
  useBufferStore
    .getState()
    .openFile(lastOpenedFileName)
    .catch(() => useBufferStore.setState({ lastOpenedFileName: null }));
}

/** Writes the buffer's current title and markdown and records the file name it was saved as. */
async function saveBuffer(id: string) {
  const buffer = useBufferStore
    .getState()
    .buffers.find((candidate) => candidate.id === id);

  // A new buffer gets a file only once it has content.
  if (!buffer || (buffer.fileName === null && !buffer.markdown.trim())) {
    return;
  }

  const fileName = await window.lunarscribe.saveFile(
    buffer.fileName,
    buffer.title,
    buffer.markdown,
  );

  useBufferStore.setState((state) => ({
    buffers: patchBuffer(state.buffers, id, { fileName }),
  }));
}

const saveDebouncers = new Map<string, Debouncer<() => undefined>>();

/** Restarts the buffer's 2s save timer. */
function scheduleSave(id: string) {
  const debouncer =
    saveDebouncers.get(id) ??
    new Debouncer(() => void saveBuffer(id), { wait: 2000 });

  saveDebouncers.set(id, debouncer);
  debouncer.maybeExecute();
}

// Closing the window must not drop edits still waiting on their timer.
window.addEventListener("beforeunload", () => {
  for (const debouncer of saveDebouncers.values()) {
    debouncer.flush();
  }
});

/** Returns the buffer currently shown in the editor. */
export function useActiveBuffer() {
  return useBufferStore((state) =>
    state.buffers.find((buffer) => buffer.id === state.activeId),
  );
}
