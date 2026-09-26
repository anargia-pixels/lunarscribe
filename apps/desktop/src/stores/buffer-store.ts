import { create } from "zustand";

/** One open document; `markdown` is the source of truth the editor loads from and saves to. */
export type TextBuffer = {
  id: string;
  title: string;
  markdown: string;
};

type BufferStore = {
  buffers: TextBuffer[];
  activeId: string;
  renameBuffer: (id: string, title: string) => void;
  setMarkdown: (id: string, markdown: string) => void;
};

const WELCOME_MARKDOWN = `# Welcome to Lunarscribe

Type markdown shortcuts and they turn into rich text:

- \`# \` through \`###### \` for headings
- \`- \` or \`1. \` for lists
- \`> \` for quotes
- \`**bold**\`, \`*italic*\` and \`~~strike~~\` for inline marks
`;

function patchBuffer(
  buffers: TextBuffer[],
  id: string,
  patch: Pick<TextBuffer, "title"> | Pick<TextBuffer, "markdown">,
) {
  return buffers.map((buffer) =>
    buffer.id === id ? { ...buffer, ...patch } : buffer,
  );
}

const initialBuffer: TextBuffer = {
  id: crypto.randomUUID(),
  title: "Welcome",
  markdown: WELCOME_MARKDOWN,
};

/** Open buffers and the active selection. In memory only; nothing is written to disk. */
export const useBufferStore = create<BufferStore>()((set) => ({
  buffers: [initialBuffer],
  activeId: initialBuffer.id,

  renameBuffer: (id, title) =>
    set((state) => ({ buffers: patchBuffer(state.buffers, id, { title }) })),

  setMarkdown: (id, markdown) =>
    set((state) => ({ buffers: patchBuffer(state.buffers, id, { markdown }) })),
}));

/** Returns the buffer currently shown in the editor. */
export function useActiveBuffer() {
  return useBufferStore((state) =>
    state.buffers.find((buffer) => buffer.id === state.activeId),
  );
}
