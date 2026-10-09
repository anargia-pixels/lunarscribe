import { Alert } from "heroui-native";

import { PressableButton } from "@/components/pressable-button";
import { useBufferStore } from "@/stores/buffer-store";

/** The last failed file operation, until dismissed. */
export function FileErrorAlert() {
  const fileError = useBufferStore((state) => state.fileError);
  const clearFileError = useBufferStore((state) => state.clearFileError);

  if (!fileError) {
    return null;
  }

  return (
    <Alert status="danger" className="mx-4 mb-3">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>File error</Alert.Title>
        <Alert.Description>{fileError}</Alert.Description>
      </Alert.Content>
      <PressableButton variant="ghost" size="sm" onPress={clearFileError}>
        Dismiss
      </PressableButton>
    </Alert>
  );
}
