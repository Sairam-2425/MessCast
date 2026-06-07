import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Text,
  ActivityIndicator,
  Alert,
  PanResponder,
  Keyboard,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { Colors, FontSize, Radius, Spacing } from '../../constants/theme';
import { Message } from '../../store/messageStore';
import { getSocket } from '../../lib/socket';
import api from '../../lib/axios';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface InputBarProps {
  conversationId: string;
  replyingTo: Message | null;
  onCancelReply: () => void;
  onMessageSent: (msg: Message) => void;
  editingMessage?: Message | null;
  onCancelEdit?: () => void;
  onEditSubmit?: (content: string) => void;
}

export function InputBar({
  conversationId,
  replyingTo,
  onCancelReply,
  onMessageSent,
  editingMessage,
  onCancelEdit,
  onEditSubmit,
}: InputBarProps) {
  const insets = useSafeAreaInsets();
  const [text, setText]           = useState('');
  const [uploading, setUploading] = useState(false);

  // ── Voice recording ─────────────────────────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [recDuration, setRecDuration] = useState(0);
  const [cancelSlide, setCancelSlide] = useState(false);
  const recordingRef   = useRef<Audio.Recording | null>(null);
  const isRecordingRef = useRef(false);
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const startXRef      = useRef(0);

  // Pre-fill text when entering edit mode
  useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.content ?? '');
    } else {
      setText('');
    }
  }, [editingMessage?._id]);

  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const socket      = getSocket();

  const sendScale     = useSharedValue(1);
  const sendAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendScale.value }],
  }));

  const canSend       = text.trim().length > 0;

  // While the keyboard is open, the OS keyboard surface already covers the
  // bottom safe area — adding the inset on top of it would leave a dead gap
  // between the input bar and the keyboard.
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvt, () => setKeyboardVisible(false));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const bottomPadding = keyboardVisible ? 8 : (insets.bottom > 0 ? insets.bottom : 8);

  function emitTyping() {
    socket.emit('typing', { conversationId });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socket.emit('stop_typing', { conversationId });
    }, 3000);
  }

  async function sendText() {
    if (!canSend) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const content = text.trim();
    setText('');
    if (typingTimer.current) clearTimeout(typingTimer.current);
    socket.emit('stop_typing', { conversationId });

    if (editingMessage && onEditSubmit) {
      onEditSubmit(content);
      return;
    }

    try {
      const { data } = await api.post('/api/messages/text', {
        conversationId,
        content,
        replyTo: replyingTo?._id,
      });
      onMessageSent(data);
      onCancelReply();
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to send message');
    }
  }

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: false,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      await uploadFile(
        result.assets[0].uri,
        result.assets[0].mimeType ?? 'image/jpeg',
        result.assets[0].fileName ?? 'image.jpg',
      );
    }
  }

  async function pickDocument() {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (!result.canceled && result.assets?.[0]) {
      const { uri, mimeType, name } = result.assets[0];
      await uploadFile(uri, mimeType ?? 'application/octet-stream', name);
    }
  }

  async function uploadFile(uri: string, mimeType: string, fileName: string) {
    setUploading(true);
    try {
      let fileSize: number | null = null;
      try {
        const info = await FileSystem.getInfoAsync(uri);
        if (info.exists && !info.isDirectory) fileSize = info.size ?? null;
      } catch {
        // content:// URIs from some Android pickers can't be probed — non-fatal
      }
      console.log('[Upload] starting', { uri, mimeType, fileName, fileSize });

      if (fileSize === 0) {
        Alert.alert('Error', 'The selected file appears to be empty. Please try again.');
        return;
      }

      const formData = new FormData();
      formData.append('file', { uri, type: mimeType, name: fileName } as unknown as Blob);
      formData.append('conversationId', conversationId);
      if (replyingTo) formData.append('replyTo', replyingTo._id);
      const { data } = await api.post('/api/messages/file', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      console.log('[Upload] response received', {
        messageId: data?._id,
        fileUrl: data?.fileUrl,
        fileSize: data?.fileSize,
        fileMimeType: data?.fileMimeType,
      });
      if (!data?.fileUrl) {
        Alert.alert('Error', 'Upload succeeded but no file URL was returned. Please try again.');
        return;
      }
      onMessageSent(data);
      onCancelReply();
    } catch (err: unknown) {
      console.log('[Upload] failed', err instanceof Error ? err.message : err);
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to upload');
    } finally {
      setUploading(false);
    }
  }

  function showAttachMenu() {
    Alert.alert('Attach', undefined, [
      { text: '📷 Photo / Video', onPress: pickImage },
      { text: '📄 Document',      onPress: pickDocument },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  // ── Recording helpers ───────────────────────────────────────────────────────

  async function beginRecord(pageX: number) {
    if (isRecordingRef.current) return;
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission required', 'Microphone access is needed to send voice messages.');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current   = recording;
      isRecordingRef.current = true;
      startXRef.current      = pageX;
      setIsRecording(true);
      setRecDuration(0);
      setCancelSlide(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      timerRef.current = setInterval(() => setRecDuration((d) => d + 1), 1000);
    } catch {
      Alert.alert('Error', 'Could not start recording. Check microphone permissions.');
    }
  }

  async function endRecord(cancel: boolean) {
    if (!isRecordingRef.current || !recordingRef.current) return;
    isRecordingRef.current = false;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    const rec = recordingRef.current;
    recordingRef.current = null;

    // Capture duration before state reset since we async below
    let currentDuration = 0;
    setRecDuration((d) => { currentDuration = d; return d; });

    setIsRecording(false);
    setCancelSlide(false);
    setRecDuration(0);

    try {
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      console.log('[Voice] recording stopped', { uri, durationSec: currentDuration, cancelled: cancel });
      // Use recDuration from the ref snapshot; minimum 1 second to avoid accidental taps
      if (!cancel && uri && currentDuration >= 1) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const ext      = uri.split('.').pop()?.toLowerCase() ?? 'm4a';
        const mimeType = ext === 'mp4' ? 'audio/mp4' : `audio/${ext}`;
        await uploadFile(uri, mimeType, `voice_${Date.now()}.${ext}`);
      }
    } catch (err: unknown) {
      console.log('[Voice] failed to finalize recording', err instanceof Error ? err.message : err);
    }
  }

  // The PanResponder is always present on the mic/stop button so the touch sequence
  // is never interrupted when the recording row replaces the text input row.
  const micHandlers = PanResponder.create({
    onStartShouldSetPanResponder: () =>
      !canSend && !uploading && !editingMessage && !isRecordingRef.current,
    onMoveShouldSetPanResponder: () => isRecordingRef.current,
    onPanResponderGrant: (e) => {
      if (!isRecordingRef.current) beginRecord(e.nativeEvent.pageX);
    },
    onPanResponderMove: (e) => {
      if (!isRecordingRef.current) return;
      const dx = e.nativeEvent.pageX - startXRef.current;
      setCancelSlide(dx < -60);
    },
    onPanResponderRelease: (e) => {
      if (!isRecordingRef.current) return;
      const dx = e.nativeEvent.pageX - startXRef.current;
      endRecord(dx < -60);
    },
    onPanResponderTerminate: () => {
      if (isRecordingRef.current) endRecord(true);
    },
  }).panHandlers;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.shell, { paddingBottom: bottomPadding }]}>

      {/* Editing banner */}
      {editingMessage && (
        <View style={styles.replyBanner}>
          <View style={[styles.replyAccent, styles.editAccent]} />
          <View style={styles.replyBody}>
            <Text style={[styles.replyName, styles.editName]}>Editing message</Text>
            <Text style={styles.replyText} numberOfLines={1}>
              {editingMessage.content}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onCancelEdit}
            style={styles.replyClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="x" size={16} color={Colors.textTertiary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Reply banner */}
      {replyingTo && (
        <View style={styles.replyBanner}>
          <View style={styles.replyAccent} />
          <View style={styles.replyBody}>
            <Text style={styles.replyName}>{replyingTo.sender.displayName}</Text>
            <Text style={styles.replyText} numberOfLines={1}>
              {replyingTo.type === 'file'
                ? `📎 ${replyingTo.fileName}`
                : replyingTo.content}
            </Text>
          </View>
          <TouchableOpacity onPress={onCancelReply} style={styles.replyClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="x" size={16} color={Colors.textTertiary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Upload indicator */}
      {uploading && (
        <View style={styles.uploadRow}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.uploadText}>Uploading…</Text>
        </View>
      )}

      {/* ── Main input row ─────────────────────────────────────────────────────
          The attach button and text pill are swapped out for the recording
          status when isRecording is true, BUT the send/mic button stays mounted
          at all times so the PanResponder touch sequence is never interrupted. */}
      <View style={styles.row}>

        {/* Attach button — hidden while recording */}
        {!isRecording && (
          <TouchableOpacity style={styles.attachBtn} onPress={showAttachMenu} activeOpacity={0.7}>
            <Feather name="plus" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}

        {/* Text input OR recording status */}
        {isRecording ? (
          <View style={styles.recordingContent}>
            <View style={[styles.recDot, cancelSlide && styles.recDotCancel]} />
            <Text style={[styles.recTimer, cancelSlide && styles.recTimerCancel]}>
              {String(Math.floor(recDuration / 60)).padStart(2, '0')}:{String(recDuration % 60).padStart(2, '0')}
            </Text>
            <View style={styles.recHintRow}>
              <Feather
                name="chevron-left"
                size={16}
                color={cancelSlide ? Colors.error : Colors.textTertiary}
              />
              <Text style={[styles.recHint, cancelSlide && styles.recHintCancel]}>
                {cancelSlide ? 'Release to cancel' : 'Slide to cancel'}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.pill}>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={(t) => { setText(t); emitTyping(); }}
              onBlur={() => {
                socket.emit('stop_typing', { conversationId });
              }}
              placeholder="Message…"
              placeholderTextColor={Colors.textTertiary}
              multiline
              returnKeyType="default"
            />
          </View>
        )}

        {/* Send button (text / edit mode) OR mic button (empty input).
            The mic button uses PanResponder and MUST stay mounted during
            recording so the touch sequence isn't terminated. */}
        {(canSend || editingMessage) && !isRecording ? (
          <AnimatedTouchable
            style={[styles.sendBtn, !canSend && styles.sendBtnOff, sendAnimStyle]}
            onPress={() => {
              sendScale.value = withSpring(0.88, { damping: 10 });
              setTimeout(() => { sendScale.value = withSpring(1, { damping: 12 }); }, 120);
              sendText();
            }}
            onPressIn={() => { sendScale.value = withSpring(0.9, { damping: 12 }); }}
            onPressOut={() => { sendScale.value = withSpring(1, { damping: 12 }); }}
            disabled={!canSend || uploading}
            activeOpacity={1}
          >
            <Feather name="send" size={18} color="#fff" />
          </AnimatedTouchable>
        ) : (
          <View style={[styles.micBtn, isRecording && styles.micBtnActive]} {...micHandlers}>
            {isRecording
              ? <Feather name="square" size={15} color={Colors.error} />
              : <Feather name="mic" size={18} color={Colors.textTertiary} />}
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  shell: {
    backgroundColor: Colors.bgBase,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },

  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgLayer2,
    borderRadius: Radius.md,
    overflow: 'hidden',
    gap: Spacing.sm,
    minHeight: 44,
  },
  replyAccent: {
    width: 3,
    alignSelf: 'stretch',
    backgroundColor: Colors.primary,
  },
  editAccent:  { backgroundColor: Colors.secondary },
  editName:    { color: Colors.secondary },
  replyBody:   { flex: 1, paddingVertical: 8 },
  replyName:   { color: Colors.primary, fontSize: FontSize.xs, fontWeight: '600', marginBottom: 2 },
  replyText:   { color: Colors.textSecondary, fontSize: FontSize.xs },
  replyClose:  { paddingRight: Spacing.md },

  uploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 4,
  },
  uploadText: { color: Colors.textSecondary, fontSize: FontSize.sm },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: Spacing.sm,
    minHeight: 52,
  },

  attachBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.bgLayer2,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  pill: {
    flex: 1,
    backgroundColor: Colors.bgLayer2,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    minHeight: 44,
    maxHeight: 128,
    justifyContent: 'center',
  },

  input: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    lineHeight: 20,
    maxHeight: 108,
    paddingTop: 0,
    paddingBottom: 0,
  },

  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 6,
  },
  sendBtnOff: {
    backgroundColor: Colors.bgLayer2,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    shadowOpacity: 0,
    elevation: 0,
  },

  micBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.bgLayer2,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnActive: {
    backgroundColor: 'rgba(255,77,106,0.12)',
    borderColor: Colors.error,
  },

  recordingContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.sm,
  },
  recDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.error,
  },
  recDotCancel: { backgroundColor: Colors.textTertiary },
  recTimer: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: '600',
    minWidth: 42,
  },
  recTimerCancel: { color: Colors.textTertiary },
  recHintRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  recHint: { color: Colors.textTertiary, fontSize: FontSize.sm },
  recHintCancel: { color: Colors.error },
});
