import type { ImageSource } from "@lunarscribe/components/editor/markdown-editor";
import { resolveSavedImage } from "@lunarscribe/utils/images";
import { folderOf } from "@lunarscribe/utils/saved-paths";
import { useCallback, useEffect, useMemo, useState } from "react";

import DrawingDom from "@/components/drawing-dom";
import type { EditorDomProps } from "@/components/editor-dom-props";
import MarkdownDom from "@/components/markdown-dom";
import { useColorPalette } from "@/components/use-color-palette";
import { listImageNames, readImageDataUrl } from "@/lib/documents-folder";
import type { EditorKind } from "@/lib/editor-types";
import { onSyncResult } from "@/lib/sync/sync-service";
import { useAppearanceStore } from "@/stores/appearance-store";
import {
  type TextBuffer,
  useActiveBuffer,
  useBufferStore,
} from "@/stores/buffer-store";
import { useEditorHostStore } from "@/stores/editor-host-store";

/**
 * The buffer the editor shows; `id` is null on the empty warm-up page. `folder` holds its
 * file, where its embedded images sit.
 */
type OpenedBuffer = {
  id: string | null;
  contentKey: string;
  content: string;
  folder: string;
};

const EMPTY_PAGE: OpenedBuffer = {
  id: null,
  contentKey: "",
  content: "",
  folder: "",
};

// Reload the editor only for a new buffer or a sync revision.
function getContentKey(buffer: TextBuffer) {
  return `${buffer.id}:${buffer.syncRevision}`;
}

function openBuffer(buffer: TextBuffer): OpenedBuffer {
  return {
    id: buffer.id,
    contentKey: getContentKey(buffer),
    content: buffer.content,
    folder: buffer.fileName ? folderOf(buffer.fileName) : buffer.folder,
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
  props: Omit<
    EditorDomProps,
    "onChange" | "onOutlineOpenChange" | "resolveImage" | "dom"
  >,
  actions: string[],
) {
  const initialProps = { names: actions, props };

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
  const isOutlineOpen = useEditorHostStore((state) => state.isOutlineOpen);
  const buffer = useActiveBuffer();
  const activeBuffer = buffer?.kind === kind ? buffer : undefined;

  const [opened, setOpened] = useState(() =>
    activeBuffer ? openBuffer(activeBuffer) : EMPTY_PAGE,
  );

  if (activeBuffer && opened.contentKey !== getContentKey(activeBuffer)) {
    setOpened(openBuffer(activeBuffer));
  }

  // Only the first page load reads it, so it stays fixed like Expo's initial props.
  // Synced images may replace the ones shown, so a pull reads every embed again.
  const [imageRevision, setImageRevision] = useState(0);

  useEffect(
    () =>
      onSyncResult((result) => {
        if (result.pulled > 0) {
          setImageRevision((current) => current + 1);
        }
      }),
    [],
  );

  const [pageStartScript] = useState(() =>
    createPageStartScript(
      {
        content: opened.content,
        contentKey: opened.contentKey,
        theme,
        palette,
        isShown,
        isOutlineOpen,
        imageRevision,
      },
      kind === "markdown"
        ? ["onChange", "onOutlineOpenChange", "resolveImage"]
        : ["onChange", "onOutlineOpenChange"],
    ),
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

  const openedFolder = opened.folder;

  const resolveImage = useCallback(
    async (target: string): Promise<ImageSource> => {
      const name = resolveSavedImage(openedFolder, target, listImageNames());
      const src = name ? await readImageDataUrl(name) : null;

      return src ? { status: "ready", src } : { status: "missing" };
    },
    [openedFolder],
  );

  const handleOutlineOpenChange = useCallback(
    async (open: boolean) =>
      useEditorHostStore.setState({ isOutlineOpen: open }),
    [],
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
        isOutlineOpen={isOutlineOpen}
        onOutlineOpenChange={handleOutlineOpenChange}
        resolveImage={kind === "markdown" ? resolveImage : undefined}
        imageRevision={imageRevision}
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
      isOutlineOpen,
      handleOutlineOpenChange,
      resolveImage,
      imageRevision,
      pageStartScript,
    ],
  );
}
