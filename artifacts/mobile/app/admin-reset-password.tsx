/**
 * Mobile password-reset completion screen.
 * The host arrives here after requesting a code on the forgot-password screen.
 * They enter the 6-digit code from their email, a new password, and a
 * confirmation. On success they are signed in and sent to the dashboard.
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { API_BASE_URL } from '@/lib/apiBase';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { COPY } from '@workspace/copy';

export default function AdminResetPasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { loginAdmin } = useAdminAuth();
  const { email } = useLocalSearchParams<{ email: string }>();

  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const baseUrl = API_BASE_URL;

  const handleSubmit = async () => {
    const trimmedCode = code.trim();
    if (!trimmedCode) { setError(COPY.hostForgotPassword.error.enterCode); return; }
    if (!/^\d{6}$/.test(trimmedCode)) { setError(COPY.hostForgotPassword.error.codeLength); return; }
    if (!password) { setError(COPY.hostForgotPassword.error.enterNewPassword); return; }
    if (password.length < 8) { setError(COPY.hostForgotPassword.error.passwordTooShort); return; }
    if (password !== confirm) { setError(COPY.hostForgotPassword.error.passwordsNoMatch); return; }
    setError('');
    setPending(true);
    try {
      const res = await fetch(`${baseUrl}/api/auth/email/mobile-reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email ?? '', code: trimmedCode, password }),
      });
      if (res.status === 400) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        // Treat any 400 as an invalid/expired code regardless of exact message.
        setError(body.error?.toLowerCase().includes('expired') || body.error?.toLowerCase().includes('invalid')
          ? COPY.hostForgotPassword.error.invalidCode
          : (body.error ?? COPY.hostForgotPassword.error.somethingWrong));
        return;
      }
      if (!res.ok) {
        setError(COPY.hostForgotPassword.error.somethingWrong);
        return;
      }
      const data = await res.json() as { ok: boolean; adminToken: string };
      await loginAdmin(data.adminToken);
      router.replace('/admin');
    } catch {
      setError(COPY.hostForgotPassword.error.connectionError);
    } finally {
      setPending(false);
    }
  };

  const s = styles(colors);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[s.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[s.blob,  { backgroundColor: colors.primary }]} />
        <View style={[s.blob2, { backgroundColor: colors.secondary }]} />

        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.mutedForeground} />
          <Text style={[s.backText, { color: colors.mutedForeground }]}>{COPY.hostForgotPassword.back}</Text>
        </Pressable>

        <View style={s.content}>
          <View style={s.iconRow}>
            <Ionicons name="key" size={48} color={colors.primary} />
          </View>
          <Text style={[s.title, { color: colors.foreground }]}>{COPY.hostForgotPassword.resetHeading}</Text>
          <Text style={[s.subtitle, { color: colors.mutedForeground }]}>
            {COPY.hostForgotPassword.resetHelper}
          </Text>

          <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Code */}
            <Text style={[s.label, { color: colors.mutedForeground }]}>{COPY.hostForgotPassword.codeLabel}</Text>
            <TextInput
              style={[s.input, s.codeInput, { backgroundColor: colors.background, color: colors.foreground, borderColor: error ? colors.destructive : colors.border }]}
              value={code}
              onChangeText={(t) => { setCode(t.replace(/\D/g, '').slice(0, 6)); setError(''); }}
              placeholder={COPY.hostForgotPassword.codePlaceholder}
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
              maxLength={6}
              returnKeyType="next"
            />

            {/* New password */}
            <Text style={[s.label, { color: colors.mutedForeground }]}>{COPY.hostForgotPassword.newPasswordLabel}</Text>
            <View style={s.passwordRow}>
              <TextInput
                style={[s.input, s.passwordInput, { backgroundColor: colors.background, color: colors.foreground, borderColor: error ? colors.destructive : colors.border }]}
                value={password}
                onChangeText={(t) => { setPassword(t); setError(''); }}
                placeholder={COPY.hostForgotPassword.newPasswordPlaceholder}
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                returnKeyType="next"
              />
              <Pressable style={s.eyeBtn} onPress={() => setShowPassword(v => !v)} hitSlop={8}>
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>

            {/* Confirm password */}
            <Text style={[s.label, { color: colors.mutedForeground }]}>{COPY.hostForgotPassword.confirmLabel}</Text>
            <View style={s.passwordRow}>
              <TextInput
                style={[s.input, s.passwordInput, { backgroundColor: colors.background, color: colors.foreground, borderColor: error ? colors.destructive : colors.border }]}
                value={confirm}
                onChangeText={(t) => { setConfirm(t); setError(''); }}
                placeholder={COPY.hostForgotPassword.confirmPlaceholder}
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showConfirm}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
              <Pressable style={s.eyeBtn} onPress={() => setShowConfirm(v => !v)} hitSlop={8}>
                <Ionicons name={showConfirm ? 'eye-off' : 'eye'} size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>

            {!!error && (
              <View style={s.errorRow}>
                <Ionicons name="alert-circle" size={16} color={colors.destructive} />
                <Text style={[s.errorText, { color: colors.destructive }]}>{error}</Text>
              </View>
            )}

            <Pressable
              style={({ pressed }) => [s.btn, { backgroundColor: colors.primary, opacity: pressed || pending ? 0.8 : 1 }]}
              onPress={handleSubmit}
              disabled={pending}
            >
              {pending
                ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <ActivityIndicator color="#fff" />
                    <Text style={s.btnText}>{COPY.hostForgotPassword.submitting}</Text>
                  </View>
                )
                : <Text style={s.btnText}>{COPY.hostForgotPassword.submitBtn}</Text>}
            </Pressable>
          </View>

          <Pressable onPress={() => router.replace('/admin-login')} style={s.footerLink}>
            <Text style={[s.footerText, { color: colors.mutedForeground }]}>
              {COPY.hostForgotPassword.rememberedIt}{' '}
              <Text style={{ color: colors.primary }}>{COPY.hostForgotPassword.signIn}</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    container:     { paddingHorizontal: 24, flexGrow: 1 },
    blob:  { position: 'absolute', width: 220, height: 220, borderRadius: 110, top: 60,    left: -80,  opacity: 0.12 },
    blob2: { position: 'absolute', width: 180, height: 180, borderRadius: 90,  bottom: 120, right: -60, opacity: 0.10 },
    backBtn:       { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 24 },
    backText:      { fontSize: 15 },
    content:       { flex: 1, justifyContent: 'center' },
    iconRow:       { alignItems: 'center', marginBottom: 16 },
    title:         { fontSize: 28, fontFamily: 'Manrope_800ExtraBold', textAlign: 'center', letterSpacing: 2 },
    subtitle:      { fontSize: 14, textAlign: 'center', marginTop: 8, marginBottom: 24, lineHeight: 20 },
    card:          { borderRadius: 16, borderWidth: 1, padding: 24, gap: 12 },
    label:         { fontSize: 11, fontFamily: 'Manrope_700Bold', letterSpacing: 2 },
    input: {
      borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
      fontSize: 15, fontFamily: 'Manrope_600SemiBold',
    },
    codeInput:     { fontSize: 22, fontFamily: 'Manrope_800ExtraBold', letterSpacing: 6, textAlign: 'center' },
    passwordRow:   { position: 'relative' },
    passwordInput: { paddingRight: 48 },
    eyeBtn:        { position: 'absolute', right: 14, top: 14 },
    errorRow:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
    errorText:     { flex: 1, fontSize: 13, lineHeight: 18 },
    btn:           { borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
    btnText:       { color: '#fff', fontSize: 16, fontFamily: 'Manrope_800ExtraBold', letterSpacing: 1 },
    footerLink:    { marginTop: 20, alignItems: 'center' },
    footerText:    { fontSize: 14, textAlign: 'center' },
  });
