import { errorMessage } from "@lunarscribe/utils/error-message";
import { Dialog, FieldError } from "heroui-native";
import { useState } from "react";
import { View } from "react-native";

import { PressableButton } from "@/components/pressable-button";

/** Confirms deleting a folder with everything in it. */
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
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function confirm() {
    setIsDeleting(true);

    try {
      await onDelete();
      onClose();
    } catch (cause) {
      setError(errorMessage(cause, "The folder could not be deleted."));
    } finally {
      setIsDeleting(false);
    }
  }

  const contents =
    fileCount === 0
      ? "This empty folder"
      : `It and the ${fileCount === 1 ? "file" : `${fileCount} files`} inside`;

  return (
    <Dialog isOpen onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content>
          <Dialog.Title>Delete folder?</Dialog.Title>
          <Dialog.Description>
            {`${contents} will be removed from ${name}. This cannot be undone.`}
          </Dialog.Description>
          {error && <FieldError isInvalid>{error}</FieldError>}
          <View className="mt-5 flex-row justify-end gap-3">
            <PressableButton variant="ghost" size="sm" onPress={onClose}>
              Cancel
            </PressableButton>
            <PressableButton
              variant="danger"
              size="sm"
              isDisabled={isDeleting}
              onPress={() => void confirm()}
            >
              Delete
            </PressableButton>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
