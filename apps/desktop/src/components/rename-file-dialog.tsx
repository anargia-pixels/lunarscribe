import { ActionDialog } from "@lunarscribe/components/action-dialog/action-dialog";
import { useAsyncAction } from "@lunarscribe/components/hooks/use-async-action";
import { Input } from "@lunarscribe/components/ui/input";
import { Label } from "@lunarscribe/components/ui/label";
import { useId, useState } from "react";

import { stemOf } from "@/stores/buffer-store";

/** Edits the name while keeping the extension, and reports failures without closing. */
export function RenameFileDialog({
  name,
  onClose,
  onRename,
}: {
  name: string;
  onClose: () => void;
  onRename: (title: string) => Promise<void>;
}) {
  const [title, setTitle] = useState(stemOf(name));

  const { run, isPending, error } = useAsyncAction(
    "Unable to rename the file.",
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
      title="Rename file"
      description={`Choose a new name for “${name}”. The extension stays the same.`}
      confirmLabel="Rename"
      pending={isPending}
      error={error}
      disabled={!title.trim()}
      onConfirm={() =>
        void run(async () => {
          await onRename(title.trim());
          onClose();
        })
      }
    >
      <div className="grid gap-2">
        <Label htmlFor={inputId}>Name</Label>
        <Input
          id={inputId}
          value={title}
          disabled={isPending}
          onChange={(event) => setTitle(event.target.value)}
          onFocus={(event) => event.target.select()}
          required
        />
      </div>
    </ActionDialog>
  );
}
