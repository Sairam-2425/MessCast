import React, { useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  ScrollView,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Radius, Spacing, Shadow } from '../../constants/theme';
import { Message } from '../../store/messageStore';
import { ALLOWED_REACTIONS } from '../../constants/config';

export interface ContextAction {
  label: string;
  icon: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
  disabledHint?: string;
}

interface MessageContextMenuProps {
  visible: boolean;
  message: Message | null;
  isSent: boolean;
  actions: ContextAction[];
  currentUserId: string;
  onReact: (emoji: string) => void;
  onClose: () => void;
}

export function MessageContextMenu({
  visible,
  message,
  isSent,
  actions,
  onReact,
  onClose,
}: MessageContextMenuProps) {
  const translateY = useSharedValue(300);
  const opacity    = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value    = withTiming(1, { duration: 180 });
      translateY.value = withSpring(0, { damping: 22, stiffness: 280 });
    } else {
      opacity.value    = withTiming(0, { duration: 150 });
      translateY.value = withTiming(300, { duration: 180 });
    }
  }, [visible]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!visible && !message) return null;

  const myReaction = message?.reactions?.find((r) =>
    r.users.includes(message ? '' : '')
  )?.emoji;

  function handleReact(emoji: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onReact(emoji);
    onClose();
  }

  function handleAction(action: ContextAction) {
    if (action.disabled) return;
    onClose();
    // Small delay so the menu closes before any Alert that the action might show
    setTimeout(() => action.onPress(), 80);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Dark backdrop — tap to close */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.backdrop, backdropStyle]} />
      </TouchableWithoutFeedback>

      {/* Bottom sheet */}
      <Animated.View style={[styles.sheet, sheetStyle]}>

        {/* Message preview */}
        {message && (
          <View style={[styles.preview, isSent ? styles.previewSent : styles.previewReceived]}>
            {message.type === 'text' ? (
              <Text style={styles.previewText} numberOfLines={3}>{message.content}</Text>
            ) : (
              <View style={styles.previewFile}>
                <Feather name="paperclip" size={14} color={Colors.textSecondary} />
                <Text style={styles.previewText} numberOfLines={1}>{message.fileName ?? 'File'}</Text>
              </View>
            )}
          </View>
        )}

        {/* Emoji reaction strip — hidden for your own messages (you can't react to yourself) */}
        {!isSent && (
          <>
            <View style={styles.reactionStrip}>
              {ALLOWED_REACTIONS.map((emoji) => {
                const isActive = myReaction === emoji;
                return (
                  <TouchableOpacity
                    key={emoji}
                    style={[styles.reactionBtn, isActive && styles.reactionBtnActive]}
                    onPress={() => handleReact(emoji)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.reactionEmoji}>{emoji}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.divider} />
          </>
        )}

        {/* Action list */}
        <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
          {actions.map((action, i) => (
            <TouchableOpacity
              key={i}
              style={[
                styles.actionRow,
                action.disabled && styles.actionRowDisabled,
                i < actions.length - 1 && styles.actionRowBorder,
              ]}
              onPress={() => handleAction(action)}
              activeOpacity={action.disabled ? 1 : 0.65}
            >
              <Feather
                name={action.icon as any}
                size={18}
                color={action.disabled
                  ? Colors.textTertiary
                  : action.destructive
                  ? Colors.error
                  : Colors.textPrimary}
              />
              <View style={styles.actionLabelCol}>
                <Text
                  style={[
                    styles.actionLabel,
                    action.disabled && styles.actionLabelDisabled,
                    action.destructive && !action.disabled && styles.actionLabelDestructive,
                  ]}
                >
                  {action.label}
                </Text>
                {action.disabled && action.disabledHint ? (
                  <Text style={styles.actionHint}>{action.disabledHint}</Text>
                ) : null}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Cancel button */}
        <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>

      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },

  sheet: {
    position:        'absolute',
    bottom:          0,
    left:            0,
    right:           0,
    backgroundColor: Colors.bgLayer1,
    borderTopLeftRadius:  Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderTopWidth:  1,
    borderTopColor:  Colors.glassBorder,
    paddingTop:      Spacing.md,
    paddingBottom:   34,
    ...Shadow.subtle,
  },

  preview: {
    marginHorizontal: Spacing.lg,
    marginBottom:     Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical:   Spacing.sm,
    borderRadius:      Radius.md,
    borderWidth:       1,
  },
  previewSent: {
    backgroundColor: 'rgba(124,92,252,0.12)',
    borderColor:     'rgba(124,92,252,0.25)',
  },
  previewReceived: {
    backgroundColor: Colors.bgLayer2,
    borderColor:     Colors.glassBorder,
  },
  previewFile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  previewText: {
    color:    Colors.textSecondary,
    fontSize: FontSize.sm,
    lineHeight: 18,
  },

  reactionStrip: {
    flexDirection:    'row',
    justifyContent:   'space-around',
    paddingHorizontal: Spacing.lg,
    paddingVertical:   Spacing.md,
  },
  reactionBtn: {
    padding:      6,
    borderRadius: Radius.full,
  },
  reactionBtnActive: {
    backgroundColor: 'rgba(124,92,252,0.20)',
  },
  reactionEmoji: {
    fontSize: 28,
  },

  divider: {
    height:          StyleSheet.hairlineWidth,
    backgroundColor: Colors.glassBorder,
    marginHorizontal: Spacing.lg,
    marginBottom:     Spacing.xs ?? 4,
  },

  actionRow: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical:   14,
  },
  actionRowBorder: {
    borderBottomWidth:  StyleSheet.hairlineWidth,
    borderBottomColor: Colors.glassBorder,
  },
  actionRowDisabled: {
    opacity: 0.5,
  },
  actionLabelCol: {
    flex: 1,
  },
  actionLabel: {
    color:    Colors.textPrimary,
    fontSize: FontSize.md,
  },
  actionLabelDisabled: {
    color: Colors.textTertiary,
  },
  actionLabelDestructive: {
    color: Colors.error,
  },
  actionHint: {
    color:    Colors.textTertiary,
    fontSize: FontSize.xs,
    marginTop: 2,
  },

  cancelBtn: {
    marginHorizontal: Spacing.lg,
    marginTop:        Spacing.sm,
    paddingVertical:  14,
    backgroundColor:  Colors.bgLayer2,
    borderRadius:     Radius.lg,
    borderWidth:      1,
    borderColor:      Colors.glassBorder,
    alignItems:       'center',
  },
  cancelText: {
    color:      Colors.textPrimary,
    fontSize:   FontSize.md,
    fontWeight: FontWeight.semibold,
  },
});
