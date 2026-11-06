import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';

import { radii, useTheme } from '../theme';
import { groupRowStyle, type RowPosition, rowPosition } from './ui';

const NATIVE = Platform.OS !== 'web';

/** Placeholder card that pulses while results load. */
export function SkeletonCard({ position = 'only' }: { position?: RowPosition }) {
  const { colors } = useTheme();
  const [opacity] = useState(() => new Animated.Value(0.5));

  useEffect(() => {
    const step = (toValue: number) =>
      Animated.timing(opacity, {
        toValue,
        duration: 700,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: NATIVE,
      });
    const loop = Animated.loop(Animated.sequence([step(1), step(0.5)]));
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  const bar = { backgroundColor: colors.surfaceMuted, borderRadius: radii.sm };
  return (
    <Animated.View style={[styles.card, groupRowStyle(position, colors), { opacity }]}>
      <View style={styles.lines}>
        <View style={[bar, styles.title]} />
        <View style={[bar, styles.address]} />
      </View>
      <View style={[bar, styles.badge]} />
    </Animated.View>
  );
}

/** Three dots that pulse in turn, shown while an answer is on its way. */
export function ThinkingDots() {
  const { colors } = useTheme();
  const [values] = useState(() => [0, 1, 2].map(() => new Animated.Value(0.3)));

  useEffect(() => {
    const loops = values.map((value, i) => {
      const step = (toValue: number) =>
        Animated.timing(value, { toValue, duration: 400, useNativeDriver: NATIVE });
      return Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          step(1),
          step(0.3),
          Animated.delay(480 - i * 160),
        ]),
      );
    });
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [values]);

  return (
    <View
      style={styles.dots}
      accessibilityLabel="Waiting for the answer"
      accessibilityRole="progressbar"
    >
      {values.map((opacity, i) => (
        <Animated.View
          key={i}
          style={[styles.dotItem, { backgroundColor: colors.textTertiary, opacity }]}
        />
      ))}
    </View>
  );
}

export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <View style={styles.list} accessibilityLabel="Loading results" accessibilityRole="progressbar">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} position={rowPosition(i, count)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {},
  card: { padding: 12, flexDirection: 'row', gap: 12, alignItems: 'center' },
  lines: { flex: 1, gap: 8 },
  title: { height: 14, width: '60%' },
  address: { height: 11, width: '85%' },
  badge: { height: 14, width: 40 },
  dots: { flexDirection: 'row', gap: 6, paddingVertical: 8 },
  dotItem: { width: 8, height: 8, borderRadius: 4 },
});
