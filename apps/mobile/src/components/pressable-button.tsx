import { Button, type ButtonRootProps } from "heroui-native";
import type { GestureResponderEvent, PressableProps } from "react-native";

import { usePressSpring } from "@/lib/motion";

/**
 * HeroUI's Button with a spring press instead of its timed scale: it squishes
 * on press and bounces back on release. The highlight stays HeroUI's.
 */
export function PressableButton({
  style,
  onPressIn,
  onPressOut,
  ...props
}: Omit<
  ButtonRootProps,
  "animation" | "feedbackVariant" | "onPressIn" | "onPressOut"
> &
  Pick<PressableProps, "onPressIn" | "onPressOut">) {
  const press = usePressSpring(0.06);

  return (
    <Button
      {...props}
      animation={{ scale: false }}
      style={[style, press.style]}
      onPressIn={(event: GestureResponderEvent) => {
        press.pressIn();
        onPressIn?.(event);
      }}
      onPressOut={(event: GestureResponderEvent) => {
        press.pressOut();
        onPressOut?.(event);
      }}
    />
  );
}
