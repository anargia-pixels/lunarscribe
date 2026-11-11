const REPLACEMENT = 0xfffd;

/** The allowed range of the byte after `lead`, which rules out overlong and surrogate forms. */
function secondByteRange(lead: number): [number, number] {
  if (lead === 0xe0) {
    return [0xa0, 0xbf];
  }

  if (lead === 0xed) {
    return [0x80, 0x9f];
  }

  if (lead === 0xf0) {
    return [0x90, 0xbf];
  }

  if (lead === 0xf4) {
    return [0x80, 0x8f];
  }

  return [0x80, 0xbf];
}

/**
 * Decode UTF-8 bytes like Node's `Buffer.toString`: a byte order mark stays, and an
 * invalid byte becomes U+FFFD. Hermes has `TextEncoder` but no `TextDecoder`.
 */
export function decodeUtf8(bytes: Uint8Array) {
  const parts: string[] = [];
  let codePoints: number[] = [];
  let index = 0;

  while (index < bytes.length) {
    const lead = bytes[index]!;

    // Continuation bytes after the lead byte: 0 for ASCII, -1 for an invalid lead.
    const extra =
      lead < 0x80
        ? 0
        : lead >= 0xc2 && lead < 0xe0
          ? 1
          : lead >= 0xe0 && lead < 0xf0
            ? 2
            : lead >= 0xf0 && lead <= 0xf4
              ? 3
              : -1;

    let codePoint = extra === 0 ? lead : REPLACEMENT;
    let length = 1;

    if (extra > 0) {
      let value = lead & (0x3f >> extra);
      let offset = 1;

      // A broken sequence becomes one U+FFFD for its valid prefix, as in WHATWG.
      for (; offset <= extra; offset += 1) {
        const next = bytes[index + offset];
        const [low, high] = offset === 1 ? secondByteRange(lead) : [0x80, 0xbf];

        if (next === undefined || next < low || next > high) {
          break;
        }

        value = (value << 6) | (next & 0x3f);
      }

      length = offset;

      if (offset > extra) {
        codePoint = value;
      }
    }

    codePoints.push(codePoint);
    index += length;

    // Flush in chunks, since `fromCodePoint` takes its arguments on the stack.
    if (codePoints.length === 8192) {
      parts.push(String.fromCodePoint(...codePoints));
      codePoints = [];
    }
  }

  parts.push(String.fromCodePoint(...codePoints));

  return parts.join("");
}
