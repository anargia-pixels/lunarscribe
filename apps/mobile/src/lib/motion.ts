import {
  FadeInDown,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

/** Converts a Material spring (damping ratio, stiffness, unit mass) to Reanimated's physics config. */
function spring(dampingRatio: number, stiffness: number) {
  return {
    damping: 2 * dampingRatio * Math.sqrt(stiffness),
    stiffness,
    mass: 1,
  };
}

/**
 * Material 3 Expressive motion scheme (androidx `ExpressiveMotionTokens`), the
 * tokens in use. Spatial springs move, resize or reshape things and may
 * overshoot. Reanimated skips them when the system "reduce motion" setting is on.
 */
export const springs = {
  fastSpatial: spring(0.6, 800),
  defaultSpatial: spring(0.8, 380),
} as const;

/** New list rows slide up into place; the rest glide when rows come and go. */
export const rowEntering = FadeInDown.springify()
  .damping(springs.defaultSpatial.damping)
  .stiffness(springs.defaultSpatial.stiffness);

export const rowLayout = LinearTransition.springify()
  .damping(springs.defaultSpatial.damping)
  .stiffness(springs.defaultSpatial.stiffness);

/**
 * Press feel for a tappable surface: it shrinks by `squish` while pressed and
 * bounces back on release, both on the fast spatial spring, so a quick tap
 * still shows the full press.
 */
export function usePressSpring(squish: number) {
  const pressed = useSharedValue(0);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - squish * pressed.get() }],
  }));

  return {
    style,
    pressIn: () => pressed.set(withSpring(1, springs.fastSpatial)),
    pressOut: () => pressed.set(withSpring(0, springs.fastSpatial)),
  };
}
