/** Saves `blob` through the browser's download flow and returns the suggested file name. */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  // Give the browser time to start the download before releasing the blob.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);

  return fileName;
}
