import { cn } from "@lunarscribe/utils/cn";
import { useEffect, useState } from "react";

/**
 * Enter and exit for anchored popups, driven by Base UI's starting and ending styles.
 * The popup fades and grows from its anchor, sliding 4px away from a trigger above or
 * below it; exits run on the quicker exit token.
 */
export const fluidPopupMotion =
  "origin-(--transform-origin) transition-[opacity,scale,translate] duration-(--duration-fluid) ease-fluid data-ending-style:duration-(--duration-fluid-exit) data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0 data-[side=bottom]:data-starting-style:-translate-y-1 data-[side=bottom]:data-ending-style:-translate-y-1 data-[side=top]:data-starting-style:translate-y-1 data-[side=top]:data-ending-style:translate-y-1 motion-reduce:transition-opacity";

const DISABLED_SELECTOR = ":disabled, [data-disabled], [aria-disabled='true']";

/** Position of `row` relative to `container`, summing offsets through nested wrappers. */
function measureRow(row: HTMLElement, container: HTMLElement) {
  let top = row.offsetTop;
  let left = row.offsetLeft;
  let ancestor = row.offsetParent;

  while (
    ancestor instanceof HTMLElement &&
    ancestor !== container &&
    container.contains(ancestor)
  ) {
    top += ancestor.offsetTop + ancestor.clientTop;
    left += ancestor.offsetLeft + ancestor.clientLeft;
    ancestor = ancestor.offsetParent;
  }

  return { top, left, width: row.offsetWidth, height: row.offsetHeight };
}

/** How far outside a row the pointer still counts as on it, enough to bridge the gap between rows. */
const GAP_TOLERANCE_PX = 8;

/** The row under the pointer or within the gap tolerance of it, so gaps never drop the highlight. */
function nearestRow(rows: HTMLElement[], x: number, y: number) {
  let nearest: HTMLElement | null = null;
  let nearestDistance = GAP_TOLERANCE_PX;

  for (const row of rows) {
    const rect = row.getBoundingClientRect();

    // Distance to the row's edge; zero when the pointer is inside it.
    const distance = Math.hypot(
      Math.max(rect.left - x, 0, x - rect.right),
      Math.max(rect.top - y, 0, y - rect.bottom),
    );

    if (distance <= nearestDistance) {
      nearestDistance = distance;
      nearest = row;
    }
  }

  return nearest;
}

/**
 * One fill that glides between the container's `rows` (a selector) as the pointer or
 * keyboard focus moves, instead of each row blinking its own hover background. Render it
 * as the first child of a `relative` container whose rows are `relative`, so rows paint
 * above it; use `as="li"` inside a list. It fades in on the first row and out in place.
 */
export function FluidHighlight({
  rows,
  as: Tag = "span",
  className,
}: {
  rows: string;
  as?: "span" | "li";
  className?: string;
}) {
  const [indicator, setIndicator] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const container = indicator?.parentElement;

    if (!indicator || !container) {
      return;
    }

    // Direct style writes: the target changes on every pointer move, and a React render
    // per move would be wasted work.
    const moveTo = (row: HTMLElement | null) => {
      if (!row) {
        indicator.removeAttribute("data-active");

        return;
      }

      const { top, left, width, height } = measureRow(row, container);

      // The first row it lands on snaps into place and only fades in.
      indicator.toggleAttribute(
        "data-instant",
        !indicator.hasAttribute("data-active"),
      );
      // So a destructive row fills destructive, as it does with its own hover.
      indicator.setAttribute(
        "data-variant",
        row.getAttribute("data-variant") ?? "default",
      );
      indicator.style.translate = `${left}px ${top}px`;
      indicator.style.width = `${width}px`;
      indicator.style.height = `${height}px`;
      indicator.setAttribute("data-active", "");
    };

    const enabledRows = () =>
      Array.from(container.querySelectorAll<HTMLElement>(rows)).filter(
        (row) => !row.matches(DISABLED_SELECTOR),
      );

    let frame = 0;

    // Resolves the row once per frame, however many pointer events arrive.
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") {
        return;
      }

      const { clientX, clientY } = event;

      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        moveTo(nearestRow(enabledRows(), clientX, clientY)),
      );
    };

    const onPointerLeave = () => {
      cancelAnimationFrame(frame);
      moveTo(null);
    };

    // Keyboard focus is when rows draw a focus ring, so the fill follows it then.
    const onFocusIn = (event: FocusEvent) => {
      const row =
        event.target instanceof HTMLElement
          ? event.target.closest<HTMLElement>(rows)
          : null;

      if (row && enabledRows().includes(row) && row.matches(":focus-visible")) {
        moveTo(row);
      }
    };

    const onFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget;

      if (
        next instanceof HTMLElement &&
        enabledRows().some((row) => row.contains(next))
      ) {
        return;
      }

      moveTo(null);
    };

    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerleave", onPointerLeave);
    container.addEventListener("focusin", onFocusIn);
    container.addEventListener("focusout", onFocusOut);

    return () => {
      cancelAnimationFrame(frame);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerleave", onPointerLeave);
      container.removeEventListener("focusin", onFocusIn);
      container.removeEventListener("focusout", onFocusOut);
    };
  }, [indicator, rows]);

  return (
    <Tag
      ref={setIndicator}
      aria-hidden="true"
      data-slot="fluid-highlight"
      className={cn(
        "ease-fluid data-[variant=destructive]:bg-destructive/10 dark:data-[variant=destructive]:bg-destructive/20 pointer-events-none absolute top-0 left-0 rounded-md opacity-0 transition-all duration-(--duration-fluid) data-active:opacity-100 data-instant:transition-opacity motion-reduce:transition-opacity",
        className,
      )}
    />
  );
}
