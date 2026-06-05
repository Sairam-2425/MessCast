import React from 'react';
import { ViewStyle, StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

interface AnimatedPressableProps {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  /** Light haptic on tap, medium on long-press. Default true. */
  haptic?: boolean;
}

export function AnimatedPressable({
  children,
  onPress,
  onLongPress,
  style,
  disabled,
  haptic = true,
}: AnimatedPressableProps) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const tap = Gesture.Tap()
    .onBegin(() => {
      if (disabled) return;
      scale.value = withSpring(0.97, { damping: 18, stiffness: 200 });
      if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    })
    .onFinalize(() => {
      scale.value = withSpring(1, { damping: 18, stiffness: 200 });
    })
    .onEnd(() => {
      if (!disabled) onPress?.();
    })
    .runOnJS(true);

  const longPress = Gesture.LongPress()
    .minDuration(500)
    .onStart(() => {
      if (!disabled) {
        if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onLongPress?.();
      }
    })
    .runOnJS(true);

  const composed = Gesture.Simultaneous(tap, longPress);

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[animStyle, style]}>{children}</Animated.View>
    </GestureDetector>
  );
}
