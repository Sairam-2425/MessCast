import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { AvatarWithRing } from '../../../components/ui/AvatarWithRing';
import { NeonButton } from '../../../components/ui/NeonButton';
import { GlassCard } from '../../../components/ui/GlassCard';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../../constants/theme';
import api from '../../../lib/axios';
import { format } from 'date-fns';

interface AdminUserDetail {
  user: {
    _id: string;
    displayName: string;
    email: string;
    avatarUrl: string | null;
    role: 'user' | 'admin';
    isBanned: boolean;
    isOnline: boolean;
    lastSeen: string | null;
    createdAt: string;
  };
  msgCount: number;
  fileCount: number;
}

export default function AdminUserDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    api.get(`/api/admin/users/${id}`)
      .then(({ data }) => setDetail(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  async function performAction(label: string, request: () => Promise<void>) {
    Alert.alert(label, `Are you sure?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: label,
        style: 'destructive',
        onPress: async () => {
          setActing(true);
          try {
            await request();
            const { data } = await api.get(`/api/admin/users/${id}`);
            setDetail(data);
          } catch (err: unknown) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed');
          } finally {
            setActing(false);
          }
        },
      },
    ]);
  }

  if (loading) return <View style={[styles.center, { paddingTop: insets.top }]}><ActivityIndicator color={Colors.primary} /></View>;
  if (!detail) return null;

  const { user } = detail;

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]} contentContainerStyle={styles.scroll}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>User Detail</Text>
      </View>

      <View style={styles.profile}>
        <AvatarWithRing avatarUrl={user.avatarUrl} displayName={user.displayName} size={80} isOnline={user.isOnline} />
        <Text style={styles.name}>{user.displayName}</Text>
        <Text style={styles.email}>{user.email}</Text>
        <View style={styles.badges}>
          <View style={[styles.badge, user.role === 'admin' ? styles.adminBadge : styles.userBadge]}>
            <Text style={styles.badgeText}>{user.role}</Text>
          </View>
          {user.isBanned && <View style={[styles.badge, styles.bannedBadge]}><Text style={styles.badgeText}>banned</Text></View>}
        </View>
      </View>

      <GlassCard style={styles.card}>
        <Text style={styles.sectionTitle}>Account Info</Text>
        <Text style={styles.infoText}>Joined: {format(new Date(user.createdAt), 'MMM d, yyyy')}</Text>
        <Text style={styles.infoText}>Messages sent: {detail.msgCount}</Text>
        <Text style={styles.infoText}>Files sent: {detail.fileCount}</Text>
        {user.lastSeen && <Text style={styles.infoText}>Last seen: {format(new Date(user.lastSeen), 'MMM d, h:mm a')}</Text>}
      </GlassCard>

      <GlassCard style={[styles.card, styles.actionsCard]}>
        <Text style={styles.sectionTitle}>Actions</Text>

        {/* ── Message ── */}
        <NeonButton
          label="Send Message"
          variant="primary"
          onPress={async () => {
            setActing(true);
            try {
              // Find or create a direct conversation then navigate into it
              const { data } = await api.post('/api/conversations', {
                type: 'direct',
                members: [id],
              });
              router.push(`/chat/${data.id}`);
            } catch (err: unknown) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to open chat');
            } finally {
              setActing(false);
            }
          }}
          loading={acting}
          fullWidth
          style={{ marginBottom: Spacing.sm }}
        />

        <NeonButton
          label={user.isBanned ? 'Unban User' : 'Ban User'}
          variant={user.isBanned ? 'secondary' : 'danger'}
          onPress={() => performAction(user.isBanned ? 'Unban' : 'Ban', () => api.patch(`/api/admin/users/${id}/ban`).then(() => {}))}
          loading={acting}
          fullWidth
        />
        <NeonButton
          label={user.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}
          variant="ghost"
          onPress={() => performAction(user.role === 'admin' ? 'Demote' : 'Promote', () =>
            api.patch(`/api/admin/users/${id}/role`, { role: user.role === 'admin' ? 'user' : 'admin' }).then(() => {})
          )}
          loading={acting}
          fullWidth
          style={{ marginTop: Spacing.sm }}
        />
        <NeonButton
          label="Delete Account"
          variant="danger"
          onPress={() => performAction('Delete', async () => {
            await api.delete(`/api/admin/users/${id}`);
            router.back();
          })}
          loading={acting}
          fullWidth
          style={{ marginTop: Spacing.sm }}
        />
      </GlassCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgBase },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: 60, gap: Spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgBase },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
  backBtn: { padding: 4 },
  headerTitle: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  profile: { alignItems: 'center', gap: 8, paddingVertical: Spacing.lg },
  name: { color: Colors.textPrimary, fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  email: { color: Colors.textSecondary, fontSize: FontSize.sm },
  badges: { flexDirection: 'row', gap: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, borderWidth: 1 },
  adminBadge: { borderColor: Colors.primary, backgroundColor: 'rgba(124,92,252,0.1)' },
  userBadge: { borderColor: Colors.glassBorder, backgroundColor: Colors.glassBg },
  bannedBadge: { borderColor: Colors.error, backgroundColor: 'rgba(255,77,106,0.1)' },
  badgeText: { color: Colors.textSecondary, fontSize: FontSize.xs },
  card: { padding: Spacing.lg, gap: Spacing.sm },
  actionsCard: { gap: 0 },
  sectionTitle: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: FontWeight.semibold, marginBottom: 8 },
  infoText: { color: Colors.textPrimary, fontSize: FontSize.sm },
});
