import React, { useState } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView,
  Platform, TouchableOpacity, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import PhoneInput from '../../components/ui/PhoneInput';
import { GlassInput } from '../../components/ui/GlassInput';
import { NeonButton } from '../../components/ui/NeonButton';
import { GlassCard } from '../../components/ui/GlassCard';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../constants/theme';
import { isValidIndianPhone } from '../../lib/phoneUtils';
import { useAuthStore } from '../../store/authStore';
import { connectSocket } from '../../lib/socket';
import api from '../../lib/axios';

// FIREBASE_PHONE_AUTH_DISABLED_TEMP — phone login is now password-based, no Firebase OTP

export default function PhoneLoginScreen() {
  const router  = useRouter();
  const setUser = useAuthStore((s) => s.setUser);

  const [phone, setPhone]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  async function handleLogin() {
    setError('');

    if (!isValidIndianPhone(phone)) {
      setError('Please enter a valid phone number, e.g. +919876543210');
      return;
    }
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/api/auth/phone-login', { phone, password });
      await setUser(data.user, data.token);
      connectSocket(data.token);
      router.replace(data.user.role === 'admin' ? '/(admin)' : '/(user)');
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <TouchableOpacity style={s.back} onPress={() => router.back()} activeOpacity={0.7}>
            <Feather name="arrow-left" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>

          <View style={s.logoArea}>
            <View style={s.logoIcon}>
              <Feather name="message-circle" size={36} color={Colors.primary} />
            </View>
            <Text style={s.logoText}>MESSCAST</Text>
          </View>

          <GlassCard style={s.card}>
            <View style={s.iconRow}>
              <View style={s.iconRing}>
                <Feather name="smartphone" size={24} color={Colors.primary} />
              </View>
            </View>
            <Text style={s.heading}>Phone login</Text>
            <Text style={s.sub}>Enter your phone number and password</Text>

            {error ? (
              <View style={s.errorBox}>
                <Feather name="alert-circle" size={14} color={Colors.error} />
                <Text style={s.errorText}>{error}</Text>
              </View>
            ) : null}

            <PhoneInput label="Phone Number" onChangeText={setPhone} />

            <GlassInput
              label="Password"
              placeholder="••••••••"
              secure
              leftIcon="lock"
              value={password}
              onChangeText={setPassword}
            />

            <TouchableOpacity
              onPress={() => router.push('/(auth)/forgot-password')}
              style={s.forgotRow}
              activeOpacity={0.7}
            >
              <Text style={s.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            <NeonButton label="Sign In" onPress={handleLogin} loading={loading} fullWidth />

            <View style={s.links}>
              <TouchableOpacity onPress={() => router.push('/(auth)/phone-register')} activeOpacity={0.7}>
                <Text style={s.linkText}>No account? <Text style={s.linkBold}>Register with phone</Text></Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.replace('/(auth)/login')} activeOpacity={0.7}>
                <Text style={s.linkText}>Sign in with email instead</Text>
              </TouchableOpacity>
            </View>
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
  back: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgLayer1, alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  logoArea: { alignItems: 'center', marginBottom: Spacing.xxl, gap: 8 },
  logoIcon: {
    width: 72, height: 72, borderRadius: 24,
    backgroundColor: 'rgba(124,92,252,0.15)', borderWidth: 1, borderColor: 'rgba(124,92,252,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  logoText: {
    color: Colors.primary, fontSize: FontSize.hero, fontWeight: FontWeight.bold,
    letterSpacing: 4, textShadowColor: Colors.primaryGlow,
    textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 20,
  },
  card: { padding: Spacing.xl, gap: Spacing.md },
  iconRow: { alignItems: 'center' },
  iconRing: {
    width: 56, height: 56, borderRadius: 20,
    backgroundColor: 'rgba(124,92,252,0.12)', borderWidth: 1, borderColor: 'rgba(124,92,252,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  heading: { color: Colors.textPrimary, fontSize: FontSize.xl, fontWeight: FontWeight.bold, textAlign: 'center' },
  sub:     { color: Colors.textSecondary, fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,77,106,0.1)', borderWidth: 1,
    borderColor: 'rgba(255,77,106,0.3)', borderRadius: Radius.sm, padding: Spacing.sm,
  },
  errorText: { color: Colors.error, fontSize: FontSize.sm, flex: 1 },
  forgotRow: { alignSelf: 'flex-end', marginTop: -4 },
  forgotText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  links: { gap: Spacing.sm, alignItems: 'center' },
  linkText: { color: Colors.textSecondary, fontSize: FontSize.sm },
  linkBold: { color: Colors.primary, fontWeight: FontWeight.semibold },
});
