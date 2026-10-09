import { ListGroup, type ListGroupItemProps } from "heroui-native";
import type { GestureResponderEvent } from "react-native";
import Animated from "react-native-reanimated";

import { usePressSpring } from "@/lib/motion";

const AnimatedListGroupItem = Animated.createAnimatedComponent(ListGroup.Item);

/** A ListGroup row that squishes slightly on press and bounces back on release. */
export function PressableListItem({
  style,
  onPressIn,
  onPressOut,
  ...props
}: ListGroupItemProps) {
  const press = usePressSpring(0.02);

  return (
    <AnimatedListGroupItem
      {...props}
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
