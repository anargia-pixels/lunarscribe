import { errorMessage } from "@lunarscribe/utils/error-message";
import { Dialog, FieldError, Input, Label, TextField } from "heroui-native";
import { useState } from "react";
import { KeyboardAvoidingView, View } from "react-native";

import { PressableButton } from "@/components/pressable-button";
import { stemOf } from "@/lib/editor-files";

/** Asks for a new title for a saved file; stays open with the error if the rename fails. */
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
  const [error, setError] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);

  async function submit() {
    setIsRenaming(true);

    try {
      await onRename(title);
      onClose();
    } catch (cause) {
      setError(errorMessage(cause, "The file could not be renamed."));
    } finally {
      setIsRenaming(false);
    }
  }

  return (
    <Dialog isOpen onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <KeyboardAvoidingView behavior="padding">
          <Dialog.Content>
            <Dialog.Title>Rename file</Dialog.Title>
            <Dialog.Description>{name}</Dialog.Description>
            <TextField isInvalid={error !== null} className="my-4">
              <Label>Title</Label>
              <Input
                value={title}
                onChangeText={(text) => {
                  setTitle(text);
                  setError(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={() => void submit()}
              />
              <FieldError>{error}</FieldError>
            </TextField>
            <View className="flex-row justify-end gap-3">
              <PressableButton variant="ghost" size="sm" onPress={onClose}>
                Cancel
              </PressableButton>
              <PressableButton
                size="sm"
                isDisabled={isRenaming}
                onPress={() => void submit()}
              >
                Rename
              </PressableButton>
            </View>
          </Dialog.Content>
        </KeyboardAvoidingView>
      </Dialog.Portal>
    </Dialog>
  );
}
