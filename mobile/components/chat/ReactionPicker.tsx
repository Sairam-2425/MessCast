import React, { useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Colors, Radius, Shadow, Spacing } from '../../constants/theme';
import { ALLOWED_REACTIONS } from '../../constants/config';

interface ReactionPickerProps {
  visible: boolean;
  onReact: (emoji: string) => void;
  onClose: () => void;
}

export function ReactionPicker({ visible, onReact, onClose }: ReactionPickerProps) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, { damping: 12, stiffness: 200 });
      opacity.value = withSpring(1);
    } else {
      scale.value = withSpring(0);
      opacity.value = withSpring(0);
    }
  }, [visible]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, animStyle]}>
      {ALLOWED_REACTIONS.map((emoji) => (
        <TouchableOpacity
          key={emoji}
          style={styles.emoji}
          onPress={() => {
            onReact(emoji);
            onClose();
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.emojiText}>{emoji}</Text>
        </TouchableOpacity>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.bgLayer2,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    gap: 4,
    ...Shadow.subtle,
  },
  emoji: {
    padding: 4,
  },
  emojiText: {
    fontSize: 24,
  },
});
