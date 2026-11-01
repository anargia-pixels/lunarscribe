import { ListGroup, Menu, useThemeColor } from "heroui-native";
import {
  ChevronDown,
  ChevronRight,
  Ellipsis,
  Folder,
  FolderOpen,
} from "lucide-react-native";

import { PressableButton } from "@/components/pressable-button";
import { PressableListItem } from "@/components/pressable-list-item";

/** One folder: press to expand or collapse it, or use its menu to add to, rename or delete it. */
export function FolderListItem({
  name,
  fileCount,
  isOpen,
  onToggle,
  onNewNote,
  onNewDrawing,
  onNewFolder,
  onRename,
  onDelete,
}: {
  name: string;
  fileCount: number;
  isOpen: boolean;
  onToggle: () => void;
  onNewNote: () => void;
  onNewDrawing: () => void;
  onNewFolder: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const foreground = useThemeColor("foreground");
  const muted = useThemeColor("muted");

  return (
    <PressableListItem
      onPress={onToggle}
      accessibilityLabel={`${isOpen ? "Collapse" : "Expand"} folder ${name}`}
      accessibilityState={{ expanded: isOpen }}
    >
      <ListGroup.ItemPrefix className="flex-row items-center gap-1">
        {isOpen ? (
          <ChevronDown size={16} color={muted} />
        ) : (
          <ChevronRight size={16} color={muted} />
        )}
        {isOpen ? (
          <FolderOpen size={18} color={foreground} />
        ) : (
          <Folder size={18} color={foreground} />
        )}
      </ListGroup.ItemPrefix>
      <ListGroup.ItemContent>
        <ListGroup.ItemTitle numberOfLines={1}>{name}</ListGroup.ItemTitle>
        <ListGroup.ItemDescription numberOfLines={1}>
          {fileCount === 1 ? "1 file" : `${fileCount} files`}
        </ListGroup.ItemDescription>
      </ListGroup.ItemContent>
      <ListGroup.ItemSuffix>
        <Menu>
          <Menu.Trigger asChild>
            <PressableButton
              variant="ghost"
              size="sm"
              isIconOnly
              accessibilityLabel={`Actions for folder ${name}`}
            >
              <Ellipsis size={18} color={foreground} />
            </PressableButton>
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Overlay />
            <Menu.Content presentation="popover" width={180}>
              <Menu.Item onPress={onNewNote}>
                <Menu.ItemTitle>New note</Menu.ItemTitle>
              </Menu.Item>
              <Menu.Item onPress={onNewDrawing}>
                <Menu.ItemTitle>New drawing</Menu.ItemTitle>
              </Menu.Item>
              <Menu.Item onPress={onNewFolder}>
                <Menu.ItemTitle>New folder</Menu.ItemTitle>
              </Menu.Item>
              <Menu.Item onPress={onRename}>
                <Menu.ItemTitle>Rename</Menu.ItemTitle>
              </Menu.Item>
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
