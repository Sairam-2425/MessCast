import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../../constants/theme';
import api from '../../../lib/axios';

interface AdminConversation {
  _id: string;
  type: 'direct' | 'group';
  groupName: string | null;
  members: { _id: string; displayName: string }[];
  updatedAt: string;
}

export default function AdminConversationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [conversations, setConversations] = useState<AdminConversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/admin/conversations?limit=50')
      .then(({ data }) => setConversations(data.conversations))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <View style={[styles.center, { paddingTop: insets.top }]}><ActivityIndicator color={Colors.primary} /></View>;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.title}>Conversations</Text>
      <FlatList
        data={conversations}
        keyExtractor={(c) => c._id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => router.push(`/(admin)/conversations/${item._id}`)}>
            <View style={[styles.typeBadge, item.type === 'group' ? styles.groupBadge : styles.directBadge]}>
              <Text style={styles.typeText}>{item.type}</Text>
            </View>
            <View style={styles.info}>
              <Text style={styles.name}>
                {item.type === 'group' ? item.groupName : item.members.map((m) => m.displayName).join(' & ')}
              </Text>
              <Text style={styles.meta}>{item.members.length} members · {format(new Date(item.updatedAt), 'MMM d')}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No conversations</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgBase },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgBase },
  title: { color: Colors.textPrimary, fontSize: FontSize.xl, fontWeight: FontWeight.bold, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  list: { paddingBottom: 100 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.separator,
  },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, borderWidth: 1 },
  groupBadge: { borderColor: Colors.primary, backgroundColor: 'rgba(124,92,252,0.1)' },
  directBadge: { borderColor: Colors.secondary, backgroundColor: 'rgba(0,212,255,0.1)' },
  typeText: { color: Colors.textSecondary, fontSize: 10 },
  info: { flex: 1 },
  name: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: FontWeight.medium },
  meta: { color: Colors.textSecondary, fontSize: FontSize.xs },
  empty: { textAlign: 'center', color: Colors.textTertiary, marginTop: 40 },
});
