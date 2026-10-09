import { useThemeColor } from "heroui-native";
import { Moon, Sun } from "lucide-react-native";
import Animated, {
  LayoutAnimationConfig,
  withSpring,
} from "react-native-reanimated";

import { PressableButton } from "@/components/pressable-button";
import { springs } from "@/lib/motion";
import { useAppearanceStore } from "@/stores/appearance-store";

/** The new icon turns in from a quarter turn back and overshoots a little before it settles. */
function iconTurnIn() {
  "worklet";

  return {
    initialValues: { transform: [{ rotate: "-90deg" }] },
    animations: {
      transform: [{ rotate: withSpring("0deg", springs.fastSpatial) }],
    },
  };
}

/** Flips between the light and dark themes in one press. */
export function DarkmodeToggle() {
  const theme = useAppearanceStore((state) => state.theme);
  const setTheme = useAppearanceStore((state) => state.setTheme);
  const foreground = useThemeColor("foreground");
  const Icon = theme === "dark" ? Sun : Moon;

  return (
    <PressableButton
      variant="ghost"
      size="sm"
      isIconOnly
      accessibilityLabel={
        theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
      }
      onPress={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      {/* The icon turns in only when the theme changes, not when the screen opens */}
      <LayoutAnimationConfig skipEntering>
        <Animated.View key={theme} entering={iconTurnIn}>
          <Icon size={18} color={foreground} />
        </Animated.View>
      </LayoutAnimationConfig>
    </PressableButton>
  );
}
