import React, { useState } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { GlassInput } from '../../components/ui/GlassInput';
import { NeonButton } from '../../components/ui/NeonButton';
import { GlassCard } from '../../components/ui/GlassCard';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../constants/theme';
import api from '../../lib/axios';

export default function ResetPasswordPhoneScreen() {
  const router = useRouter();
  const { resetToken } = useLocalSearchParams<{ resetToken: string }>();

  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState('');
  const [done, setDone]                       = useState(false);

  async function handleReset() {
    setError('');
    if (!newPassword || newPassword.length < 8) {
      setError('Password must be at least 8 characters'); return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match'); return;
    }
    if (!resetToken) {
      setError('Session expired. Please start again.'); return;
    }
    setLoading(true);
    try {
      await api.post('/api/auth/reset-password-phone', { resetToken, newPassword });
      setDone(true);
      setTimeout(() => router.replace('/(auth)/login'), 1800);
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Reset failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <View style={s.successContainer}>
          <Feather name="check-circle" size={64} color={Colors.success} />
          <Text style={s.successTitle}>Password updated!</Text>
          <Text style={s.successSub}>Taking you to sign in…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <TouchableOpacity style={s.back} onPress={() => router.back()} activeOpacity={0.7}>
            <Feather name="arrow-left" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>

          <View style={s.center}>
            <View style={s.iconRing}>
              <Feather name="lock" size={28} color={Colors.primary} />
            </View>
          </View>

          <Text style={s.title}>Create new password</Text>
          <Text style={s.sub}>Must be at least 8 characters</Text>

          <GlassCard style={s.card}>
            {error ? (
              <View style={s.errorBox}>
                <Feather name="alert-circle" size={14} color={Colors.error} />
                <Text style={s.errorText}>{error}</Text>
              </View>
            ) : null}

            <GlassInput
              label="New Password"
              placeholder="Min 8 characters"
              secure
              leftIcon="lock"
              value={newPassword}
              onChangeText={(t) => { setNewPassword(t); setError(''); }}
            />
            <GlassInput
              label="Confirm Password"
              placeholder="Repeat password"
              secure
              leftIcon="lock"
              value={confirmPassword}
              onChangeText={(t) => { setConfirmPassword(t); setError(''); }}
            />

            <NeonButton label="Reset Password" onPress={handleReset} loading={loading} fullWidth />
          </GlassCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: Colors.bgBase },
  flex:  { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.xxl },
  successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg },
  successTitle: { color: Colors.textPrimary, fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  successSub:   { color: Colors.textSecondary, fontSize: FontSize.md },
  back: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgLayer1, alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  center: { alignItems: 'center', marginBottom: Spacing.xl },
  iconRing: {
    width: 72, height: 72, borderRadius: 24,
    backgroundColor: 'rgba(124,92,252,0.12)', borderWidth: 1, borderColor: 'rgba(124,92,252,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { color: Colors.textPrimary, fontSize: FontSize.xl, fontWeight: FontWeight.bold, textAlign: 'center', marginBottom: 4 },
  sub:   { color: Colors.textSecondary, fontSize: FontSize.sm, textAlign: 'center', marginBottom: Spacing.xl },
  card:  { padding: Spacing.xl, gap: Spacing.md },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,77,106,0.1)', borderWidth: 1,
    borderColor: 'rgba(255,77,106,0.3)', borderRadius: Radius.sm, padding: Spacing.sm,
  },
  errorText: { color: Colors.error, fontSize: FontSize.sm, flex: 1 },
});
