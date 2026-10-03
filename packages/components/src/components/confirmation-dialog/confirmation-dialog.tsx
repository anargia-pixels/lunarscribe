import { ActionDialog } from "@lunarscribe/components/action-dialog/action-dialog";
import type { ComponentProps } from "react";

/** Destructive confirmation using the shared action-dialog form. */
export function ConfirmationDialog({
  confirmLabel = "Confirm",
  ...props
}: Omit<
  ComponentProps<typeof ActionDialog>,
  "confirmVariant" | "children" | "confirmLabel"
> & { confirmLabel?: string }) {
  return (
    <ActionDialog
      {...props}
      confirmLabel={confirmLabel}
      confirmVariant="destructive"
    />
  );
}
