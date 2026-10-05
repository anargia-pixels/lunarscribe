import { useCallback, useMemo, useState } from "react";

import DrawingDom from "@/components/drawing-dom";
import type { EditorDomProps } from "@/components/editor-dom-props";
import MarkdownDom from "@/components/markdown-dom";
import { useColorPalette } from "@/components/use-color-palette";
import type { EditorKind } from "@/lib/editor-types";
import { useAppearanceStore } from "@/stores/appearance-store";
import {
  type TextBuffer,
  useActiveBuffer,
  useBufferStore,
} from "@/stores/buffer-store";
import { useEditorHostStore } from "@/stores/editor-host-store";

/** The buffer the editor shows; `id` is null on the empty warm-up page. */
type OpenedBuffer = { id: string | null; contentKey: string; content: string };

const EMPTY_PAGE: OpenedBuffer = { id: null, contentKey: "", content: "" };

// Reload the editor only for a new buffer or a sync revision.
function getContentKey(buffer: TextBuffer) {
  return `${buffer.id}:${buffer.syncRevision}`;
}

function openBuffer(buffer: TextBuffer): OpenedBuffer {
  return {
    id: buffer.id,
    contentKey: getContentKey(buffer),
    content: buffer.content,
  };
}

/**
 * Runs before the DOM component page loads. It applies the theme class and the
 * color theme, so the page never paints other colors before React mounts, and sets
 * the globals Expo's page reads its host OS and initial props from: Expo Go has no
 * `@expo/dom-webview` view, so the component renders in `react-native-webview`,
 * whose Android bridge attaches after the page script has looked for them. Later
 * props still arrive through Expo as `$$props`.
 */
function createPageStartScript(
  props: Omit<EditorDomProps, "onChange" | "dom">,
) {
  const initialProps = { names: ["onChange"], props };

  return [
    `document.documentElement.classList.add(${JSON.stringify(props.theme)});`,
    `for (const [token, value] of Object.entries(${JSON.stringify(props.palette ?? {})})) {`,
    "  document.documentElement.style.setProperty(`--${token}`, value);",
    "}",
    `window.$$EXPO_DOM_HOST_OS = ${JSON.stringify(process.env.EXPO_OS)};`,
    `window.$$EXPO_INITIAL_PROPS = ${JSON.stringify(initialProps)};`,
    "true;",
  ].join("\n");
}

/**
 * Hosts the editor DOM component of one kind and shows the active buffer of that
 * kind. Props are memoized because Expo sends them to the WebView on each render.
 */
export function EditorWebView({
  kind,
  isShown,
}: {
  kind: EditorKind;
  isShown: boolean;
}) {
  const theme = useAppearanceStore((state) => state.theme);
  const palette = useColorPalette();
  const setContent = useBufferStore((state) => state.setContent);
  const buffer = useActiveBuffer();
  const activeBuffer = buffer?.kind === kind ? buffer : undefined;

  const [opened, setOpened] = useState(() =>
    activeBuffer ? openBuffer(activeBuffer) : EMPTY_PAGE,
  );

  if (activeBuffer && opened.contentKey !== getContentKey(activeBuffer)) {
    setOpened(openBuffer(activeBuffer));
  }

  // Only the first page load reads it, so it stays fixed like Expo's initial props.
  const [pageStartScript] = useState(() =>
    createPageStartScript({
      content: opened.content,
      contentKey: opened.contentKey,
      theme,
      palette,
      isShown,
    }),
  );

  const openedId = opened.id;

  const handleChange = useCallback(
    async (content: string) => {
      if (openedId) {
        setContent(openedId, content);
      }
    },
    [openedId, setContent],
  );

  const EditorDom = kind === "drawing" ? DrawingDom : MarkdownDom;

  return useMemo(
    () => (
      <EditorDom
        content={opened.content}
        contentKey={opened.contentKey}
        theme={theme}
        palette={palette}
        isShown={isShown}
        onChange={handleChange}
        dom={{
          useExpoDOMWebView: false,
          injectedJavaScriptBeforeContentLoaded: pageStartScript,
          containerStyle: { flex: 1 },
          // The editor scrolls inside the page and docks its own toolbar above the keyboard.
          bounces: false,
          overScrollMode: "never",
          contentInsetAdjustmentBehavior: "never",
          hideKeyboardAccessoryView: true,
          onLoadEnd: () =>
            useEditorHostStore.setState((state) => ({
              isLoaded: { ...state.isLoaded, [kind]: true },
            })),
        }}
      />
    ),
    [
      EditorDom,
      kind,
      opened,
      theme,
      palette,
      isShown,
      handleChange,
      pageStartScript,
    ],
  );
}
