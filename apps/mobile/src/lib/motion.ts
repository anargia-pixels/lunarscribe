import {
  FadeIn,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

/**
 * Converts a Material spring (damping ratio, stiffness, unit mass) to Reanimated's
 * physics config. Pass the mass along too: Reanimated 4 assumes a mass of 4, which
 * would halve the damping ratio.
 */
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
  defaultEffects: spring(1, 1600),
  /** Standard default spatial stiffness, critically damped so it never overshoots. */
  calmSpatial: spring(1, 700),
} as const;

/**
 * New file list rows fade in; the rest glide when rows come and go, without
 * overshooting. Collapsing a folder moves every row below it a long way, where
 * even a slight overshoot reads as a bounce.
 */
export const rowEntering = FadeIn.springify()
  .damping(springs.defaultEffects.damping)
  .stiffness(springs.defaultEffects.stiffness)
  .mass(springs.defaultEffects.mass);

export const rowLayout = LinearTransition.springify()
  .damping(springs.calmSpatial.damping)
  .stiffness(springs.calmSpatial.stiffness)
  .mass(springs.calmSpatial.mass);

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
