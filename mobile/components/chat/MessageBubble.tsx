import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Colors, FontSize, Radius, Spacing } from '../../constants/theme';
import { BASE_URL } from '../../constants/config';
import { Message } from '../../store/messageStore';
import { ReplyPreview } from './ReplyPreview';
import { ReactionBar } from './ReactionBar';
import { ReadReceipt } from './ReadReceipt';
import { VoiceMessageBubble } from './VoiceMessageBubble';

interface MessageBubbleProps {
  message: Message;
  isSent: boolean;
  isGroup: boolean;
  showAvatar: boolean;
  memberCount: number;
  currentUserId: string;
  isAdmin: boolean;
  onReply: (msg: Message) => void;
  onLongPress: (msg: Message) => void;
  onImagePress?: (url: string) => void;
  onReact?: (messageId: string, emoji: string) => void;
  conversationId: string;
}

const SWIPE_THRESHOLD = 58;

// ── Chat image with loading / error / retry states ───────────────────────────
// Wrapping the <Image> in a clipped container (rather than putting borderRadius
// directly on the Image) avoids the solid-black-rectangle rendering glitch that
// shows up for rounded images on some Android release builds.
function ChatImage({ uri, onPress }: { uri: string | null; onPress: () => void }) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    setStatus('loading');
  }, [uri]);

  if (!uri) {
    return (
      <View style={[styles.imageThumbnail, styles.imageCenter]}>
        <Feather name="image" size={28} color={Colors.textTertiary} />
      </View>
    );
  }

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} disabled={status !== 'loaded'}>
      <View style={styles.imageThumbnail}>
        <Image
          key={retryKey}
          source={{ uri }}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
          onLoadStart={() => setStatus('loading')}
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
        />
        {status === 'loading' && (
          <View style={[StyleSheet.absoluteFillObject, styles.imageCenter]}>
            <ActivityIndicator color={Colors.textTertiary} />
          </View>
        )}
        {status === 'error' && (
          <TouchableOpacity
            style={[StyleSheet.absoluteFillObject, styles.imageCenter]}
            onPress={() => { setStatus('loading'); setRetryKey((k) => k + 1); }}
            activeOpacity={0.7}
          >
            <Feather name="refresh-cw" size={20} color={Colors.textSecondary} />
            <Text style={styles.imageErrorText}>Tap to retry</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

export function MessageBubble({
  message,
  isSent,
  isGroup,
  memberCount,
  currentUserId,
  onReply,
  onLongPress,
  onImagePress,
  onReact,
}: MessageBubbleProps) {
  // ── Entry animation ──────────────────────────────────────────────────────────
  const translateY = useSharedValue(10);
  const opacity    = useSharedValue(0);
  useEffect(() => {
    translateY.value = withSpring(0, { damping: 18, stiffness: 180 });
    opacity.value    = withTiming(1, { duration: 140 });
  }, []);

  const entryStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity:   opacity.value,
  }));

  // ── Swipe-to-reply ───────────────────────────────────────────────────────────
  const swipeX       = useSharedValue(0);
  const replyOpacity = useSharedValue(0);

  const triggerReply = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onReply(message);
  }, [message, onReply]);

  const panGesture = Gesture.Pan()
    .activeOffsetX(isSent ? [-8, 8] : [8, 999])
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      const dx = isSent ? Math.min(-e.translationX, 0) : Math.max(e.translationX, 0);
      if ((isSent && e.translationX < 0) || (!isSent && e.translationX > 0)) {
        const raw = isSent ? -e.translationX : e.translationX;
        swipeX.value       = (isSent ? -1 : 1) * Math.min(raw * 0.65, SWIPE_THRESHOLD + 18);
        replyOpacity.value = Math.min(raw / SWIPE_THRESHOLD, 1);
      }
    })
    .onEnd((e) => {
      const raw = isSent ? -e.translationX : e.translationX;
      if (raw >= SWIPE_THRESHOLD) {
        runOnJS(triggerReply)();
      }
      swipeX.value       = withSpring(0, { damping: 22, stiffness: 320 });
      replyOpacity.value = withTiming(0, { duration: 120 });
    });

  const swipeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: swipeX.value }],
  }));

  const replyIconStyle = useAnimatedStyle(() => ({
    opacity:   replyOpacity.value,
    transform: [{ scale: 0.6 + replyOpacity.value * 0.4 }],
  }));

  // ── Long-press ───────────────────────────────────────────────────────────────
  const longPressGesture = Gesture.LongPress()
    .minDuration(380)
    .onStart(() => {
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
      runOnJS(onLongPress)(message);
    });

  const composed = Gesture.Race(panGesture, longPressGesture);

  // ── Deleted state ─────────────────────────────────────────────────────────────
  if (message.deletedForAll) {
    return (
      <Animated.View style={[styles.row, isSent ? styles.sentRow : styles.receivedRow, entryStyle]}>
        <View style={styles.deletedBubble}>
          <Feather name="slash" size={12} color={Colors.textTertiary} style={{ marginRight: 5 }} />
          <Text style={styles.deletedText}>This message was deleted</Text>
        </View>
      </Animated.View>
    );
  }

  const _date = new Date(message.createdAt);
  const time  = isNaN(_date.getTime()) ? '' : format(_date, 'h:mm a');

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[styles.row, isSent ? styles.sentRow : styles.receivedRow, entryStyle]}>

        {/* Reply icon (appears while swiping) */}
        <Animated.View
          style={[
            styles.replyIcon,
            isSent ? styles.replyIconLeft : styles.replyIconRight,
            replyIconStyle,
          ]}
        >
          <View style={styles.replyIconCircle}>
            <Feather name="corner-up-left" size={14} color={Colors.primary} />
          </View>
        </Animated.View>

        <Animated.View style={[isSent ? styles.sentWrapper : styles.receivedWrapper, swipeStyle]}>

          {/* Group sender name */}
          {isGroup && !isSent && (
            <Text style={styles.senderName}>{message.sender.displayName}</Text>
          )}

          {/* Bubble */}
          <View style={[styles.bubble, isSent ? styles.sentBubble : styles.receivedBubble]}>

            {/* Forwarded label */}
            {message.isForwarded && (
              <View style={styles.forwardedRow}>
                <Feather name="share-2" size={10} color={isSent ? 'rgba(255,255,255,0.55)' : Colors.textTertiary} />
                <Text style={[styles.forwardedLabel, isSent && styles.forwardedLabelSent]}>Forwarded</Text>
              </View>
            )}

            {/* Reply preview */}
            {message.replyTo && (
              <ReplyPreview
                senderName={message.replyTo.sender.displayName}
                content={message.replyTo.content}
                fileName={message.replyTo.fileName}
                type={message.replyTo.type}
                isSent={isSent}
              />
            )}

            {/* Content */}
            {message.type === 'text' ? (
              <Text style={styles.text}>{message.content}</Text>
            ) : message.fileMimeType?.startsWith('image/') ? (
              <ChatImage
                uri={message.fileUrl
                  ? message.fileUrl.startsWith('http')
                    ? message.fileUrl
                    : `${BASE_URL}${message.fileUrl}`
                  : null}
                onPress={() => {
                  const url = message.fileUrl
                    ? message.fileUrl.startsWith('http')
                      ? message.fileUrl
                      : `${BASE_URL}${message.fileUrl}`
                    : null;
                  if (url) onImagePress?.(url);
                }}
              />
            ) : message.fileMimeType?.startsWith('audio/') ? (
              <VoiceMessageBubble fileUrl={message.fileUrl!} isSent={isSent} />
            ) : (
              <View style={styles.fileRow}>
                <Text style={styles.fileIcon}>📎</Text>
                <Text style={styles.fileText} numberOfLines={2}>{message.fileName ?? 'File'}</Text>
              </View>
            )}

            {/* Meta: edited label + timestamp + read receipt */}
            <View style={styles.meta}>
              {message.isEdited && (
                <Text style={styles.editedLabel}>Edited</Text>
              )}
              {time ? <Text style={[styles.time, isSent && styles.timeSent]}>{time}</Text> : null}
              {isSent && (
                <ReadReceipt
                  sentCount={1}
                  deliveredCount={message.deliveredTo?.length ?? 0}
                  readCount={message.readBy?.length ?? 0}
                  memberCount={memberCount}
                />
              )}
            </View>
          </View>

          {/* Reactions */}
          <ReactionBar
            reactions={message.reactions ?? []}
            currentUserId={currentUserId}
            disabled={isSent}
            onReact={(emoji) => onReact?.(message._id, emoji)}
          />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  row: { marginVertical: 2, paddingHorizontal: Spacing.md },
  sentRow:      { alignItems: 'flex-end',   flexDirection: 'row', justifyContent: 'flex-end' },
  receivedRow:  { alignItems: 'flex-end',   flexDirection: 'row', justifyContent: 'flex-start' },
  sentWrapper:     { alignItems: 'flex-end',   maxWidth: '82%' },
  receivedWrapper: { alignItems: 'flex-start', maxWidth: '82%' },

  replyIcon: {
    position: 'absolute',
    bottom:   10,
    zIndex:   0,
  },
  replyIconLeft:  { left: 2 },
  replyIconRight: { right: 2 },
  replyIconCircle: {
    width:           30,
    height:          30,
    borderRadius:    15,
    backgroundColor: Colors.bgLayer2,
    borderWidth:     1,
    borderColor:     Colors.glassBorder,
    alignItems:      'center',
    justifyContent:  'center',
  },

  senderName: {
    color:        Colors.primary,
    fontSize:     FontSize.xs,
    fontWeight:   '600',
    marginBottom: 3,
    marginLeft:   14,
  },

  bubble: {
    borderRadius:     Radius.xl,
    paddingHorizontal: Spacing.md,
    paddingTop:       Spacing.sm,
    paddingBottom:    Spacing.sm,
    maxWidth:         '100%',
  },
  sentBubble: {
    backgroundColor:  Colors.primary,
    borderBottomRightRadius: Radius.xs,
    shadowColor:      Colors.primary,
    shadowOffset:     { width: 0, height: 2 },
    shadowOpacity:    0.3,
    shadowRadius:     6,
    elevation:        2,
  },
  receivedBubble: {
    backgroundColor:        Colors.receivedBubbleBg,
    borderWidth:            1,
    borderColor:            Colors.receivedBubbleBorder,
    borderBottomLeftRadius: Radius.xs,
  },

  text: {
    color:      Colors.textPrimary,
    fontSize:   FontSize.md,
    lineHeight: 21,
    letterSpacing: 0.1,
  },

  forwardedRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            4,
    marginBottom:   4,
    opacity:        0.8,
  },
  forwardedLabel: {
    color:     Colors.textTertiary,
    fontSize:  10,
    fontStyle: 'italic',
  },
  forwardedLabelSent: {
    color: 'rgba(255,255,255,0.55)',
  },

  imageThumbnail: {
    width: 200,
    height: 200,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: Colors.bgLayer2,
  },
  imageCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  imageErrorText: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
  },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fileIcon: { fontSize: 16 },
  fileText: { color: Colors.textPrimary, fontSize: FontSize.sm, flex: 1 },

  meta: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    marginTop:     5,
    alignSelf:     'flex-end',
  },
  editedLabel: {
    color:    'rgba(255,255,255,0.45)',
    fontSize: 9,
    fontStyle: 'italic',
  },
  time: {
    color:    'rgba(240,240,255,0.45)',
    fontSize: 10,
  },
  timeSent: {
    color: 'rgba(255,255,255,0.55)',
  },

  deletedBubble: {
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  Colors.glassBg,
    borderWidth:      1,
    borderColor:      Colors.glassBorder,
    borderRadius:     Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical:  Spacing.sm,
  },
  deletedText: {
    color:     Colors.textTertiary,
    fontSize:  FontSize.sm,
    fontStyle: 'italic',
  },
});
