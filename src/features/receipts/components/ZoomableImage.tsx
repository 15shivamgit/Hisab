// One zoomable receipt (RCP-04), built on gesture-handler + Reanimated (no extra library).
// Pinch zooms 1×–5× and the zoom stays after the fingers lift; double-tap toggles 2.5×;
// one-finger pan works only while zoomed and stops at the image edges.

import { useMemo } from 'react';
import { Image, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { clampOffset, clampScale, DOUBLE_TAP_SCALE, MIN_SCALE } from '@/features/receipts/zoomMath';

interface ZoomableImageProps {
  uri: string;
  /** Image size after fitting it on screen. */
  width: number;
  height: number;
  /** The page (screen) size. */
  containerWidth: number;
  containerHeight: number;
  /** Tells the pager to stop swiping while zoomed. */
  onZoomChange: (zoomed: boolean) => void;
  accessibilityLabel: string;
}

const TIMING = { duration: 200 };

export function ZoomableImage({
  uri,
  width,
  height,
  containerWidth,
  containerHeight,
  onZoomChange,
  accessibilityLabel,
}: ZoomableImageProps) {
  const scale = useSharedValue(MIN_SCALE);
  const startScale = useSharedValue(MIN_SCALE);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  // Shared values use get()/set() (not `.value =`) so the React Compiler rules are happy.
  const gesture = useMemo(() => {
    const settle = (nextScale: number) => {
      'worklet';
      const nx = clampOffset(x.get(), width, containerWidth, nextScale);
      const ny = clampOffset(y.get(), height, containerHeight, nextScale);
      scale.set(withTiming(nextScale, TIMING));
      x.set(withTiming(nx, TIMING));
      y.set(withTiming(ny, TIMING));
      scheduleOnRN(onZoomChange, nextScale > MIN_SCALE);
    };

    const pinch = Gesture.Pinch()
      .onStart(() => {
        startScale.set(scale.get());
      })
      .onUpdate((e) => {
        const next = clampScale(startScale.get() * e.scale);
        scale.set(next);
        x.set(clampOffset(x.get(), width, containerWidth, next));
        y.set(clampOffset(y.get(), height, containerHeight, next));
      })
      .onEnd(() => {
        // Keep the zoom; just snap tiny zooms back to exactly 1×.
        const current = scale.get();
        settle(current < 1.05 ? MIN_SCALE : current);
      });

    const pan = Gesture.Pan()
      .maxPointers(1)
      // Only claims the touch when zoomed, so the pager can swipe at 1×.
      .manualActivation(true)
      .onTouchesMove((_e, state) => {
        if (scale.get() > MIN_SCALE) state.activate();
        else state.fail();
      })
      .onStart(() => {
        startX.set(x.get());
        startY.set(y.get());
      })
      .onUpdate((e) => {
        const s = scale.get();
        x.set(clampOffset(startX.get() + e.translationX, width, containerWidth, s));
        y.set(clampOffset(startY.get() + e.translationY, height, containerHeight, s));
      });

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .onEnd(() => {
        if (scale.get() > MIN_SCALE) {
          x.set(withTiming(0, TIMING));
          y.set(withTiming(0, TIMING));
          scale.set(withTiming(MIN_SCALE, TIMING));
          scheduleOnRN(onZoomChange, false);
        } else {
          settle(DOUBLE_TAP_SCALE);
        }
      });

    return Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan));
  }, [
    width,
    height,
    containerWidth,
    containerHeight,
    onZoomChange,
    scale,
    startScale,
    x,
    y,
    startX,
    startY,
  ]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { translateY: y.get() }, { scale: scale.get() }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.page, { width: containerWidth, height: containerHeight }]}>
        <Animated.View style={animatedStyle}>
          <Image
            source={{ uri }}
            style={{ width, height }}
            resizeMode="contain"
            accessibilityLabel={accessibilityLabel}
            accessibilityHint="Pinch or double-tap to zoom"
          />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  page: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
