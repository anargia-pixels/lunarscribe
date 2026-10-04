import { downloadBlob } from "@/lib/download";
import type { FileTarget } from "@/lib/editor-files";
import { withMarkdownSnapshot } from "@/lib/markdown-export";

/** Load the Word converter on demand so ordinary editing does not pay its startup cost. */
export async function exportDocx(target: FileTarget) {
  const [{ createDocxDocument }, { Packer }] = await Promise.all([
    import("./docx-document"),
    import("docx"),
  ]);

  return withMarkdownSnapshot(target, async (root, title) => {
    const blob = await Packer.toBlob(createDocxDocument(root, title));

    return downloadBlob(blob, `${title || "untitled"}.docx`);
  });
}
