import { gsap } from "gsap";
import { useEffect, useRef, useState } from "react";

/*
 * Adapted from React Bits' TextType (https://reactbits.dev), MIT, trimmed to
 * typing one sentence once.
 */

/** Seconds per cursor fade. */
const CURSOR_BLINK_SECONDS = 0.5;

/** Types `text` one character at a time over `durationMs`, behind a blinking cursor. */
export function TextType({
  text,
  durationMs,
}: {
  text: string;
  durationMs: number;
}) {
  const [typedLength, setTypedLength] = useState(0);
  const cursorRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const tween = gsap.fromTo(
      cursorRef.current,
      { opacity: 1 },
      {
        opacity: 0,
        duration: CURSOR_BLINK_SECONDS,
        repeat: -1,
        yoyo: true,
        ease: "power2.inOut",
      },
    );

    return () => {
      tween.kill();
    };
  }, []);

  useEffect(() => {
    if (typedLength >= text.length) {
      return;
    }

    const timeout = setTimeout(
      () => setTypedLength((length) => length + 1),
      durationMs / text.length,
    );

    return () => clearTimeout(timeout);
  }, [typedLength, text, durationMs]);

  return (
    <span className="inline-block whitespace-pre-wrap">
      <span>{text.slice(0, typedLength)}</span>
      <span ref={cursorRef} className="ml-1 inline-block">
        |
      </span>
    </span>
  );
}
