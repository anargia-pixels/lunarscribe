import type { EditorThemeClasses } from "lexical";

/** Tailwind classes Lexical applies to the nodes it renders. */
export const editorTheme: EditorThemeClasses = {
  paragraph: "mb-3 leading-7",
  quote: "mb-3 border-l-2 border-border pl-4 text-muted-foreground italic",
  heading: {
    h1: "mb-4 text-3xl font-bold tracking-tight",
    h2: "mb-3 text-2xl font-semibold tracking-tight",
    h3: "mb-3 text-xl font-semibold",
    h4: "mb-2 text-lg font-semibold",
    h5: "mb-2 font-semibold",
    h6: "mb-2 text-sm font-semibold",
  },
  list: {
    ul: "mb-3 ml-6 list-disc",
    ol: "mb-3 ml-6 list-decimal",
    listitem: "my-1",
    nested: { listitem: "list-none" },
  },
  link: "text-primary underline underline-offset-4",
  code: "mb-3 block overflow-x-auto rounded-md bg-muted p-3 font-mono text-sm",
  text: {
    bold: "font-bold",
    italic: "italic",
    strikethrough: "line-through",
    underline: "underline",
    code: "rounded bg-muted px-1 py-0.5 font-mono text-sm",
  },
};
