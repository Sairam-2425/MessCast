import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import OtpInput from '../../components/ui/OtpInput';
import { NeonButton } from '../../components/ui/NeonButton';
import { GlassCard } from '../../components/ui/GlassCard';
import { Colors, FontSize, FontWeight, Spacing, Radius, Shadow } from '../../constants/theme';
import { maskPhone } from '../../lib/phoneUtils';
import { useAuthStore } from '../../store/authStore';
import { connectSocket } from '../../lib/socket';
import api from '../../lib/axios';

// FIREBASE_PHONE_AUTH_DISABLED_TEMP — verify-otp now uses 2Factor backend only.
// OTP verification is used ONLY for: signup (register) and forgot-password.
// Login is password-based and does NOT reach this screen.
//
// import { useRef } from 'react';
// import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
// import { signInWithPhoneNumber } from 'firebase/auth';
// import { app, auth } from '../../lib/firebase';
// import { getPending, setPending, clearPending } from '../../lib/pendingAuth';

// Only two valid purposes — login no longer uses OTP
type Purpose = 'register' | 'forgot_password';

export default function VerifyOtpScreen() {
  const router  = useRouter();
  const setUser = useAuthStore((s) => s.setUser);

  const { phone, purpose, displayName, email, password } =
    useLocalSearchParams<{
      phone:       string;
      purpose:     Purpose;
      displayName?: string;
      email?:      string;
      password?:   string;
    }>();

  const [code, setCode]           = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [cooldown, setCooldown]   = useState(60);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) { setCanResend(true); return; }
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function handleVerify() {
    setError('');
    if (code.length !== 6) { setError('Please enter all 6 digits'); return; }

    setLoading(true);
    try {
      // Step 1: validate OTP → get short-lived verificationToken
      const { data: verifyData } = await api.post('/api/auth/verify-otp', { phone, code, purpose });
      const { verificationToken } = verifyData;

      if (purpose === 'register') {
        // Step 2a: create account with hashed password — OTP only verified once at signup
        const { data } = await api.post('/api/auth/phone-register', {
          phone,
          displayName: displayName ?? 'User',
          email:       email || undefined,
          password,
          verificationToken,
        });
        await setUser(data.user, data.token);
        connectSocket(data.token);
        router.replace(data.user.role === 'admin' ? '/(admin)' : '/(user)');

      } else if (purpose === 'forgot_password') {
        // Step 2b: get resetToken to set new password
        const { data } = await api.post('/api/auth/forgot-password/verify', { phone, verificationToken });
        router.push({
          pathname: '/(auth)/reset-password-phone',
          params:   { resetToken: data.resetToken },
        });
      }

      // FIREBASE_PHONE_AUTH_DISABLED_TEMP — original Firebase verify block:
      // const pending = getPending();
      // if (!pending) { setError('Session expired. Please go back.'); setLoading(false); return; }
      // const credential = await pending.confirm(code);
      // const idToken    = await credential.user.getIdToken();
      // clearPending();
      // if (purpose === 'register') {
      //   const { data } = await api.post('/api/auth/firebase-phone-register', { idToken, displayName: displayName ?? 'User' });
      //   ...
      // } else if (purpose === 'forgot_password') {
      //   const { data } = await api.post('/api/auth/firebase-phone-forgot', { idToken });
      //   ...
      // }
      // FIREBASE_PHONE_AUTH_DISABLED_TEMP — end

    } catch (err: unknown) {
      const msg = (err as Error).message ?? 'Verification failed. Please try again.';
      if (msg.includes('Too many') || msg.includes('too many')) {
        setError('Too many wrong attempts. Please request a new code.');
      } else if (msg.includes('expired') || msg.includes('not found')) {
        setError('OTP expired. Please go back and request a new one.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!canResend) return;
    setError('');
    try {
      await api.post('/api/auth/send-otp', { phone, purpose });
      setCode('');
      setCanResend(false);
      setCooldown(60);
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Failed to resend OTP');
    }
  }

  const purposeLabel: Record<Purpose, string> = {
    register:        'Verification code',
    forgot_password: 'Reset code',
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <TouchableOpacity style={s.back} onPress={() => router.back()} activeOpacity={0.7}>
            <Feather name="arrow-left" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>

          <View style={s.center}>
            <View style={s.iconRing}>
              <Feather name="message-square" size={32} color={Colors.primary} />
            </View>
          </View>

          <Text style={s.title}>Enter the {purposeLabel[purpose ?? 'register']}</Text>
          <Text style={s.sub}>
            Sent to{'\n'}
            <Text style={s.phone}>{maskPhone(phone ?? '')}</Text>
          </Text>

          <GlassCard style={s.card}>
            <OtpInput value={code} onChange={setCode} error={error} autoFocus />

            {error ? (
              <View style={s.errorBox}>
                <Feather name="alert-circle" size={13} color={Colors.error} />
                <Text style={s.errorText}>{error}</Text>
              </View>
            ) : null}

            <NeonButton
              label="Verify"
              onPress={handleVerify}
              loading={loading}
              fullWidth
              style={code.length < 6 ? s.btnDisabled : undefined}
            />

            <View style={s.resendRow}>
              <Text style={s.resendText}>Didn't receive it? </Text>
              {canResend ? (
                <TouchableOpacity onPress={handleResend} activeOpacity={0.7}>
                  <Text style={s.resendLink}>Resend OTP</Text>
                </TouchableOpacity>
              ) : (
                <Text style={s.timer}>
                  Resend in {String(Math.floor(cooldown / 60)).padStart(2, '0')}:{String(cooldown % 60).padStart(2, '0')}
                </Text>
              )}
            </View>
          </GlassCard>

          <TouchableOpacity onPress={() => router.back()} style={s.wrongNumber} activeOpacity={0.7}>
            <Text style={s.wrongNumberText}>Wrong number? Go back</Text>
          </TouchableOpacity>
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
  center: { alignItems: 'center', marginBottom: Spacing.xl },
  iconRing: {
    width: 80, height: 80, borderRadius: 28,
    backgroundColor: 'rgba(124,92,252,0.12)', borderWidth: 1, borderColor: 'rgba(124,92,252,0.3)',
    alignItems: 'center', justifyContent: 'center',
    ...Shadow.neonPrimary,
  },
  title: {
    color: Colors.textPrimary, fontSize: FontSize.xl, fontWeight: FontWeight.bold,
    textAlign: 'center', marginBottom: Spacing.sm,
  },
  sub: {
    color: Colors.textSecondary, fontSize: FontSize.sm, textAlign: 'center',
    lineHeight: 22, marginBottom: Spacing.xl,
  },
  phone:      { color: Colors.primary, fontWeight: FontWeight.semibold },
  card:       { padding: Spacing.xl, gap: Spacing.lg },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,77,106,0.1)', borderWidth: 1,
    borderColor: 'rgba(255,77,106,0.3)', borderRadius: Radius.sm, padding: Spacing.sm,
    marginTop: -4,
  },
  errorText:  { color: Colors.error, fontSize: FontSize.sm, flex: 1 },
  btnDisabled:{ opacity: 0.55 },
  resendRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: -4 },
  resendText: { color: Colors.textSecondary, fontSize: FontSize.sm },
  resendLink: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  timer:      { color: Colors.textTertiary, fontSize: FontSize.sm },
  wrongNumber:{ alignItems: 'center', marginTop: Spacing.lg },
  wrongNumberText: { color: Colors.textSecondary, fontSize: FontSize.sm },
});
