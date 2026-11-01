import { ActionDialog } from "@lunarscribe/components/action-dialog/action-dialog";
import { useAsyncAction } from "@lunarscribe/components/hooks/use-async-action";
import { Input } from "@lunarscribe/components/ui/input";
import { Label } from "@lunarscribe/components/ui/label";
import { useId, useState } from "react";

/** Names a new folder or renames one, and reports failures without closing. */
export function FolderNameDialog({
  title,
  description,
  confirmLabel,
  initialName = "",
  onClose,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  initialName?: string;
  onClose: () => void;
  onConfirm: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(initialName);

  const { run, isPending, error } = useAsyncAction(
    "Unable to save the folder.",
  );

  const inputId = useId();

  return (
    <ActionDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      pending={isPending}
      error={error}
      disabled={!name.trim()}
      onConfirm={() =>
        void run(async () => {
          await onConfirm(name.trim());
          onClose();
        })
      }
    >
      <div className="grid gap-2">
        <Label htmlFor={inputId}>Name</Label>
        <Input
          id={inputId}
          value={name}
          disabled={isPending}
          onChange={(event) => setName(event.target.value)}
          onFocus={(event) => event.target.select()}
          required
        />
      </div>
    </ActionDialog>
  );
}
