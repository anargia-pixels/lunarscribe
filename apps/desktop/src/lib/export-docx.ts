import type { FileTarget } from "@/lib/editor-files";
import { withMarkdownSnapshot } from "@/lib/markdown-export";

/** Load the Word converter on demand so ordinary editing does not pay its startup cost. */
export async function exportDocx(target: FileTarget) {
  const [{ createDocxDocument }, { Packer }] = await Promise.all([
    import("@lunarscribe/components/lib/docx-document"),
    import("docx"),
  ]);

  return withMarkdownSnapshot(target, async (root, title) => {
    const bytes = new Uint8Array(
      await Packer.toArrayBuffer(createDocxDocument(root, title)),
    );

    return window.lunarscribe.exportDocx(title, bytes);
  });
}
