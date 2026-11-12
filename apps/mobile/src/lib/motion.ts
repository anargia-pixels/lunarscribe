import {
  FadeIn,
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
 * Material 3 motion tokens in use (androidx `ExpressiveMotionTokens` and
 * `StandardMotionTokens`). Spatial springs move, resize or reshape things;
 * the expressive ones overshoot, the standard ones barely do. Effects springs
 * fade and never overshoot. Reanimated skips them when the system "reduce
 * motion" setting is on.
 */
export const springs = {
  fastSpatial: spring(0.6, 800),
  standardFastSpatial: spring(0.9, 1400),
  standardDefaultSpatial: spring(0.9, 700),
  defaultEffects: spring(1, 1600),
} as const;

/**
 * New file list rows fade in; the rest glide when rows come and go. Both stay
 * calm, since searching and opening folders change many rows at once.
 */
export const rowEntering = FadeIn.springify()
  .damping(springs.defaultEffects.damping)
  .stiffness(springs.defaultEffects.stiffness);

export const rowLayout = LinearTransition.springify()
  .damping(springs.standardDefaultSpatial.damping)
  .stiffness(springs.standardDefaultSpatial.stiffness);

/**
 * Press feel for a tappable surface: it shrinks by `squish` while pressed and
 * springs back on release, so a quick tap still shows the full press. The
 * default fast spatial spring bounces back; a standard one settles without it.
 */
export function usePressSpring(
  squish: number,
  pressSpring = springs.fastSpatial,
) {
  const pressed = useSharedValue(0);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - squish * pressed.get() }],
  }));

  return {
    style,
    pressIn: () => pressed.set(withSpring(1, pressSpring)),
    pressOut: () => pressed.set(withSpring(0, pressSpring)),
  };
}
