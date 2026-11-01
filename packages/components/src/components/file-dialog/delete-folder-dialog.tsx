import { ConfirmationDialog } from "@lunarscribe/components/confirmation-dialog/confirmation-dialog";
import { useAsyncAction } from "@lunarscribe/components/hooks/use-async-action";

/** Confirms deleting a folder with everything in it, keeping failures in the dialog. */
export function DeleteFolderDialog({
  name,
  fileCount,
  onClose,
  onDelete,
}: {
  name: string;
  fileCount: number;
  onClose: () => void;
  onDelete: () => Promise<void>;
}) {
  const { run, isPending, error } = useAsyncAction(
    "Unable to delete the folder.",
  );

  const contents =
    fileCount === 0
      ? "this empty folder"
      : `it and the ${fileCount === 1 ? "file" : `${fileCount} files`} inside`;

  return (
    <ConfirmationDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      title="Delete folder?"
      description={`Are you sure you want to delete “${name}”? This deletes ${contents}, and cannot be undone.`}
      confirmLabel="Delete"
      pending={isPending}
      error={error}
      onConfirm={() =>
        void run(async () => {
          await onDelete();
          onClose();
        })
      }
    />
  );
}
