import React, { useEffect, useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { AvatarWithRing } from '../ui/AvatarWithRing';
import { Colors, FontSize, FontWeight, Radius, Spacing, Shadow } from '../../constants/theme';
import { BASE_URL } from '../../constants/config';
import { useAuthStore } from '../../store/authStore';
import { useChatStore } from '../../store/chatStore';
import { Message } from '../../store/messageStore';
import api from '../../lib/axios';

interface ForwardPickerProps {
  visible: boolean;
  message: Message | null;
  onClose: () => void;
}

export function ForwardPicker({ visible, message, onClose }: ForwardPickerProps) {
  const user          = useAuthStore((s) => s.user);
  const conversations = useChatStore((s) => s.conversations);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending]   = useState(false);

  const translateY = useSharedValue(400);
  const opacity    = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setSelected(new Set());
      opacity.value    = withTiming(1, { duration: 180 });
      translateY.value = withSpring(0, { damping: 22, stiffness: 280 });
    } else {
      opacity.value    = withTiming(0, { duration: 150 });
      translateY.value = withTiming(400, { duration: 180 });
    }
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const sheetStyle    = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const items = useMemo(() => {
    return conversations.map((c) => {
      const isDirect = c.type === 'direct';
      const other    = isDirect ? c.members.find((m) => m._id !== user?.id) : null;
      const name     = isDirect ? (other?.displayName ?? 'Unknown') : (c.groupName ?? 'Group');
      const avatar   = isDirect ? (other?.avatarUrl ?? null) : (c.groupAvatar ?? null);
      return { c, name, avatar };
    });
  }, [conversations, user?.id]);

  function toggle(id: string) {
    Haptics.selectionAsync();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function send() {
    if (!message || selected.size === 0) return;
    setSending(true);
    try {
      await api.post('/api/messages/forward', {
        messageId:       message._id,
        conversationIds: Array.from(selected),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch {
      Alert.alert('Error', 'Could not forward message. Please try again.');
    } finally {
      setSending(false);
    }
  }

  if (!visible && !message) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.backdrop, backdropStyle]} />
      </TouchableWithoutFeedback>

      <Animated.View style={[styles.sheet, sheetStyle]}>
        <View style={styles.header}>
          <Text style={styles.title}>Forward to…</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="x" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Message preview */}
        {message && (
          <View style={styles.preview}>
            <Feather name="share-2" size={13} color={Colors.textTertiary} style={{ marginRight: 6 }} />
            <Text style={styles.previewText} numberOfLines={1}>
              {message.type === 'file'
                ? `📎 ${message.fileName ?? 'File'}`
                : message.content ?? ''}
            </Text>
          </View>
        )}

        <FlatList
          data={items}
          keyExtractor={(item) => item.c.id}
          style={styles.list}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const isSelected = selected.has(item.c.id);
            const fullAvatar = item.avatar
              ? item.avatar.startsWith('http') ? item.avatar : `${BASE_URL}${item.avatar}`
              : null;
            return (
              <TouchableOpacity
                style={[styles.row, isSelected && styles.rowSelected]}
                onPress={() => toggle(item.c.id)}
                activeOpacity={0.7}
              >
                <AvatarWithRing
                  avatarUrl={fullAvatar}
                  displayName={item.name}
                  size={44}
                />
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                <View style={[styles.check, isSelected && styles.checkActive]}>
                  {isSelected && <Feather name="check" size={13} color="#fff" />}
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.empty}>No conversations yet</Text>
          }
        />

        {selected.size > 0 && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
              onPress={send}
              disabled={sending}
              activeOpacity={0.8}
            >
              {sending
                ? <ActivityIndicator size="small" color="#fff" />
                : <>
                    <Feather name="send" size={16} color="#fff" />
                    <Text style={styles.sendLabel}>
                      Forward{selected.size > 1 ? ` (${selected.size})` : ''}
                    </Text>
                  </>
              }
            </TouchableOpacity>
          </View>
        )}
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
    maxHeight:       '70%',
    backgroundColor: Colors.bgLayer1,
    borderTopLeftRadius:  Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderTopWidth:  1,
    borderTopColor:  Colors.glassBorder,
    paddingBottom:   34,
    ...Shadow.subtle,
  },
  header: {
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical:   Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.glassBorder,
  },
  title: {
    color:      Colors.textPrimary,
    fontSize:   FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  preview: {
    flexDirection:    'row',
    alignItems:       'center',
    marginHorizontal: Spacing.lg,
    marginTop:        Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical:   Spacing.sm,
    backgroundColor:  Colors.bgLayer2,
    borderRadius:     Radius.md,
    borderWidth:      1,
    borderColor:      Colors.glassBorder,
  },
  previewText: {
    flex:     1,
    color:    Colors.textSecondary,
    fontSize: FontSize.sm,
  },
  list: { flex: 1, marginTop: Spacing.sm },
  row: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical:   Spacing.md,
  },
  rowSelected: {
    backgroundColor: 'rgba(124,92,252,0.06)',
  },
  name: {
    flex:       1,
    color:      Colors.textPrimary,
    fontSize:   FontSize.md,
    fontWeight: FontWeight.medium,
  },
  check: {
    width:        22,
    height:       22,
    borderRadius: 11,
    borderWidth:  2,
    borderColor:  Colors.glassBorder,
    alignItems:   'center',
    justifyContent: 'center',
  },
  checkActive: {
    backgroundColor: Colors.primary,
    borderColor:     Colors.primary,
  },
  empty: {
    color:     Colors.textTertiary,
    textAlign: 'center',
    padding:   Spacing.xl,
    fontSize:  FontSize.sm,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop:        Spacing.md,
    borderTopWidth:    StyleSheet.hairlineWidth,
    borderTopColor:    Colors.glassBorder,
  },
  sendBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius:    Radius.lg,
    paddingVertical: 14,
    ...Shadow.neonPrimary,
    shadowOpacity: 0.4,
  },
  sendBtnDisabled: { opacity: 0.6 },
  sendLabel: {
    color:      '#fff',
    fontSize:   FontSize.md,
    fontWeight: FontWeight.semibold,
  },
});
