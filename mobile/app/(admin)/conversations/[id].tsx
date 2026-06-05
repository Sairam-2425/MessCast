import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import { AvatarWithRing } from '../../../components/ui/AvatarWithRing';
import { Colors, FontSize, FontWeight, Spacing } from '../../../constants/theme';
import api from '../../../lib/axios';

interface AdminMessage {
  _id: string;
  content: string | null;
  type: 'text' | 'file';
  fileName: string | null;
  deletedForAll: boolean;
  sender: { _id: string; displayName: string; avatarUrl: string | null };
  createdAt: string;
}

export default function AdminConversationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/api/admin/conversations/${id}/messages?limit=100`)
      .then(({ data }) => setMessages(data.messages))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  async function deleteMessage(msgId: string) {
    Alert.alert('Delete message', 'Permanently delete this message?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/api/admin/messages/${msgId}`);
            setMessages((prev) => prev.filter((m) => m._id !== msgId));
          } catch {}
        },
      },
    ]);
  }

  async function deleteConversation() {
    Alert.alert('Delete conversation', 'Permanently delete this conversation and all messages?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/api/admin/conversations/${id}`);
            router.back();
          } catch {}
        },
      },
    ]);
  }

  if (loading) return <View style={[styles.center, { paddingTop: insets.top }]}><ActivityIndicator color={Colors.primary} /></View>;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Conversation</Text>
        <TouchableOpacity onPress={deleteConversation} style={styles.deleteBtn}>
          <Feather name="trash-2" size={20} color={Colors.error} />
        </TouchableOpacity>
      </View>
      <FlatList
        data={messages}
        keyExtractor={(m) => m._id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + Spacing.md }]}
        renderItem={({ item }) => (
          <View style={styles.msgRow}>
            <AvatarWithRing avatarUrl={item.sender.avatarUrl} displayName={item.sender.displayName} size={32} />
            <View style={styles.msgContent}>
              <Text style={styles.senderName}>{item.sender.displayName}</Text>
              <Text style={styles.msgText}>
                {item.deletedForAll ? '🚫 Deleted' : item.type === 'file' ? `📎 ${item.fileName}` : item.content}
              </Text>
              <Text style={styles.msgTime}>{format(new Date(item.createdAt), 'MMM d, h:mm a')}</Text>
            </View>
            <TouchableOpacity onPress={() => deleteMessage(item._id)} style={styles.deleteMsgBtn}>
              <Feather name="trash-2" size={16} color={Colors.error} />
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No messages</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgBase },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgBase },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.glassBorder,
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  deleteBtn: { padding: 4 },
  list: { paddingVertical: Spacing.sm },
  msgRow: {
    flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.separator,
  },
  msgContent: { flex: 1 },
  senderName: { color: Colors.primary, fontSize: FontSize.xs, fontWeight: FontWeight.semibold, marginBottom: 2 },
  msgText: { color: Colors.textPrimary, fontSize: FontSize.sm },
  msgTime: { color: Colors.textTertiary, fontSize: 10, marginTop: 3 },
  deleteMsgBtn: { padding: 4 },
  empty: { textAlign: 'center', color: Colors.textTertiary, marginTop: 40 },
});
