import { errorMessage } from "@lunarscribe/utils/error-message";
import { baseNameOf, folderOf } from "@lunarscribe/utils/saved-paths";
import { Dialog, FieldError, ListGroup, useThemeColor } from "heroui-native";
import { Folder } from "lucide-react-native";
import { useState } from "react";
import { ScrollView, View } from "react-native";

import { PressableButton } from "@/components/pressable-button";
import { PressableListItem } from "@/components/pressable-list-item";

/** Picks the folder a saved file moves to: the top level or any folder but its own. */
export function MoveFileDialog({
  name,
  folders,
  onClose,
  onMove,
}: {
  name: string;
  folders: readonly string[];
  onClose: () => void;
  onMove: (folder: string) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const foreground = useThemeColor("foreground");

  const targets = ["", ...folders].filter(
    (folder) => folder !== folderOf(name),
  );

  async function move(folder: string) {
    setIsMoving(true);

    try {
      await onMove(folder);
      onClose();
    } catch (cause) {
      setError(errorMessage(cause, "The file could not be moved."));
    } finally {
      setIsMoving(false);
    }
  }

  return (
    <Dialog isOpen onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content>
          <Dialog.Title>Move to</Dialog.Title>
          <Dialog.Description>{baseNameOf(name)}</Dialog.Description>
          <ScrollView className="my-4 max-h-80">
            <ListGroup>
              {targets.map((folder) => (
                <PressableListItem
                  key={folder}
                  disabled={isMoving}
                  accessibilityLabel={`Move to ${folder || "Lunarscribe"}`}
                  onPress={() => void move(folder)}
                >
                  <ListGroup.ItemPrefix>
                    <Folder size={18} color={foreground} />
                  </ListGroup.ItemPrefix>
                  <ListGroup.ItemContent>
                    <ListGroup.ItemTitle numberOfLines={1}>
                      {folder ? baseNameOf(folder) : "Lunarscribe"}
                    </ListGroup.ItemTitle>
                    {folderOf(folder) !== "" && (
                      <ListGroup.ItemDescription numberOfLines={1}>
                        {folderOf(folder)}
                      </ListGroup.ItemDescription>
                    )}
                  </ListGroup.ItemContent>
                </PressableListItem>
              ))}
            </ListGroup>
          </ScrollView>
          {error && <FieldError isInvalid>{error}</FieldError>}
          <View className="flex-row justify-end">
            <PressableButton variant="ghost" size="sm" onPress={onClose}>
              Cancel
            </PressableButton>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
