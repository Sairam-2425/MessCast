import React, { useState } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView,
  Platform, TouchableOpacity, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Yup from 'yup';
import { Formik } from 'formik';
import PhoneInput from '../../components/ui/PhoneInput';
import { GlassInput } from '../../components/ui/GlassInput';
import { NeonButton } from '../../components/ui/NeonButton';
import { GlassCard } from '../../components/ui/GlassCard';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../constants/theme';
import { isValidIndianPhone } from '../../lib/phoneUtils';
import api from '../../lib/axios';

// FIREBASE_PHONE_AUTH_DISABLED_TEMP — OTP is still sent here for signup verification,
// but via 2Factor backend. Firebase signup code is preserved in comments below.

const schema = Yup.object({
  displayName:     Yup.string().min(2, 'Min 2 characters').required('Name is required'),
  email:           Yup.string().email('Invalid email').optional(),
  password:        Yup.string().min(8, 'Min 8 characters').required('Password is required'),
  confirmPassword: Yup.string()
    .required('Please confirm your password')
    .test('match', 'Passwords do not match', function (value) {
      return value === this.parent.password;
    }),
});

type FormValues = {
  displayName: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export default function PhoneRegisterScreen() {
  const router = useRouter();

  const [phone, setPhone]           = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [apiError, setApiError]     = useState('');

  async function handleSend(
    values: FormValues,
    { setSubmitting }: { setSubmitting: (b: boolean) => void }
  ) {
    setApiError('');
    setPhoneError('');

    if (!isValidIndianPhone(phone)) {
      setPhoneError('Please enter a valid phone number, e.g. +919876543210');
      setSubmitting(false);
      return;
    }

    try {
      // Send OTP to verify phone ownership (required only at signup)
      await api.post('/api/auth/send-otp', { phone, purpose: 'register' });

      // Pass all signup data to verify-otp screen — account created after OTP confirmed
      router.push({
        pathname: '/(auth)/verify-otp',
        params: {
          phone,
          purpose:     'register',
          displayName: values.displayName.trim(),
          email:       values.email?.trim() ?? '',
          password:    values.password,
        },
      });
    } catch (err: unknown) {
      setApiError((err as Error).message ?? 'Failed to send OTP. Please try again.');
      setSubmitting(false);
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
            <Text style={s.tagline}>Join the conversation</Text>
          </View>

          <GlassCard style={s.card}>
            <Text style={s.heading}>Create account</Text>
            <Text style={s.sub}>Fill in your details — we'll verify your phone number</Text>

            {apiError ? (
              <View style={s.errorBox}>
                <Feather name="alert-circle" size={14} color={Colors.error} />
                <Text style={s.errorText}>{apiError}</Text>
              </View>
            ) : null}

            <Formik
              initialValues={{ displayName: '', email: '', password: '', confirmPassword: '' }}
              validationSchema={schema}
              onSubmit={handleSend}
            >
              {({ handleChange, handleBlur, handleSubmit, values, errors, touched, isSubmitting }) => (
                <View style={s.form}>

                  <GlassInput
                    label="Display Name"
                    placeholder="Your name"
                    leftIcon="user"
                    value={values.displayName}
                    onChangeText={handleChange('displayName')}
                    onBlur={handleBlur('displayName')}
                    error={touched.displayName ? errors.displayName : undefined}
                  />

                  <GlassInput
                    label="Email (optional)"
                    placeholder="you@example.com"
                    leftIcon="mail"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={values.email}
                    onChangeText={handleChange('email')}
                    onBlur={handleBlur('email')}
                    error={touched.email ? errors.email : undefined}
                  />

                  <PhoneInput
                    label="Phone Number"
                    onChangeText={setPhone}
                    error={phoneError || undefined}
                  />

                  <GlassInput
                    label="Password"
                    placeholder="Min 8 characters"
                    secure
                    leftIcon="lock"
                    value={values.password}
                    onChangeText={handleChange('password')}
                    onBlur={handleBlur('password')}
                    error={touched.password ? errors.password : undefined}
                  />

                  <GlassInput
                    label="Confirm Password"
                    placeholder="Repeat password"
                    secure
                    leftIcon="lock"
                    value={values.confirmPassword}
                    onChangeText={handleChange('confirmPassword')}
                    onBlur={handleBlur('confirmPassword')}
                    error={touched.confirmPassword ? errors.confirmPassword : undefined}
                  />

                  <View style={s.hint}>
                    <Feather name="info" size={12} color={Colors.textTertiary} />
                    <Text style={s.hintText}>An OTP will be sent to verify your phone. After that, log in with your password — no OTP needed.</Text>
                  </View>

                  <NeonButton
                    label="Send Verification Code"
                    onPress={handleSubmit as () => void}
                    loading={isSubmitting}
                    fullWidth
                  />
                </View>
              )}
            </Formik>

            <View style={s.footer}>
              <Text style={s.footerText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.replace('/(auth)/login')} activeOpacity={0.7}>
                <Text style={s.link}>Sign in</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bgBase },
  flex:   { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.xxl },
  back: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgLayer1, alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  logoArea: { alignItems: 'center', marginBottom: Spacing.xl, gap: 8 },
  logoIcon: {
    width: 72, height: 72, borderRadius: 24,
    backgroundColor: 'rgba(124,92,252,0.15)', borderWidth: 1, borderColor: 'rgba(124,92,252,0.3)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  logoText: {
    color: Colors.primary, fontSize: FontSize.hero, fontWeight: FontWeight.bold,
    letterSpacing: 4, textShadowColor: Colors.primaryGlow,
    textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 20,
  },
  tagline: { color: Colors.textTertiary, fontSize: FontSize.sm },
  card:    { padding: Spacing.xl, gap: 4 },
  heading: { color: Colors.textPrimary, fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  sub:     { color: Colors.textSecondary, fontSize: FontSize.sm, marginBottom: Spacing.sm },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,77,106,0.1)', borderWidth: 1,
    borderColor: 'rgba(255,77,106,0.3)', borderRadius: Radius.sm, padding: Spacing.sm,
  },
  errorText: { color: Colors.error, fontSize: FontSize.sm, flex: 1 },
  form:    { gap: Spacing.md, marginTop: Spacing.sm },
  hint:    { flexDirection: 'row', alignItems: 'flex-start', gap: 5 },
  hintText:{ color: Colors.textTertiary, fontSize: FontSize.xs, flex: 1, lineHeight: 16 },
  footer:  { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.lg },
  footerText: { color: Colors.textSecondary, fontSize: FontSize.sm },
  link:    { color: Colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
});
