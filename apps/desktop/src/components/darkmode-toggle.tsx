import { Hint } from "@lunarscribe/components/hint/hint";
import { Button } from "@lunarscribe/components/ui/button";
import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/components/theme-provider";

/** Flips between light and dark themes, revealing the new one from the toggle. */
export function DarkModeToggle() {
  const { toggleTheme } = useTheme();

  return (
    <Hint label="Toggle theme" side="bottom">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Toggle theme"
        onClick={(event) => toggleTheme({ x: event.clientX, y: event.clientY })}
      >
        <Sun className="scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
        <Moon className="absolute scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
      </Button>
    </Hint>
  );
}
