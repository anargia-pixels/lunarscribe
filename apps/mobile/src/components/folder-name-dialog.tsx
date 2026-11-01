import { errorMessage } from "@lunarscribe/utils/error-message";
import { Dialog, FieldError, Input, Label, TextField } from "heroui-native";
import { useState } from "react";
import { KeyboardAvoidingView, View } from "react-native";

import { PressableButton } from "@/components/pressable-button";

/** Names a new folder or renames one; stays open with the error if saving fails. */
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
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function submit() {
    setIsSaving(true);

    try {
      await onConfirm(name);
      onClose();
    } catch (cause) {
      setError(errorMessage(cause, "The folder could not be saved."));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog isOpen onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <KeyboardAvoidingView behavior="padding">
          <Dialog.Content>
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Description>{description}</Dialog.Description>
            <TextField isInvalid={error !== null} className="my-4">
              <Label>Name</Label>
              <Input
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  setError(null);
                }}
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
                isDisabled={isSaving || !name.trim()}
                onPress={() => void submit()}
              >
                {confirmLabel}
              </PressableButton>
            </View>
          </Dialog.Content>
        </KeyboardAvoidingView>
      </Dialog.Portal>
    </Dialog>
  );
}
