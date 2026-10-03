import { ConfirmationDialog } from "@lunarscribe/components/confirmation-dialog/confirmation-dialog";
import { useAsyncAction } from "@lunarscribe/components/hooks/use-async-action";

/** Keeps deletion failures in the confirmation dialog so the user can retry. */
export function DeleteFileDialog({
  name,
  onClose,
  onDelete,
}: {
  name: string;
  onClose: () => void;
  onDelete: () => Promise<void>;
}) {
  const { run, isPending, error } = useAsyncAction(
    "Unable to delete the file.",
  );

  return (
    <ConfirmationDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      title="Delete file?"
      description={`Are you sure you want to delete “${name}”? This cannot be undone.`}
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
