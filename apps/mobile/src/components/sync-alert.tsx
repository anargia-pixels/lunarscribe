import { Alert, Button } from "heroui-native";

import { useSyncStore } from "@/stores/sync-store";

/** The last sync failure or conflicts, until dismissed. */
export function SyncAlert() {
  const notice = useSyncStore((state) => state.notice);
  const clearNotice = useSyncStore((state) => state.clearNotice);

  if (!notice) {
    return null;
  }

  return (
    <Alert status="danger" className="mx-4 mb-3">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{notice.title}</Alert.Title>
        <Alert.Description>{notice.description}</Alert.Description>
        {notice.conflicts.map(({ name, reason }) => (
          <Alert.Description
            key={name}
          >{`${name}: ${reason}`}</Alert.Description>
        ))}
      </Alert.Content>
      <Button variant="ghost" size="sm" onPress={clearNotice}>
        Dismiss
      </Button>
    </Alert>
  );
}
