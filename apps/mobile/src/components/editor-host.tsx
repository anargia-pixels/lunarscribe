import { type NativeStackNavigationProp, useNavigation } from "expo-router";
import { Spinner } from "heroui-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { ScopedVariables } from "uniwind";

import { EditorWebView } from "@/components/editor-webview";
import type { EditorKind } from "@/lib/editor-types";
import { useBufferStore } from "@/stores/buffer-store";
import { useEditorHostStore } from "@/stores/editor-host-store";

/**
 * Keeps the editor WebViews loaded above all screens and shows the active one over
 * the editor slot, so a file opens without a page load. The drawing editor loads
 * after the markdown editor, or at once when a drawing opens first.
 */
export function EditorHost() {
  const hostRef = useRef<View>(null);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const [hasDrawing, setHasDrawing] = useState(false);
  const slot = useEditorHostStore((state) => state.slot);

  const isMarkdownLoaded = useEditorHostStore(
    (state) => state.isLoaded.markdown,
  );

  const activeKind = useBufferStore(
    (state) =>
      state.buffers.find((buffer) => buffer.id === state.activeId)?.kind,
  );

  if ((isMarkdownLoaded || activeKind === "drawing") && !hasDrawing) {
    setHasDrawing(true);
  }

  const kinds: EditorKind[] = hasDrawing
    ? ["markdown", "drawing"]
    : ["markdown"];

  // CSS variables keep the tree stable, so the WebViews never remount.
  const slotVariables = {
    "--slot-x": (slot?.x ?? 0) - origin.x,
    "--slot-y": (slot?.y ?? 0) - origin.y,
    "--slot-width": slot?.width ?? 0,
    "--slot-height": slot?.height ?? 0,
  };

  return (
    <View
      ref={hostRef}
      pointerEvents="box-none"
      className="absolute inset-0"
      onLayout={() =>
        hostRef.current?.measureInWindow((x, y) => setOrigin({ x, y }))
      }
    >
      <ScopedVariables variables={slotVariables}>
        {kinds.map((kind) => {
          const isShown = slot !== null && kind === activeKind;

          // Hidden editors keep their full size, so their pages continue to load.
          return (
            <View
              key={kind}
              pointerEvents={isShown ? "auto" : "none"}
              accessibilityElementsHidden={!isShown}
              importantForAccessibility={
                isShown ? "auto" : "no-hide-descendants"
              }
              className={
                isShown
                  ? "absolute top-(--slot-y) left-(--slot-x) h-(--slot-height) w-(--slot-width)"
                  : "absolute inset-0 opacity-0"
              }
            >
              <EditorWebView kind={kind} isShown={isShown} />
            </View>
          );
        })}
      </ScopedVariables>
    </View>
  );
}

/**
 * Marks the editor screen's space for the editor host. It claims the space after
 * the screen slides in and releases it when the screen starts to leave, because
 * the host does not move with the screen. Shows a spinner until the page loads.
 */
export function EditorSlot({ kind }: { kind: EditorKind }) {
  const navigation =
    useNavigation<NativeStackNavigationProp<ReactNavigation.RootParamList>>();

  const slotRef = useRef<View>(null);
  const [isSettled, setSettled] = useState(false);
  const isLoaded = useEditorHostStore((state) => state.isLoaded[kind]);

  const measure = useCallback(() => {
    slotRef.current?.measureInWindow((x, y, width, height) =>
      useEditorHostStore.setState({ slot: { x, y, width, height } }),
    );
  }, []);

  useEffect(() => {
    const unsubscribes = [
      navigation.addListener("transitionEnd", (event) =>
        setSettled(!event.data.closing),
      ),
      navigation.addListener("transitionStart", (event) => {
        if (event.data.closing) {
          setSettled(false);
        }
      }),
      // A canceled swipe back on iOS keeps the screen.
      navigation.addListener("gestureCancel", () => setSettled(true)),
      navigation.addListener("beforeRemove", () => setSettled(false)),
    ];

    return () => {
      for (const unsubscribe of unsubscribes) {
        unsubscribe();
      }
    };
  }, [navigation]);

  useEffect(() => {
    if (isSettled) {
      measure();
    }

    return () => useEditorHostStore.setState({ slot: null });
  }, [isSettled, measure]);

  return (
    <View
      ref={slotRef}
      className="flex-1 items-center justify-center"
      onLayout={isSettled ? measure : undefined}
    >
      {!isLoaded && <Spinner />}
    </View>
  );
}
