import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import { AvatarWithRing } from '../../components/ui/AvatarWithRing';
import { NeonButton } from '../../components/ui/NeonButton';
import { GlassCard } from '../../components/ui/GlassCard';
import { FullscreenImageViewer } from '../../components/ui/FullscreenImageViewer';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../constants/theme';
import { BASE_URL } from '../../constants/config';
import { useAuthStore } from '../../store/authStore';
import { getSocket } from '../../lib/socket';
import api from '../../lib/axios';

interface UserProfile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  email: string | null;
  phone: string | null;
  bio: string | null;
  isOnline: boolean;
  lastSeen: string | null;
}

export default function ContactInfoScreen() {
  const { id }       = useLocalSearchParams<{ id: string }>();
  const router       = useRouter();
  const insets       = useSafeAreaInsets();
  const currentUser  = useAuthStore((s) => s.user);
  const [profile, setProfile]     = useState<UserProfile | null>(null);
  const [loading, setLoading]     = useState(true);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  async function fetchProfile() {
    try {
      const { data } = await api.get(`/api/users/${id}`);
      setProfile(data);
    } catch {}
  }

  // Initial load
  useEffect(() => {
    fetchProfile().finally(() => setLoading(false));
  }, [id]);

  // Re-fetch on screen focus to get fresh online status.
  // Use a ref to skip the very first focus (handled by the initial useEffect).
  const hasMountedRef = React.useRef(false);
  useFocusEffect(
    React.useCallback(() => {
      if (!hasMountedRef.current) {
        hasMountedRef.current = true;
        return;
      }
      fetchProfile();
    }, [id])
  );

  // Live online/offline via socket
  useEffect(() => {
    const socket = getSocket();
    function onOnline({ userId }: { userId: string }) {
      if (userId === id) setProfile((p) => p ? { ...p, isOnline: true } : p);
    }
    function onOffline({ userId, lastSeen }: { userId: string; lastSeen?: string }) {
      if (userId === id) setProfile((p) => p ? { ...p, isOnline: false, lastSeen: lastSeen ?? p.lastSeen } : p);
    }
    socket.on('user_online',  onOnline);
    socket.on('user_offline', onOffline);
    return () => {
      socket.off('user_online',  onOnline);
      socket.off('user_offline', onOffline);
    };
  }, [id]);

  async function openChat() {
    try {
      const { data } = await api.post('/api/conversations', { type: 'direct', members: [id] });
      router.push(`/chat/${data.id}`);
    } catch {}
  }

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top, backgroundColor: Colors.bgBase }]}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }
  if (!profile) return null;

  const statusText = profile.isOnline
    ? 'Online'
    : profile.lastSeen
    ? `Last seen ${format(new Date(profile.lastSeen), 'MMM d, h:mm a')}`
    : 'Offline';

  const fullAvatarUrl = profile.avatarUrl
    ? profile.avatarUrl.startsWith('http')
      ? profile.avatarUrl
      : `${BASE_URL}${profile.avatarUrl}`
    : null;

  return (
    <>
      <ScrollView
        style={[styles.container, { paddingTop: insets.top }]}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Contact Info</Text>
        </View>

        {/* Profile section */}
        <View style={styles.profileSection}>
          <TouchableOpacity
            onPress={() => fullAvatarUrl && setViewerUrl(fullAvatarUrl)}
            activeOpacity={0.85}
            disabled={!fullAvatarUrl}
          >
            <AvatarWithRing
              avatarUrl={profile.avatarUrl}
              displayName={profile.displayName}
              size={100}
              isOnline={profile.isOnline}
            />
          </TouchableOpacity>

          <Text style={styles.name}>{profile.displayName}</Text>

          <View style={[styles.statusBadge, profile.isOnline ? styles.onlineBadge : styles.offlineBadge]}>
            <View style={[styles.statusDot, profile.isOnline ? styles.dotOnline : styles.dotOffline]} />
            <Text style={[styles.statusText, profile.isOnline && styles.statusTextOnline]}>
              {statusText}
            </Text>
          </View>

          {profile.bio ? (
            <Text style={styles.bio}>{profile.bio}</Text>
          ) : null}
        </View>

        {/* Info card */}
        <GlassCard style={styles.card}>
          {profile.email ? (
            <InfoRow icon="mail" label="Email" value={profile.email} />
          ) : null}
          {profile.phone ? (
            <InfoRow icon="phone" label="Phone" value={profile.phone} />
          ) : null}
          {!profile.email && !profile.phone ? (
            <Text style={styles.noInfo}>No contact details available</Text>
          ) : null}
        </GlassCard>

        {profile.id !== currentUser?.id && (
          <NeonButton label="Send Message" onPress={openChat} fullWidth style={styles.msgBtn} />
        )}
      </ScrollView>

      <FullscreenImageViewer
        visible={!!viewerUrl}
        imageUrl={viewerUrl}
        onClose={() => setViewerUrl(null)}
      />
    </>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={infoStyles.row}>
      <View style={infoStyles.iconWrap}>
        <Feather name={icon as any} size={16} color={Colors.primary} />
      </View>
      <View style={infoStyles.text}>
        <Text style={infoStyles.label}>{label}</Text>
        <Text style={infoStyles.value}>{value}</Text>
      </View>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(124,92,252,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text:  { flex: 1 },
  label: { color: Colors.textTertiary, fontSize: FontSize.xs, marginBottom: 2 },
  value: { color: Colors.textPrimary,  fontSize: FontSize.md },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgBase },
  scroll:    { paddingHorizontal: Spacing.lg, paddingBottom: 60 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  backBtn:     { padding: 4 },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
  },

  profileSection: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xl,
  },
  name: {
    color: Colors.textPrimary,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  onlineBadge:  { backgroundColor: 'rgba(0,229,160,0.08)', borderColor: Colors.success },
  offlineBadge: { backgroundColor: Colors.glassBg,         borderColor: Colors.glassBorder },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotOnline:  { backgroundColor: Colors.success },
  dotOffline: { backgroundColor: Colors.textTertiary },
  statusText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },
  statusTextOnline: { color: Colors.success },
  bio: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 4,
    paddingHorizontal: Spacing.lg,
  },

  card:   { padding: Spacing.lg, gap: 2 },
  noInfo: { color: Colors.textTertiary, fontSize: FontSize.sm, textAlign: 'center', paddingVertical: Spacing.sm },
  msgBtn: { marginTop: Spacing.lg },
});
