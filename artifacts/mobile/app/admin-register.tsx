/**
 * Host account registration — open self-service signup.
 * No existing admin session required.
 *
 * Two steps: the form posts to /auth/email/mobile-register, which emails a
 * 6-digit code; the code step posts to /auth/email/mobile-verify, which
 * returns a mobile Bearer token so the host lands on the admin home signed in.
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/components/ThemedText';
import { TextInput } from '@/components/ThemedTextInput';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { COPY } from '@workspace/copy';
import { API_BASE_URL } from '@/lib/apiBase';
import { useAdminAuth } from '@/context/AdminAuthContext';

export default function AdminRegisterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { loginAdmin } = useAdminAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [code, setCode] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState('');

  const baseUrl = API_BASE_URL;

  const handleSubmit = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) { setError(COPY.hostLogin.error.enterEmail); return; }
    if (!password) { setError(COPY.hostRegister.error.enterPassword); return; }
    if (password.length < 8) { setError(COPY.hostForgotPassword.error.passwordTooShort); return; }
    if (password !== confirm) { setError(COPY.hostForgotPassword.error.passwordsNoMatch); return; }
    setError('');
    setPending(true);
    try {
      const res = await fetch(`${baseUrl}/api/auth/email/mobile-register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, password }),
      });
      if (res.status === 503) {
        setError(COPY.hostForgotPassword.error.emailServiceDown);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setError(body.error ?? COPY.hostLogin.error.somethingWrong);
        return;
      }
      setCode('');
      setVerifyError('');
      setDone(true);
    } catch {
      setError(COPY.hostLogin.error.connectionError);
    } finally {
      setPending(false);
    }
  };

  const handleVerify = async () => {
    const trimmedCode = code.trim();
    if (!trimmedCode) { setVerifyError(COPY.hostForgotPassword.error.enterCode); return; }
    if (!/^\d{6}$/.test(trimmedCode)) { setVerifyError(COPY.hostForgotPassword.error.codeLength); return; }
    setVerifyError('');
    setVerifying(true);
    try {
      const res = await fetch(`${baseUrl}/api/auth/email/mobile-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: trimmedCode }),
      });
      if (res.status === 400) {
        setVerifyError(COPY.hostRegister.error.invalidCode);
        return;
      }
      if (res.status === 429) {
        setVerifyError(COPY.hostRegister.error.tooManyAttempts);
        return;
      }
      if (!res.ok) {
        setVerifyError(COPY.hostLogin.error.somethingWrong);
        return;
      }
      const data = await res.json() as { ok: boolean; adminToken: string };
      await loginAdmin(data.adminToken);
      router.replace('/admin');
    } catch {
      setVerifyError(COPY.hostLogin.error.connectionError);
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (resending) return;
    setResendMsg('');
    setVerifyError('');
    setResending(true);
    try {
      const res = await fetch(`${baseUrl}/api/auth/email/mobile-resend-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      if (res.status === 503) {
        setVerifyError(COPY.hostForgotPassword.error.emailServiceDown);
        return;
      }
      // Server always returns a generic ack; show the same confirmation
      // regardless of account state (no enumeration).
      setResendMsg(COPY.hostRegister.verify.resent);
    } catch {
      setVerifyError(COPY.hostLogin.error.connectionError);
    } finally {
      setResending(false);
    }
  };

  const s = styles(colors);

  if (done) {
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

          <Pressable onPress={() => { setDone(false); setVerifyError(''); }} style={s.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.mutedForeground} />
            <Text style={[s.backText, { color: colors.mutedForeground }]}>{COPY.common.back}</Text>
          </Pressable>

          <View style={s.content}>
            <View style={s.iconRow}>
              <Ionicons name="mail" size={48} color={colors.primary} />
            </View>
            <Text style={[s.title, { color: colors.foreground }]}>{COPY.hostRegister.verify.heading}</Text>
            <Text style={[s.subtitle, { color: colors.mutedForeground }]}>
              {COPY.hostRegister.verify.helperPrefix}{' '}
              <Text style={{ color: colors.foreground }}>{email.trim().toLowerCase()}</Text>.
            </Text>

            <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.label, { color: colors.mutedForeground }]}>{COPY.hostRegister.verify.codeLabel}</Text>
              <TextInput
                style={[s.input, s.codeInput, { backgroundColor: colors.background, color: colors.foreground, borderColor: verifyError ? colors.destructive : colors.border }]}
                value={code}
                onChangeText={(t) => { setCode(t.replace(/\D/g, '').slice(0, 6)); setVerifyError(''); setResendMsg(''); }}
                placeholder={COPY.hostRegister.verify.codePlaceholder}
                placeholderTextColor={colors.mutedForeground}
                keyboardType="number-pad"
                maxLength={6}
                returnKeyType="done"
                onSubmitEditing={handleVerify}
                autoFocus
              />

              {!!verifyError && (
                <View style={s.errorRow}>
                  <Ionicons name="alert-circle" size={16} color={colors.destructive} />
                  <Text style={[s.errorText, { color: colors.destructive }]}>{verifyError}</Text>
                </View>
              )}

              <Pressable
                style={({ pressed }) => [s.btn, { backgroundColor: colors.primary, opacity: pressed || verifying ? 0.8 : 1 }]}
                onPress={handleVerify}
                disabled={verifying}
              >
                {verifying
                  ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <ActivityIndicator color="#fff" />
                      <Text style={s.btnText}>{COPY.hostRegister.verify.submitting}</Text>
                    </View>
                  )
                  : <Text style={s.btnText}>{COPY.hostRegister.verify.submitBtn}</Text>}
              </Pressable>

              <Pressable onPress={handleResend} disabled={resending} style={s.resendRow} hitSlop={8}>
                <Text style={[s.footerText, { color: colors.mutedForeground }]}>
                  {COPY.hostRegister.verify.resendPrompt}{' '}
                  <Text style={{ color: colors.primary }}>
                    {resending ? COPY.hostRegister.verify.resending : COPY.hostRegister.verify.resendLink}
                  </Text>
                </Text>
              </Pressable>

              {!!resendMsg && (
                <View style={s.errorRow}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                  <Text style={[s.errorText, { color: colors.mutedForeground }]}>{resendMsg}</Text>
                </View>
              )}
            </View>

            <Pressable onPress={() => { setDone(false); setVerifyError(''); }} style={s.footerLink}>
              <Text style={[s.footerText, { color: colors.mutedForeground }]}>
                {COPY.hostRegister.verify.wrongEmail}{' '}
                <Text style={{ color: colors.primary }}>{COPY.hostRegister.verify.startOver}</Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

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
          <Text style={[s.backText, { color: colors.mutedForeground }]}>{COPY.common.back}</Text>
        </Pressable>

        <View style={s.content}>
          <View style={s.iconRow}>
            <Ionicons name="person-add" size={48} color={colors.primary} />
          </View>
          <Text style={[s.title, { color: colors.foreground }]}>{COPY.hostRegister.heading}</Text>
          <Text style={[s.subtitle, { color: colors.mutedForeground }]}>
            {COPY.hostRegister.helper}
          </Text>

          <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.label, { color: colors.mutedForeground }]}>{COPY.hostLogin.emailLabel}</Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: error ? colors.destructive : colors.border }]}
              value={email}
              onChangeText={(t) => { setEmail(t); setError(''); }}
              placeholder={COPY.hostLogin.mobileEmailPlaceholder}
              placeholderTextColor={colors.mutedForeground}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />

            <Text style={[s.label, { color: colors.mutedForeground }]}>{COPY.hostLogin.passwordLabel}</Text>
            <View style={s.passwordRow}>
              <TextInput
                style={[s.input, s.passwordInput, { backgroundColor: colors.background, color: colors.foreground, borderColor: error ? colors.destructive : colors.border }]}
                value={password}
                onChangeText={(t) => { setPassword(t); setError(''); }}
                placeholder={COPY.hostRegister.passwordPlaceholder}
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                returnKeyType="next"
              />
              <Pressable style={s.eyeBtn} onPress={() => setShowPassword(v => !v)} hitSlop={8}>
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>

            <Text style={[s.label, { color: colors.mutedForeground }]}>{COPY.hostForgotPassword.confirmLabel}</Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: error ? colors.destructive : colors.border }]}
              value={confirm}
              onChangeText={(t) => { setConfirm(t); setError(''); }}
              placeholder={COPY.hostForgotPassword.confirmPlaceholder}
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />

            {!!error && (
              <View style={s.errorRow}>
                <Ionicons name="alert-circle" size={16} color={colors.destructive} />
                <Text style={[s.errorText, { color: colors.destructive }]}>{error}</Text>
              </View>
            )}

            <Text style={[s.legalText, { color: colors.mutedForeground }]}>
              {COPY.hostRegister.legalPrefix}{' '}
              <Text style={{ color: colors.primary }} onPress={() => router.push('/terms')}>
                {COPY.footer.termsOfService}
              </Text>
              {' '}{COPY.hostRegister.legalAnd}{' '}
              <Text style={{ color: colors.primary }} onPress={() => router.push('/privacy')}>
                {COPY.footer.privacyPolicy}
              </Text>
              .
            </Text>

            <Pressable
              style={({ pressed }) => [s.btn, { backgroundColor: colors.primary, opacity: pressed || pending ? 0.8 : 1 }]}
              onPress={handleSubmit}
              disabled={pending}
            >
              {pending
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnText}>{COPY.hostRegister.submitBtn}</Text>}
            </Pressable>
          </View>

          <Pressable onPress={() => router.replace('/admin-login')} style={s.footerLink}>
            <Text style={[s.footerText, { color: colors.mutedForeground }]}>
              {COPY.hostRegister.haveAccount}{' '}
              <Text style={{ color: colors.primary }}>{COPY.hostRegister.signInLink}</Text>
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
    blob:  { position: 'absolute', width: 220, height: 220, borderRadius: 110, top: 60,   left: -80, opacity: 0.12 },
    blob2: { position: 'absolute', width: 180, height: 180, borderRadius: 90,  bottom: 120, right: -60, opacity: 0.10 },
    backBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 24 },
    backText: { fontSize: 15 },
    content:  { flex: 1, justifyContent: 'center' },
    iconRow:  { alignItems: 'center', marginBottom: 16 },
    title:    { fontSize: 28, fontFamily: 'Manrope_800ExtraBold', textAlign: 'center', letterSpacing: 2 },
    subtitle: { fontSize: 14, textAlign: 'center', marginTop: 8, marginBottom: 24, lineHeight: 20 },
    card:     { borderRadius: 16, borderWidth: 1, padding: 24, gap: 12 },
    label:    { fontSize: 11, fontFamily: 'Manrope_700Bold', letterSpacing: 2 },
    input: {
      borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
      fontSize: 15, fontFamily: 'Manrope_600SemiBold',
    },
    codeInput:    { fontSize: 22, fontFamily: 'Manrope_800ExtraBold', letterSpacing: 6, textAlign: 'center' },
    passwordRow:  { position: 'relative' },
    passwordInput: { paddingRight: 48 },
    eyeBtn:       { position: 'absolute', right: 14, top: 14 },
    errorRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
    errorText:    { flex: 1, fontSize: 13, lineHeight: 18 },
    btn:          { borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
    btnText:      { color: '#fff', fontSize: 16, fontFamily: 'Manrope_800ExtraBold', letterSpacing: 1 },
    footerLink:   { marginTop: 24, alignItems: 'center' },
    resendRow:    { alignItems: 'center', marginTop: 4 },
    footerText:   { fontSize: 14, textAlign: 'center' },
    legalText:    { fontSize: 12, textAlign: 'center', lineHeight: 18 },
  });
