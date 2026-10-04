import { Hint } from "@lunarscribe/components/hint/hint";
import { Button } from "@lunarscribe/components/ui/button";
import { Moon, Sun } from "lucide-react";
import { useEffect } from "react";

/** Where the dark mode toggle was pressed; the incoming theme is revealed from this point. */
export type ThemeRevealOrigin = {
  x: number;
  y: number;
};

/** Flips between light and dark themes, revealing the new one from the toggle. */
export function DarkModeToggle({
  modKeyLabel,
  onToggle,
}: {
  modKeyLabel: string;
  onToggle: (origin: ThemeRevealOrigin) => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "d" &&
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.repeat &&
        !event.defaultPrevented
      ) {
        event.preventDefault();
        onToggle({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onToggle]);

  return (
    <Hint label="Toggle theme" side="bottom" shortcut={[modKeyLabel, "D"]}>
      <Button
        variant="fluid"
        size="icon-sm"
        aria-label="Toggle theme"
        onClick={(event) => onToggle({ x: event.clientX, y: event.clientY })}
      >
        <Sun className="scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
        <Moon className="absolute scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
      </Button>
    </Hint>
  );
}
