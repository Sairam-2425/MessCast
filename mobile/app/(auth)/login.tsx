import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Formik } from 'formik';
import * as Yup from 'yup';
import { Feather } from '@expo/vector-icons';
import { GlassCard } from '../../components/ui/GlassCard';
import { GlassInput } from '../../components/ui/GlassInput';
import { NeonButton } from '../../components/ui/NeonButton';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { connectSocket } from '../../lib/socket';
import api from '../../lib/axios';

const emailSchema = Yup.object({
  email:    Yup.string().email('Invalid email').required('Required'),
  password: Yup.string().min(8, 'Min 8 characters').required('Required'),
});

export default function LoginScreen() {
  const router  = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [apiError, setApiError] = useState('');

  async function handleEmailLogin(values: { email: string; password: string }) {
    setApiError('');
    try {
      const { data } = await api.post('/api/auth/login', values);
      await setUser(data.user, data.token);
      connectSocket(data.token);
      router.replace(data.user.role === 'admin' ? '/(admin)' : '/(user)');
    } catch (err: unknown) {
      setApiError((err as Error).message ?? 'Login failed.');
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Logo */}
          <View style={s.logoArea}>
            <View style={s.logoIcon}>
              <Feather name="message-circle" size={36} color={Colors.primary} />
            </View>
            <Text style={s.logoText}>MESSCAST</Text>
            <Text style={s.tagline}>Your premium messenger</Text>
          </View>

          <GlassCard style={s.card}>
            <Text style={s.heading}>Welcome back</Text>
            <Text style={s.subheading}>Sign in to continue</Text>

            {apiError ? (
              <View style={s.errorBox}>
                <Feather name="alert-circle" size={14} color={Colors.error} />
                <Text style={s.errorText}>{apiError}</Text>
              </View>
            ) : null}

            {/* Email form */}
            <Formik
              initialValues={{ email: '', password: '' }}
              validationSchema={emailSchema}
              onSubmit={handleEmailLogin}
            >
              {({ handleChange, handleBlur, handleSubmit, values, errors, touched, isSubmitting }) => (
                <View style={s.form}>
                  <GlassInput
                    label="Email"
                    placeholder="you@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    leftIcon="mail"
                    value={values.email}
                    onChangeText={handleChange('email')}
                    onBlur={handleBlur('email')}
                    error={touched.email ? errors.email : undefined}
                  />
                  <GlassInput
                    label="Password"
                    placeholder="••••••••"
                    secure
                    leftIcon="lock"
                    value={values.password}
                    onChangeText={handleChange('password')}
                    onBlur={handleBlur('password')}
                    error={touched.password ? errors.password : undefined}
                  />
                  <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')} style={s.forgotRow}>
                    <Text style={s.forgotText}>Forgot password?</Text>
                  </TouchableOpacity>
                  <NeonButton
                    label="Sign In"
                    onPress={handleSubmit as () => void}
                    loading={isSubmitting}
                    fullWidth
                  />
                </View>
              )}
            </Formik>

            {/* Divider */}
            <View style={s.dividerRow}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>OR</Text>
              <View style={s.dividerLine} />
            </View>

            {/* Phone login button */}
            <TouchableOpacity style={s.phoneBtn} onPress={() => router.push('/(auth)/phone-login')} activeOpacity={0.7}>
              <Feather name="smartphone" size={18} color={Colors.primary} />
              <Text style={s.phoneBtnText}>Continue with Phone Number</Text>
            </TouchableOpacity>

            <View style={s.footer}>
              <Text style={s.footerText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/register')} activeOpacity={0.7}>
                <Text style={s.link}>Create one</Text>
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
  logoArea: { alignItems: 'center', marginBottom: Spacing.xxl, gap: 8 },
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
  tagline:    { color: Colors.textTertiary, fontSize: FontSize.sm },
  card:       { padding: Spacing.xl, gap: Spacing.md },
  heading:    { color: Colors.textPrimary, fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  subheading: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: -4 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,77,106,0.1)', borderWidth: 1,
    borderColor: 'rgba(255,77,106,0.3)', borderRadius: Radius.sm, padding: Spacing.sm,
  },
  errorText:  { color: Colors.error, fontSize: FontSize.sm, flex: 1 },
  form:       { gap: Spacing.md },
  forgotRow:  { alignSelf: 'flex-end', marginTop: -4 },
  forgotText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  dividerLine:{ flex: 1, height: 1, backgroundColor: Colors.glassBorder },
  dividerText:{ color: Colors.textTertiary, fontSize: FontSize.xs },
  phoneBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, borderWidth: 1, borderColor: Colors.primary,
    borderRadius: Radius.md, paddingVertical: 14,
    backgroundColor: 'rgba(124,92,252,0.08)',
  },
  phoneBtnText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  footer: { flexDirection: 'row', justifyContent: 'center' },
  footerText: { color: Colors.textSecondary, fontSize: FontSize.sm },
  link:       { color: Colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
});
