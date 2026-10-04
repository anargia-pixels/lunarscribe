import { createElement } from "react";
import type { ReactNode } from "react";

/** Render quoted filenames as code without interpreting remote HTML. */
export function formatFileMessage(message: string) {
  const parts: ReactNode[] = [];
  let offset = 0;

  for (const match of message.matchAll(/"(?:\\.|[^"\\])*"|'[^'\n]*'/gu)) {
    const quoted = match[0];
    let name = quoted.slice(1, -1);

    if (quoted.startsWith('"')) {
      try {
        // The regex limits the parsed value to a JSON string literal.
        name = String(JSON.parse(quoted));
      } catch {
        continue;
      }
    }

    if (!/\.[a-z\d]+$/iu.test(name)) {
      continue;
    }

    parts.push(
      message.slice(offset, match.index),
      createElement("code", { key: match.index }, name),
    );
    offset = match.index + quoted.length;
  }

  parts.push(message.slice(offset));

  return parts;
}
