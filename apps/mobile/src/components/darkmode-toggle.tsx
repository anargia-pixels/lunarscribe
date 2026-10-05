import { Button, useThemeColor } from "heroui-native";
import { Moon, Sun } from "lucide-react-native";

import { useAppearanceStore } from "@/stores/appearance-store";

/** Flips between the light and dark themes in one press. */
export function DarkmodeToggle() {
  const theme = useAppearanceStore((state) => state.theme);
  const setTheme = useAppearanceStore((state) => state.setTheme);
  const foreground = useThemeColor("foreground");
  const Icon = theme === "dark" ? Sun : Moon;

  return (
    <Button
      variant="ghost"
      size="sm"
      isIconOnly
      accessibilityLabel={
        theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
      }
      onPress={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <Icon size={18} color={foreground} />
    </Button>
  );
}
