import { ListGroup, Menu, useThemeColor } from "heroui-native";
import { Ellipsis, FileText, PenTool } from "lucide-react-native";

import { PressableButton } from "@/components/pressable-button";
import { PressableListItem } from "@/components/pressable-list-item";
import { kindOf, stemOf } from "@/lib/editor-files";

/** One saved file: press to open it, or use its menu to rename, move, delete or force-sync it. */
export function FileListItem({
  name,
  description,
  isActive,
  onOpen,
  onRename,
  onMove,
  onDelete,
  onForceSync,
}: {
  name: string;
  /** A matching line, shown under the title in search results. */
  description?: string;
  isActive: boolean;
  onOpen: () => void;
  onRename: () => void;
  /** Opens the folder picker; absent in search results. */
  onMove?: () => void;
  onDelete: () => void;
  /** Overwrites the remote copy; absent while sync is off. */
  onForceSync?: () => void;
}) {
  const foreground = useThemeColor("foreground");

  return (
    <PressableListItem onPress={onOpen} accessibilityLabel={`Open ${name}`}>
      <ListGroup.ItemPrefix>
        {kindOf(name) === "drawing" ? (
          <PenTool size={18} color={foreground} />
        ) : (
          <FileText size={18} color={foreground} />
        )}
      </ListGroup.ItemPrefix>
      <ListGroup.ItemContent>
        <ListGroup.ItemTitle
          numberOfLines={1}
          className={isActive ? "text-accent" : undefined}
        >
          {stemOf(name)}
        </ListGroup.ItemTitle>
        {description !== undefined && (
          <ListGroup.ItemDescription numberOfLines={1}>
            {description}
          </ListGroup.ItemDescription>
        )}
      </ListGroup.ItemContent>
      <ListGroup.ItemSuffix>
        <Menu>
          <Menu.Trigger asChild>
            <PressableButton
              variant="ghost"
              size="sm"
              isIconOnly
              accessibilityLabel={`Actions for ${name}`}
            >
              <Ellipsis size={18} color={foreground} />
            </PressableButton>
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Overlay />
            <Menu.Content presentation="popover" width={180}>
              <Menu.Item onPress={onRename}>
                <Menu.ItemTitle>Rename</Menu.ItemTitle>
              </Menu.Item>
              {onMove && (
                <Menu.Item onPress={onMove}>
                  <Menu.ItemTitle>Move to…</Menu.ItemTitle>
                </Menu.Item>
              )}
              {onForceSync && (
                <Menu.Item onPress={onForceSync}>
                  <Menu.ItemTitle>Force changes to remote</Menu.ItemTitle>
                </Menu.Item>
              )}
              <Menu.Item variant="danger" onPress={onDelete}>
                <Menu.ItemTitle>Delete</Menu.ItemTitle>
              </Menu.Item>
            </Menu.Content>
          </Menu.Portal>
        </Menu>
      </ListGroup.ItemSuffix>
    </PressableListItem>
  );
}
