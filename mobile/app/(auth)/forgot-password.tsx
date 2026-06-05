import React, { useState } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import PhoneInput from '../../components/ui/PhoneInput';
import { NeonButton } from '../../components/ui/NeonButton';
import { GlassCard } from '../../components/ui/GlassCard';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../constants/theme';
import { isValidIndianPhone } from '../../lib/phoneUtils';
import api from '../../lib/axios';

// FIREBASE_PHONE_AUTH_DISABLED_TEMP — uncomment block below to re-enable Firebase phone auth
// import { useRef } from 'react';
// import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
// import { signInWithPhoneNumber } from 'firebase/auth';
// import { app, auth } from '../../lib/firebase';
// import { setPending } from '../../lib/pendingAuth';
// FIREBASE_PHONE_AUTH_DISABLED_TEMP — end

export default function ForgotPasswordScreen() {
  const router = useRouter();

  // FIREBASE_PHONE_AUTH_DISABLED_TEMP
  // const recaptchaVerifier = useRef<FirebaseRecaptchaVerifierModal>(null);

  const [phone, setPhone]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function handleSend() {
    setError('');
    if (!isValidIndianPhone(phone)) {
      setError('Please enter a valid phone number, e.g. +919876543210');
      return;
    }
    setLoading(true);
    try {
      // ── 2FACTOR OTP FLOW (active) ─────────────────────────────────────────
      await api.post('/api/auth/send-otp', { phone, purpose: 'forgot_password' });
      router.push({
        pathname: '/(auth)/verify-otp',
        params: { phone, purpose: 'forgot_password' },
      });
      // ── END 2FACTOR OTP FLOW ──────────────────────────────────────────────

      // FIREBASE_PHONE_AUTH_DISABLED_TEMP — uncomment to restore Firebase flow
      // const confirmation = await Promise.race([
      //   signInWithPhoneNumber(auth, phone, recaptchaVerifier.current!),
      //   new Promise<never>((_, reject) =>
      //     setTimeout(() => reject(new Error('Request timed out. Check your connection and try again.')), 30_000)
      //   ),
      // ]);
      // setPending(confirmation);
      // router.push({
      //   pathname: '/(auth)/verify-otp',
      //   params: { phone, purpose: 'forgot_password' },
      // });
      // FIREBASE_PHONE_AUTH_DISABLED_TEMP — end
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      {/* FIREBASE_PHONE_AUTH_DISABLED_TEMP */}
      {/* <FirebaseRecaptchaVerifierModal ref={recaptchaVerifier} firebaseConfig={app.options} attemptInvisibleVerification /> */}
      {/* FIREBASE_PHONE_AUTH_DISABLED_TEMP end */}

      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <TouchableOpacity style={s.back} onPress={() => router.back()} activeOpacity={0.7}>
            <Feather name="arrow-left" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>

          <View style={s.center}>
            <View style={s.iconRing}>
              <Feather name="key" size={28} color={Colors.primary} />
            </View>
          </View>

          <Text style={s.title}>Forgot password?</Text>
          <Text style={s.sub}>Enter your registered phone number and we'll send a reset code</Text>

          <GlassCard style={s.card}>
            {error ? (
              <View style={s.errorBox}>
                <Feather name="alert-circle" size={14} color={Colors.error} />
                <Text style={s.errorText}>{error}</Text>
              </View>
            ) : null}

            <PhoneInput label="Phone Number" onChangeText={setPhone} />

            <NeonButton label="Send Reset Code" onPress={handleSend} loading={loading} fullWidth />

            <TouchableOpacity onPress={() => router.back()} style={s.cancelRow} activeOpacity={0.7}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
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
  center: { alignItems: 'center', marginBottom: Spacing.xl },
  iconRing: {
    width: 72, height: 72, borderRadius: 24,
    backgroundColor: 'rgba(124,92,252,0.12)', borderWidth: 1, borderColor: 'rgba(124,92,252,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { color: Colors.textPrimary, fontSize: FontSize.xl, fontWeight: FontWeight.bold, textAlign: 'center', marginBottom: 4 },
  sub:   { color: Colors.textSecondary, fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20, marginBottom: Spacing.xl },
  card:  { padding: Spacing.xl, gap: Spacing.md },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,77,106,0.1)', borderWidth: 1,
    borderColor: 'rgba(255,77,106,0.3)', borderRadius: Radius.sm, padding: Spacing.sm,
  },
  errorText: { color: Colors.error, fontSize: FontSize.sm, flex: 1 },
  cancelRow: { alignItems: 'center' },
  cancelText: { color: Colors.textSecondary, fontSize: FontSize.sm },
});
