import { useCallback, useMemo, useState } from "react";

import DrawingDom from "@/components/drawing-dom";
import MarkdownDom from "@/components/markdown-dom";
import type { Theme } from "@/lib/editor-types";
import { useAppearanceStore } from "@/stores/appearance-store";
import { type TextBuffer, useBufferStore } from "@/stores/buffer-store";

/**
 * Runs before the DOM component page loads. It applies the theme class, so the
 * page's CSS never paints the other theme before React mounts, and sets the globals
 * Expo's page reads its host OS and initial props from: Expo Go has no
 * `@expo/dom-webview` view, so the component renders in `react-native-webview`,
 * whose Android bridge attaches after the page script has looked for them. Later
 * props still arrive through Expo as `$$props`.
 */
function createPageStartScript(props: {
  content: string;
  contentKey: string;
  theme: Theme;
}) {
  const initialProps = { names: ["onChange"], props };

  return [
    `document.documentElement.classList.add(${JSON.stringify(props.theme)});`,
    `window.$$EXPO_DOM_HOST_OS = ${JSON.stringify(process.env.EXPO_OS)};`,
    `window.$$EXPO_INITIAL_PROPS = ${JSON.stringify(initialProps)};`,
    "true;",
  ].join("\n");
}

/**
 * Hosts the editor DOM component for the buffer's kind. Its props are memoized
 * because Expo sends them into the WebView on every render, and the content must
 * not travel on each edit.
 */
export function EditorWebView({ buffer }: { buffer: TextBuffer }) {
  const theme = useAppearanceStore((state) => state.theme);
  const setContent = useBufferStore((state) => state.setContent);
  const { id, syncRevision, kind } = buffer;

  // The editor owns the content after it opens; only a new buffer or revision reloads it.
  const contentKey = `${id}:${syncRevision}`;

  const [opened, setOpened] = useState({ contentKey, content: buffer.content });

  if (opened.contentKey !== contentKey) {
    setOpened({ contentKey, content: buffer.content });
  }

  // Only the first page load reads it, so it stays fixed like Expo's initial props.
  const [pageStartScript] = useState(() =>
    createPageStartScript({ ...opened, theme }),
  );

  const handleChange = useCallback(
    async (content: string) => setContent(id, content),
    [id, setContent],
  );

  const EditorDom = kind === "drawing" ? DrawingDom : MarkdownDom;

  return useMemo(
    () => (
      <EditorDom
        content={opened.content}
        contentKey={opened.contentKey}
        theme={theme}
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
        }}
      />
    ),
    [EditorDom, opened, theme, handleChange, pageStartScript],
  );
}
