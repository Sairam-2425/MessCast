import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { GlassInput } from '../../../components/ui/GlassInput';
import { AvatarWithRing } from '../../../components/ui/AvatarWithRing';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../../constants/theme';
import api from '../../../lib/axios';

interface AdminUser {
  _id: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  role: 'user' | 'admin';
  isBanned: boolean;
  isOnline: boolean;
  createdAt: string;
}

export default function AdminUsersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchUsers = useCallback(async (search = '') => {
    try {
      const { data } = await api.get(`/api/admin/users?search=${encodeURIComponent(search)}&limit=50`);
      setUsers(data.users ?? []);
      setTotal(data.total ?? 0);
    } catch {}
  }, []);

  useEffect(() => {
    fetchUsers('').finally(() => setLoading(false));
  }, [fetchUsers]);

  const handleQueryChange = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchUsers(text), 300);
  }, [fetchUsers]);

  const toggleBan = useCallback((user: AdminUser) => {
    const action = user.isBanned ? 'Unban' : 'Ban';
    Alert.alert(`${action} user`, `${action} ${user.displayName ?? 'this user'}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: action,
        style: user.isBanned ? 'default' : 'destructive',
        onPress: async () => {
          try {
            await api.patch(`/api/admin/users/${user._id}/ban`);
            setUsers((prev) =>
              prev.map((u) => (u._id === user._id ? { ...u, isBanned: !u.isBanned } : u)),
            );
          } catch {}
        },
      },
    ]);
  }, []);

  // Opens (or creates) a direct DM conversation between admin and this user,
  // then navigates straight into the chat screen.
  const messageUser = useCallback(async (user: AdminUser) => {
    try {
      const { data } = await api.post('/api/conversations', {
        type: 'direct',
        members: [user._id],
      });
      router.push(`/chat/${data.id}`);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to open chat');
    }
  }, [router]);

  const keyExtractor = useCallback((item: AdminUser) => item._id, []);

  const renderItem = useCallback(
    ({ item }: { item: AdminUser }) => (
      <TouchableOpacity
        style={styles.row}
        onPress={() => router.push(`/(admin)/users/${item._id}`)}
      >
        <AvatarWithRing
          avatarUrl={item.avatarUrl}
          displayName={item.displayName}
          size={44}
          isOnline={item.isOnline}
        />
        <View style={styles.info}>
          <Text style={styles.name}>{item.displayName ?? '—'}</Text>
          <Text style={styles.email}>{item.email ?? ''}</Text>
          <View style={styles.badges}>
            <View style={[styles.badge, item.role === 'admin' ? styles.adminBadge : styles.userBadge]}>
              <Text style={styles.badgeText}>{item.role}</Text>
            </View>
            {item.isBanned && (
              <View style={[styles.badge, styles.bannedBadge]}>
                <Text style={styles.badgeText}>banned</Text>
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity onPress={() => messageUser(item)} style={styles.actionBtn}>
          <Feather name="message-circle" size={18} color={Colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => toggleBan(item)} style={styles.actionBtn}>
          <Feather
            name={item.isBanned ? 'unlock' : 'slash'}
            size={18}
            color={item.isBanned ? Colors.success : Colors.error}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    ),
    [router, toggleBan, messageUser],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchUsers(query);
    setRefreshing(false);
  }, [fetchUsers, query]);

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Users ({total})</Text>
      </View>
      <GlassInput
        placeholder="Search users..."
        leftIcon="search"
        value={query}
        onChangeText={handleQueryChange}
        containerStyle={styles.search}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
      />
      <FlatList
        data={users}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={10}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        ListEmptyComponent={<Text style={styles.empty}>No users found</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgBase },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgBase },
  header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  title: { color: Colors.textPrimary, fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  search: { marginHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  list: { paddingBottom: 100 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.separator,
  },
  info: { flex: 1 },
  name: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: FontWeight.medium },
  email: { color: Colors.textSecondary, fontSize: FontSize.xs, marginBottom: 4 },
  badges: { flexDirection: 'row', gap: 4 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.full, borderWidth: 1 },
  adminBadge: { borderColor: Colors.primary, backgroundColor: 'rgba(124,92,252,0.1)' },
  userBadge: { borderColor: Colors.glassBorder, backgroundColor: Colors.glassBg },
  bannedBadge: { borderColor: Colors.error, backgroundColor: 'rgba(255,77,106,0.1)' },
  badgeText: { color: Colors.textSecondary, fontSize: 10 },
  actionBtn: { padding: Spacing.sm },
  empty: { textAlign: 'center', color: Colors.textTertiary, marginTop: 40 },
});
