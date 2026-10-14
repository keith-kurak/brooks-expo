import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, ViewProps } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { border, colors, motion, radius, spacing } from '../theme';
import { Txt } from './themed-text';

/**
 * Brooks buttons: 50pt tall and square. Primary actions use the brand's
 * uppercase label and hard offset outline; the PDP purchase variant follows
 * the storefront's blue, sentence-case, split-label treatment on the same
 * stacked block.
 *
 * @ref LLP 0003#brand — Square corners and the hard offset press shadow are not
 * stylistic preferences; they are what Brooks's own buttons do. Rounding these
 * would make the app read as a generic commerce template. The shadow is an
 * absolutely positioned view, not a shadow prop, so it renders identically on
 * every platform. [observed 2026-08-28] It is drawn as a `border.heavy` ink
 * outline rather than a filled block, matching the secondary button's frame.
 *
 * @ref LLP 0003#pdp-purchase-controls — The purchase CTA is the deliberate
 * exception: blue fill, sentence-case action at left, price at right, and it
 * is the one button whose disabled state goes dark — white copy on the site's
 * `#707070` secondary gray — because it sits alone on a white sticky bar with
 * no sibling to read against.
 *
 * @ref LLP 0003#screen-patterns — Pressing a shadowed button pushes its face
 * down onto the shadow, so the two flatten into one block: the site's own
 * hover/active treatment, which on touch is press-in. It runs as a native CSS
 * transition over `motion.press` so it never touches the JS thread per frame,
 * and it is off under reduced motion (the face simply sits flat while pressed).
 * Every button keeps the shadow in all states: dropping it while
 * disabled made a footer's two buttons read as different components, and it
 * moved the button's visual weight on a state change the user did not cause.
 * Disabled is carried by fill and label colour alone.
 */

/** The hard shadow's offset, and how far the face travels to meet it. */
const SHADOW_OFFSET = 4;
/** The face's height. Exported so a surface that morphs out of a button can start on its frame. */
export const BUTTON_HEIGHT = 50;
export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
  accessory,
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'onDark' | 'purchase' | 'brand';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewProps['style'];
  /** Right-aligned text inside the button, e.g. a price. */
  accessory?: string;
}) {
  const isPurchase = variant === 'purchase';
  const isFilled = variant === 'primary' || variant === 'brand' || isPurchase;
  // Disabled is one pairing for every in-sheet button: `surfaceAlt` under the
  // site's secondary gray, 4.7:1. `surfaceSunken` is the better-named token but
  // lands at 4.4:1 with that same gray, and the gray is the brand value, so the
  // fill is what gives. The purchase CTA keeps its own darker treatment below.
  const bg =
    disabled ? (isPurchase ? colors.inkMuted : colors.surfaceAlt)
    : isPurchase || variant === 'brand' ? colors.blue
    : variant === 'primary' ? colors.ink
    : variant === 'onDark' ? colors.surface
    : colors.surface;
  const fg =
    disabled ? (isPurchase ? colors.surface : colors.inkMuted)
    : isFilled ? colors.surface
    : colors.ink;
  // A disabled fill is too pale to be a shape on its own, so every disabled
  // button borrows the outlined variant's rule and draws the ink edge.
  const outlined = variant === 'secondary' || (disabled && !isPurchase);

  const inert = disabled || loading;
  // The offset outline is the button's shape, not its enabled state: a disabled
  // button keeps the layer and simply never travels onto it. [observed
  // 2026-08-28] The purchase CTA wears it too now, so every button in the app
  // is the same stacked block; blue fill and the split label stay its own.
  const shadowed = true;
  // The outline takes the button's own colour: the fill of a filled button, the
  // ink frame of an outlined one. A blue purchase CTA gets a blue layer, a
  // white `onDark` button a white one, so the stack always reads as one object.
  const shadowColor = outlined ? colors.ink : bg;
  const reduced = useReducedMotion();
  const [pressed, setPressed] = useState(false);

  const face = {
    transform: [
      { translateX: shadowed && !inert && pressed ? SHADOW_OFFSET : 0 },
      { translateY: shadowed && !inert && pressed ? SHADOW_OFFSET : 0 },
    ],
    transitionProperty: ['transform'] as const,
    transitionDuration: reduced ? 0 : motion.press,
    transitionTimingFunction: 'ease-out' as const,
  };

  return (
    <View style={[styles.buttonWrap, style]}>
      {shadowed ? <View style={[styles.buttonShadow, { borderColor: shadowColor }]} /> : null}
      <Animated.View style={face}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !!inert, busy: !!loading }}
        disabled={inert}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        onPress={() => {
          if (inert) return;
          onPress?.();
        }}
        style={[
          styles.button,
          { backgroundColor: bg },
          outlined && { borderWidth: border.heavy, borderColor: colors.ink },
          isPurchase && styles.purchaseButton,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={fg} />
        ) : (
          <>
            <Txt variant={isPurchase ? 'body' : 'button'} c={fg}>
              {title}
            </Txt>
            {accessory ? (
              <Txt
                variant={isPurchase ? 'price' : 'button'}
                c={fg}
                style={isPurchase ? undefined : styles.accessory}
              >
                {isPurchase ? accessory : `  ·  ${accessory}`}
              </Txt>
            ) : null}
          </>
        )}
      </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  buttonWrap: { position: 'relative' },
  /**
   * The offset layer is an outline, not a filled block: the same `heavy` frame
   * the secondary button wears, in the button's own colour, so a primary and a
   * secondary button stacked together read as one family. The face covers all
   * but a 4pt L of it.
   */
  buttonShadow: {
    position: 'absolute',
    left: SHADOW_OFFSET,
    top: SHADOW_OFFSET,
    right: -SHADOW_OFFSET,
    bottom: -SHADOW_OFFSET,
    borderWidth: border.heavy,
  },
  button: {
    height: BUTTON_HEIGHT,
    borderRadius: radius.none,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
  },
  purchaseButton: { justifyContent: 'space-between' },
  accessory: { opacity: 0.85 },
});
