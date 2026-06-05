import React, { useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { format, isToday, isYesterday, isThisWeek } from 'date-fns';
import { Feather } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../constants/theme';
import { AvatarWithRing } from '../ui/AvatarWithRing';
import { NeonBadge } from '../ui/NeonBadge';
import { Conversation } from '../../store/chatStore';

const ARCHIVE_THRESHOLD = -80;
const ROW_HEIGHT = 74;

interface ChatListItemProps {
  conversation: Conversation;
  currentUserId: string;
  isPinned: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onArchive?: () => void;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  if (isToday(d))     return format(d, 'h:mm a');
  if (isYesterday(d)) return 'Yesterday';
  if (isThisWeek(d))  return format(d, 'EEE');
  return format(d, 'MMM d');
}

function getPreview(conv: Conversation): string {
  const lm = conv.lastMessage;
  if (!lm) return 'No messages yet';
  if (lm.deletedForAll) return '🚫 This message was deleted';
  if (lm.type === 'file') {
    if (lm.fileMimeType?.startsWith('image/')) return '📷 Photo';
    if (lm.fileMimeType?.startsWith('audio/')) return '🎵 Voice message';
    return `📎 ${lm.fileName ?? 'File'}`;
  }
  return lm.content ?? '';
}

function getOtherMember(conv: Conversation, userId: string) {
  return conv.members.find((m) => m._id !== userId);
}

export function ChatListItem({
  conversation,
  currentUserId,
  isPinned,
  onPress,
  onLongPress,
  onArchive,
}: ChatListItemProps) {
  const isDirect  = conversation.type === 'direct';
  const other     = isDirect ? getOtherMember(conversation, currentUserId) : null;
  const hasUnread = conversation.unreadCount > 0;

  const displayName = isDirect
    ? (other?.displayName ?? 'Unknown')
    : (conversation.groupName ?? 'Group');

  const avatarUrl = isDirect ? (other?.avatarUrl ?? null) : (conversation.groupAvatar ?? null);
  const isOnline  = isDirect ? (other?.isOnline ?? false) : false;
  const timeStr   = conversation.lastMessage?.createdAt
    ? formatTime(conversation.lastMessage.createdAt)
    : '';
  const preview = getPreview(conversation);

  // ── Swipe gesture ─────────────────────────────────────────────────────────
  const translateX   = useSharedValue(0);
  const archiveScale = useSharedValue(0.6);

  const triggerArchive = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onArchive?.();
  }, [onArchive]);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-8, 8])
    .onUpdate((e) => {
      if (e.translationX < 0) {
        translateX.value   = Math.max(e.translationX * 0.7, ARCHIVE_THRESHOLD * 1.6);
        archiveScale.value = interpolate(
          -translateX.value,
          [0, -ARCHIVE_THRESHOLD],
          [0.5, 1],
          Extrapolation.CLAMP
        );
      }
    })
    .onEnd((e) => {
      if (e.translationX <= ARCHIVE_THRESHOLD) {
        runOnJS(triggerArchive)();
      }
      translateX.value   = withSpring(0, { damping: 22, stiffness: 300 });
      archiveScale.value = withTiming(0.6, { duration: 200 });
    });

  const tapGesture = Gesture.Tap()
    .onEnd(() => runOnJS(onPress)());

  const longPressGesture = Gesture.LongPress()
    .minDuration(380)
    .onStart(() => {
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
      runOnJS(onLongPress)();
    });

  const composed = Gesture.Race(panGesture, Gesture.Simultaneous(tapGesture, longPressGesture));

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const archiveBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: archiveScale.value }],
    opacity: interpolate(-translateX.value, [0, 20, -ARCHIVE_THRESHOLD], [0, 0.6, 1], Extrapolation.CLAMP),
  }));

  return (
    <GestureDetector gesture={composed}>
      <View style={styles.container}>

        {/* Archive action revealed on swipe left */}
        <View style={styles.archiveBg}>
          <Animated.View style={[styles.archiveBtn, archiveBtnStyle]}>
            <Feather name="archive" size={20} color="#fff" />
            <Text style={styles.archiveLabel}>Archive</Text>
          </Animated.View>
        </View>

        {/* Main row slides left */}
        <Animated.View style={[styles.row, hasUnread && styles.rowUnread, rowStyle]}>
          {/* Left unread glow bar */}
          {hasUnread && <View style={styles.unreadBar} />}

          <AvatarWithRing
            avatarUrl={avatarUrl}
            displayName={displayName}
            size={52}
            isOnline={isOnline}
            showRing={isOnline || hasUnread}
          />

          <View style={styles.content}>
            {/* Top row: name + time */}
            <View style={styles.topRow}>
              <View style={styles.nameRow}>
                {isPinned && (
                  <Feather
                    name="bookmark"
                    size={11}
                    color={Colors.primary}
                    style={styles.pinIcon}
                  />
                )}
                <Text style={[styles.name, hasUnread && styles.nameUnread]} numberOfLines={1}>
                  {displayName}
                </Text>
              </View>
              <Text style={[styles.time, hasUnread && styles.timeUnread]}>{timeStr}</Text>
            </View>

            {/* Bottom row: preview + badge */}
            <View style={styles.bottomRow}>
              <Text style={[styles.preview, hasUnread && styles.previewUnread]} numberOfLines={1}>
                {preview}
              </Text>
              <NeonBadge count={conversation.unreadCount} />
            </View>
          </View>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    height:   ROW_HEIGHT,
    overflow: 'hidden',
  },

  // Archive background exposed when sliding left
  archiveBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.primary,
    alignItems:      'flex-end',
    justifyContent:  'center',
    paddingRight:    Spacing.lg,
    borderRadius:    0,
  },
  archiveBtn: {
    alignItems:  'center',
    gap:         3,
  },
  archiveLabel: {
    color:      '#fff',
    fontSize:   FontSize.xs,
    fontWeight: FontWeight.semibold,
  },

  row: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 11,
    gap:            Spacing.md,
    borderBottomWidth:  StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
    backgroundColor: Colors.bgBase,
    height:         ROW_HEIGHT,
  },
  rowUnread: {
    backgroundColor: 'rgba(124,92,252,0.04)',
  },
  unreadBar: {
    position:    'absolute',
    left:        0,
    top:         0,
    bottom:      0,
    width:       3,
    backgroundColor: Colors.primary,
    shadowColor:     Colors.primary,
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:   0.9,
    shadowRadius:    6,
  },
  content: { flex: 1 },
  topRow: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    marginBottom:    4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems:    'center',
    flex:          1,
    marginRight:   8,
    gap:           4,
  },
  pinIcon:   { marginTop: 1 },
  name: {
    color:      Colors.textPrimary,
    fontSize:   FontSize.md,
    fontWeight: FontWeight.medium,
    flex:       1,
  },
  nameUnread: {
    fontWeight: FontWeight.bold,
    color:      '#FFFFFF',
  },
  time: {
    color:    Colors.textTertiary,
    fontSize: FontSize.xs,
  },
  timeUnread: {
    color:      Colors.primary,
    fontWeight: FontWeight.semibold,
  },
  bottomRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    gap:            8,
  },
  preview: {
    color:    Colors.textSecondary,
    fontSize: FontSize.sm,
    flex:     1,
  },
  previewUnread: {
    color:      Colors.textPrimary,
    fontWeight: FontWeight.medium,
  },
});
