import { errorMessage } from "@lunarscribe/utils/error-message";
import { Button, Dialog, FieldError } from "heroui-native";
import { useState } from "react";
import { View } from "react-native";

/** Confirms deleting a saved file from the documents folder. */
export function DeleteFileDialog({
  name,
  onClose,
  onDelete,
}: {
  name: string;
  onClose: () => void;
  onDelete: () => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function confirm() {
    setIsDeleting(true);

    try {
      await onDelete();
      onClose();
    } catch (cause) {
      setError(errorMessage(cause, "The file could not be deleted."));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Dialog isOpen onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content>
          <Dialog.Title>Delete file?</Dialog.Title>
          <Dialog.Description>
            {name} will be removed from lunarscribe. This cannot be undone.
          </Dialog.Description>
          {error && <FieldError isInvalid>{error}</FieldError>}
          <View className="mt-5 flex-row justify-end gap-3">
            <Button variant="ghost" size="sm" onPress={onClose}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              isDisabled={isDeleting}
              onPress={() => void confirm()}
            >
              Delete
            </Button>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
