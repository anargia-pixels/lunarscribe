import {
  deleteRecord,
  getAllRecords,
  getRecord,
  putRecord,
  withStore,
} from "@/lib/browser-database";
import {
  INVALID_FILE_TITLE_CHARACTERS,
  getFileExtension,
  isTextFile,
} from "@/lib/editor-files";
import type { ExternalFile } from "@/lib/editor-files";
import { createOperationQueue } from "@/lib/operation-queue";

/**
 * External files are text files the user picked or dropped. Browsers expose no paths, so
 * each file is a File System Access handle stored in IndexedDB under a generated ID.
 * Without that API (Firefox, Safari) text files are imported into browser storage instead.
 */

export type OpenedExternalFile = ExternalFile & { markdown: string };

const queueFileWrite = createOperationQueue();

/** Whether this browser can write edits back to files outside browser storage. */
export const canAccessExternalFiles = "showOpenFilePicker" in window;

export const TEXT_FILE_PICKER_TYPES = [
  {
    description: "Markdown or text",
    accept: { "text/markdown": [".md", ".markdown"], "text/plain": [".txt"] },
  },
];

/** Asks for read and write access; browsers prompt only during a click or key press. */
async function ensureAccess(handle: FileSystemFileHandle) {
  const descriptor = { mode: "readwrite" } as const;

  if ((await handle.queryPermission?.(descriptor)) === "granted") {
    return;
  }

  if ((await handle.requestPermission?.(descriptor)) !== "granted") {
    throw new Error(
      `Access to "${handle.name}" was not granted. Select the file in the sidebar to allow access again.`,
    );
  }
}

async function readHandle(handle: FileSystemFileHandle) {
  if (!isTextFile(handle.name)) {
    throw new Error("Choose a local .md, .markdown, or .txt file.");
  }

  await ensureAccess(handle);

  return (await handle.getFile()).text();
}

export async function listExternalFiles(): Promise<ExternalFile[]> {
  const records = await withStore("external-files", "readonly", (store) =>
    getAllRecords<"external-files">(store),
  );

  return records.map(({ id, name }) => ({ id, name }));
}

async function readExternalRecord(id: string) {
  const record = await withStore("external-files", "readonly", (store) =>
    getRecord<"external-files">(store, id),
  );

  if (!record) {
    throw new Error("The external file is no longer tracked.");
  }

  return record;
}

/** Tracks a newly opened handle, reusing the ID of a handle that points at the same file. */
export async function openExternalHandle(
  handle: FileSystemFileHandle,
): Promise<OpenedExternalFile> {
  const markdown = await readHandle(handle);

  const records = await withStore("external-files", "readonly", (store) =>
    getAllRecords<"external-files">(store),
  );

  for (const record of records) {
    if (await record.handle.isSameEntry(handle)) {
      return { id: record.id, name: record.name, markdown };
    }
  }

  const file = { id: crypto.randomUUID(), name: handle.name };

  await withStore("external-files", "readwrite", (store) =>
    putRecord<"external-files">(store, { ...file, handle }),
  );

  return { ...file, markdown };
}

export async function readExternalFile(
  id: string,
): Promise<OpenedExternalFile> {
  const record = await readExternalRecord(id);

  return {
    id,
    name: record.name,
    markdown: await readHandle(record.handle),
  };
}

export function saveExternalFile(id: string, markdown: string) {
  return queueFileWrite(id, async () => {
    const { handle } = await readExternalRecord(id);

    await ensureAccess(handle);

    const writable = await handle.createWritable();

    try {
      await writable.write(markdown);
      await writable.close();
    } catch (cause) {
      await writable.abort();

      throw cause;
    }
  });
}

/** Renames the file on disk; only Chromium's `move` can rename outside browser storage. */
export function renameExternalFile(id: string, title: string) {
  return queueFileWrite(id, async (): Promise<ExternalFile> => {
    const record = await readExternalRecord(id);

    const stem = title.trim().replaceAll(INVALID_FILE_TITLE_CHARACTERS, "_");

    if (!stem) {
      throw new Error("Enter a name for the file.");
    }

    const name = `${stem}${getFileExtension(record.name) ?? ".md"}`;

    if (name === record.name) {
      return { id, name };
    }

    if (!record.handle.move) {
      throw new Error("This browser cannot rename files outside Lunarscribe.");
    }

    await ensureAccess(record.handle);
    await record.handle.move(name);
    await withStore("external-files", "readwrite", (store) =>
      putRecord<"external-files">(store, { ...record, name }),
    );

    return { id, name };
  });
}

/** Stops tracking the file; the file itself stays where it is. */
export function forgetExternalFile(id: string) {
  return withStore("external-files", "readwrite", (store) =>
    deleteRecord(store, id),
  );
}

/** Files the user picked; `handles` stay writable, `files` are copies to import. */
export type PickedTextFiles = {
  handles: FileSystemFileHandle[];
  files: File[];
};

/** Shows the browser's file picker; resolves with nothing picked when cancelled. */
export async function pickTextFiles(): Promise<PickedTextFiles> {
  if (window.showOpenFilePicker) {
    try {
      const handles = await window.showOpenFilePicker({
        multiple: true,
        types: TEXT_FILE_PICKER_TYPES,
      });

      return { handles, files: [] };
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") {
        return { handles: [], files: [] };
      }

      throw cause;
    }
  }

  // Without the File System Access API, a file input gives read-only copies.
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.accept = ".md,.markdown,.txt,text/markdown,text/plain";

  return new Promise((resolve) => {
    input.addEventListener("change", () =>
      resolve({ handles: [], files: Array.from(input.files ?? []) }),
    );
    input.addEventListener("cancel", () => resolve({ handles: [], files: [] }));
    input.click();
  });
}
