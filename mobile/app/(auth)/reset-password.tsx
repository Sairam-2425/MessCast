/**
 * Reset Password Screen
 *
 * Reached via the deep-link in the reset email:
 *   messcast://reset-password?token=<jwt>
 *
 * Expo Router reads `token` from the URL search params via useLocalSearchParams().
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { GlassCard } from '../../components/ui/GlassCard';
import { GlassInput } from '../../components/ui/GlassInput';
import { NeonButton } from '../../components/ui/NeonButton';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../constants/theme';
import api from '../../lib/axios';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();

  const [newPassword, setNewPassword]       = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError]                   = useState('');
  const [loading, setLoading]               = useState(false);
  const [done, setDone]                     = useState(false);

  // Token missing (user navigated here manually without a link)
  const hasToken = typeof token === 'string' && token.length > 0;

  async function handleReset() {
    setError('');

    if (!newPassword || newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/auth/reset-password', {
        token: Array.isArray(token) ? token[0] : token,
        newPassword,
      });
      setDone(true);
    } catch (err: unknown) {
      const serverMsg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error;
      setError(serverMsg ?? 'Something went wrong. Please request a new reset link.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={styles.logoArea}>
            <View style={styles.logoIcon}>
              <Feather name="message-circle" size={36} color={Colors.primary} />
            </View>
            <Text style={styles.logoText}>MESSCAST</Text>
          </View>

          {done ? (
            // ── Success ───────────────────────────────────────────────────
            <GlassCard style={styles.card}>
              <View style={styles.successIcon}>
                <Feather name="check-circle" size={52} color={Colors.success} />
              </View>
              <Text style={styles.heading}>Password Updated</Text>
              <Text style={styles.body}>
                Your password has been reset successfully.{'\n'}You can now sign in with your new password.
              </Text>
              <NeonButton
                label="Sign In"
                onPress={() => router.replace('/(auth)/login')}
                fullWidth
                style={styles.btn}
              />
            </GlassCard>
          ) : !hasToken ? (
            // ── No token ──────────────────────────────────────────────────
            <GlassCard style={styles.card}>
              <View style={styles.errorIcon}>
                <Feather name="alert-triangle" size={40} color={Colors.warning} />
              </View>
              <Text style={styles.heading}>Invalid Link</Text>
              <Text style={styles.body}>
                This reset link is missing a token.{'\n'}
                Please use the link from your email or request a new one.
              </Text>
              <NeonButton
                label="Back to Sign In"
                onPress={() => router.replace('/(auth)/login')}
                fullWidth
                style={styles.btn}
              />
            </GlassCard>
          ) : (
            // ── Form ──────────────────────────────────────────────────────
            <GlassCard style={styles.card}>
              <Text style={styles.heading}>Set New Password</Text>
              <Text style={styles.subheading}>
                Enter a new password for your account. Must be at least 8 characters.
              </Text>

              {error ? (
                <View style={styles.errorBox}>
                  <Feather name="alert-circle" size={15} color={Colors.error} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <View style={styles.form}>
                <GlassInput
                  label="New Password"
                  placeholder="Min 8 characters"
                  secure
                  leftIcon="lock"
                  value={newPassword}
                  onChangeText={(t) => { setError(''); setNewPassword(t); }}
                  returnKeyType="next"
                />
                <GlassInput
                  label="Confirm New Password"
                  placeholder="Repeat password"
                  secure
                  leftIcon="lock"
                  value={confirmPassword}
                  onChangeText={(t) => { setError(''); setConfirmPassword(t); }}
                  returnKeyType="done"
                  onSubmitEditing={handleReset}
                />
                <NeonButton
                  label={loading ? 'Updating…' : 'Reset Password'}
                  onPress={handleReset}
                  loading={loading}
                  fullWidth
                  style={styles.btn}
                />
              </View>

              <TouchableOpacity
                onPress={() => router.replace('/(auth)/login')}
                style={styles.backLink}
              >
                <Feather name="arrow-left" size={14} color={Colors.textTertiary} />
                <Text style={styles.backLinkText}>Back to Sign In</Text>
              </TouchableOpacity>
            </GlassCard>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.bgBase },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl,
  },
  logoArea: { alignItems: 'center', marginBottom: Spacing.xxl, gap: 8 },
  logoIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: 'rgba(124,92,252,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(124,92,252,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: Colors.primary,
    fontSize: FontSize.hero,
    fontWeight: FontWeight.bold,
    letterSpacing: 4,
    textShadowColor: Colors.primaryGlow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  card: { padding: Spacing.xl, gap: Spacing.md },
  heading: {
    color: Colors.textPrimary,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
  },
  subheading: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    lineHeight: 20,
    marginTop: -4,
  },
  body: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    lineHeight: 20,
    textAlign: 'center',
  },
  form: { gap: Spacing.md },
  btn: {},
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
  successIcon: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  errorIcon: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingTop: Spacing.sm,
  },
  backLinkText: {
    color: Colors.textTertiary,
    fontSize: FontSize.sm,
  },
});
