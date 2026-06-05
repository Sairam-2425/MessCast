import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { FullscreenImageViewer } from '../../components/ui/FullscreenImageViewer';
import { BASE_URL } from '../../constants/config';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_CONTENT_HEIGHT } from './_layout';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { GlassCard } from '../../components/ui/GlassCard';
import { GlassInput } from '../../components/ui/GlassInput';
import { NeonButton } from '../../components/ui/NeonButton';
import { AvatarWithRing } from '../../components/ui/AvatarWithRing';
import { Colors, FontSize, FontWeight, Spacing, Radius, Shadow } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import api from '../../lib/axios';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, updateUser, logout } = useAuthStore();

  const [displayName, setDisplayName]         = useState(user?.displayName ?? '');
  const [saving, setSaving]                   = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError]     = useState('');
  const [savingPassword, setSavingPassword]   = useState(false);

  async function pickAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setUploadingAvatar(true);
      try {
        const asset = result.assets[0];
        const formData = new FormData();
        formData.append('avatar', { uri: asset.uri, type: 'image/jpeg', name: 'avatar.jpg' } as unknown as Blob);
        const { data } = await api.post('/api/users/avatar', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        updateUser({ avatarUrl: data.avatarUrl });
      } catch (err: unknown) {
        Alert.alert('Error', err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setUploadingAvatar(false);
      }
    }
  }

  async function saveProfile() {
    if (!displayName.trim()) return;
    setSaving(true);
    try {
      await api.patch('/api/users/me', { displayName: displayName.trim() });
      updateUser({ displayName: displayName.trim() });
      Alert.alert('Saved', 'Profile updated successfully');
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    setPasswordError('');
    if (!currentPassword) { setPasswordError('Current password is required'); return; }
    if (!newPassword || newPassword.length < 8) { setPasswordError('New password must be at least 8 characters'); return; }
    if (newPassword !== confirmPassword) { setPasswordError('Passwords do not match'); return; }
    setSavingPassword(true);
    try {
      await api.patch('/api/users/me/password', { currentPassword, newPassword });
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      Alert.alert('Success', 'Password changed successfully');
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => { await logout(); } },
    ]);
  }

  if (!user) return null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: TAB_BAR_CONTENT_HEIGHT + insets.bottom + 16 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Hero ── */}
        <View style={styles.hero}>
          {/* Decorative glow rings behind avatar */}
          <View style={styles.glowOuter} />
          <View style={styles.glowInner} />

          <View style={styles.avatarWrapper}>
            <TouchableOpacity
              onPress={() => {
                if (user.avatarUrl) {
                  const url = user.avatarUrl.startsWith('http')
                    ? user.avatarUrl
                    : `${BASE_URL}${user.avatarUrl}`;
                  setViewerUrl(url);
                }
              }}
              activeOpacity={0.85}
              disabled={!user.avatarUrl}
            >
              <AvatarWithRing
                avatarUrl={user.avatarUrl}
                displayName={user.displayName}
                size={96}
                showRing
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={pickAvatar}
              style={styles.cameraOverlay}
              activeOpacity={0.8}
            >
              {uploadingAvatar
                ? <ActivityIndicator color="#fff" size="small" />
                : <Feather name="camera" size={15} color="#fff" />
              }
            </TouchableOpacity>
          </View>

          <Text style={styles.heroName}>{user.displayName}</Text>

          {/* Info pills */}
          <View style={styles.infoPills}>
            {user.email ? (
              <View style={styles.infoPill}>
                <Feather name="mail" size={12} color={Colors.textTertiary} />
                <Text style={styles.infoPillText} numberOfLines={1}>{user.email}</Text>
              </View>
            ) : null}
            {user.phone ? (
              <View style={styles.infoPill}>
                <Feather name="phone" size={12} color={Colors.textTertiary} />
                <Text style={styles.infoPillText}>{user.phone}</Text>
              </View>
            ) : null}
          </View>

          {user.role === 'admin' && (
            <View style={styles.roleBadge}>
              <Feather name="shield" size={12} color={Colors.secondary} />
              <Text style={styles.roleText}>ADMIN</Text>
            </View>
          )}
        </View>

        {/* ── Edit Profile ── */}
        <GlassCard style={styles.card} accent>
          <View style={styles.sectionHeader}>
            <Feather name="user" size={15} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Edit Profile</Text>
          </View>
          <GlassInput
            label="Display Name"
            value={displayName}
            onChangeText={setDisplayName}
            leftIcon="user"
            returnKeyType="done"
          />
          <NeonButton label="Save Changes" onPress={saveProfile} loading={saving} fullWidth />
        </GlassCard>

        {/* ── Change Password ── */}
        <GlassCard style={styles.card} accent>
          <View style={styles.sectionHeader}>
            <Feather name="lock" size={15} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Change Password</Text>
          </View>

          {passwordError ? (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={13} color={Colors.error} />
              <Text style={styles.errorText}>{passwordError}</Text>
            </View>
          ) : null}

          <GlassInput
            label="Current Password"
            placeholder="Enter current password"
            secure leftIcon="lock"
            value={currentPassword}
            onChangeText={(t) => { setPasswordError(''); setCurrentPassword(t); }}
          />
          <GlassInput
            label="New Password"
            placeholder="Min 8 characters"
            secure leftIcon="lock"
            value={newPassword}
            onChangeText={(t) => { setPasswordError(''); setNewPassword(t); }}
          />
          <GlassInput
            label="Confirm New Password"
            placeholder="Repeat new password"
            secure leftIcon="lock"
            value={confirmPassword}
            onChangeText={(t) => { setPasswordError(''); setConfirmPassword(t); }}
          />
          <NeonButton label="Update Password" onPress={changePassword} loading={savingPassword} fullWidth />
        </GlassCard>

        {/* ── Sign Out ── */}
        <NeonButton label="Sign Out" variant="danger" onPress={handleLogout} fullWidth />
      </ScrollView>

      <FullscreenImageViewer
        visible={!!viewerUrl}
        imageUrl={viewerUrl}
        onClose={() => setViewerUrl(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.bgBase },
  scroll:   { paddingHorizontal: Spacing.lg, gap: Spacing.lg },

  hero: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  glowOuter: {
    position: 'absolute',
    top: Spacing.xl - 20,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(124,92,252,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(124,92,252,0.12)',
  },
  glowInner: {
    position: 'absolute',
    top: Spacing.xl,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(124,92,252,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(124,92,252,0.18)',
  },
  avatarWrapper: { position: 'relative', marginBottom: 4, zIndex: 1 },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.bgBase,
    ...Shadow.neonPrimary,
  },
  heroName: {
    color: Colors.textPrimary,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.3,
  },
  infoPills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, justifyContent: 'center' },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.bgLayer2,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
  },
  infoPillText: { color: Colors.textSecondary, fontSize: FontSize.xs },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,212,255,0.12)',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.3)',
  },
  roleText: {
    color: Colors.secondary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 1.2,
  },

  card:          { padding: Spacing.lg, gap: Spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle:  { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: FontWeight.semibold },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,77,106,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,77,106,0.3)',
    borderRadius: Radius.sm,
    padding: Spacing.sm,
  },
  errorText: { color: Colors.error, fontSize: FontSize.sm, flex: 1 },
});
