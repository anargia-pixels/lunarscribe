import { Alert, AlertDescription } from "@lunarscribe/components/ui/alert";
import { Button } from "@lunarscribe/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@lunarscribe/components/ui/dialog";
import type { ReactNode } from "react";

/** A controlled action form; its caller owns pending state, errors, and closing on success. */
export function ActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  pending = false,
  error,
  children,
  confirmVariant = "default",
  disabled = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  pending?: boolean;
  error?: string | null;
  children?: ReactNode;
  confirmVariant?: "default" | "destructive";
  disabled?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!pending) {
          onOpenChange(nextOpen);
        }
      }}
    >
      <DialogContent showCloseButton={!pending}>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();

            if (!pending && !disabled) {
              onConfirm();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {children}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <DialogClose
              render={<Button variant="outline" disabled={pending} />}
            >
              Cancel
            </DialogClose>
            <Button
              type="submit"
              variant={confirmVariant}
              disabled={pending || disabled}
              aria-busy={pending}
            >
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
