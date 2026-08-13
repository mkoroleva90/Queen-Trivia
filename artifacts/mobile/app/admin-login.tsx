/**
 * Admin (host) login — email + password only.
 *
 * The shared access-code login path has been retired in favour of per-host
 * email accounts.  Each host signs in with the credentials they created at
 * registration, giving them a scoped Bearer token tied to their account.
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
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { API_BASE_URL } from '@/lib/apiBase';
import { useColors } from '@/hooks/useColors';
import { COPY } from '@workspace/copy';

export default function AdminLoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { loginAdmin } = useAdminAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const baseUrl = API_BASE_URL;

  const handleLogin = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) { setError(COPY.hostLogin.error.enterEmail); return; }
    if (!password) { setError(COPY.hostLogin.error.enterPassword); return; }
    setError('');
    setPending(true);
    try {
      const res = await fetch(`${baseUrl}/api/auth/email/admin-mobile-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, password, rememberMe: true }),
      });
      if (res.status === 401) { setError(COPY.hostLogin.error.invalidCredentials); return; }
      if (res.status === 403) {
        setError(COPY.hostLogin.error.verifyEmail);
        return;
      }
      if (!res.ok) { setError(COPY.hostLogin.error.somethingWrong); return; }
      const data = (await res.json()) as { ok: boolean; adminToken: string };
      await loginAdmin(data.adminToken);
      router.replace('/admin');
    } catch {
      setError(COPY.hostLogin.error.connectionError);
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
        {/* Decorative blobs */}
        <View style={[s.blob,  { backgroundColor: colors.primary }]} />
        <View style={[s.blob2, { backgroundColor: colors.secondary }]} />

        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.mutedForeground} />
          <Text style={[s.backText, { color: colors.mutedForeground }]}>{COPY.hostLogin.back}</Text>
        </Pressable>

        <View style={s.content}>
          <View style={s.iconRow}>
            <Ionicons name="shield-checkmark" size={48} color={colors.primary} />
          </View>
          <Text style={[s.title, { color: colors.foreground }]}>{COPY.hostLogin.mobileHeading}</Text>
          <Text style={[s.subtitle, { color: colors.mutedForeground }]}>
            {COPY.hostLogin.mobileHelper}
          </Text>

          <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Email */}
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

            {/* Password */}
            <Text style={[s.label, { color: colors.mutedForeground }]}>{COPY.hostLogin.passwordLabel}</Text>
            <View style={s.passwordRow}>
              <TextInput
                style={[s.input, s.passwordInput, { backgroundColor: colors.background, color: colors.foreground, borderColor: error ? colors.destructive : colors.border }]}
                value={password}
                onChangeText={(t) => { setPassword(t); setError(''); }}
                placeholder={COPY.hostLogin.mobilePasswordPlaceholder}
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <Pressable style={s.eyeBtn} onPress={() => setShowPassword(v => !v)} hitSlop={8}>
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={colors.mutedForeground} />
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
              onPress={handleLogin}
              disabled={pending}
            >
              {pending
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnText}>{COPY.hostLogin.signInBtn}</Text>}
            </Pressable>

            <Pressable onPress={() => router.push('/admin-forgot-password')} style={s.textLink}>
              <Text style={[s.textLinkText, { color: colors.primary }]}>{COPY.hostLogin.forgotPassword}</Text>
            </Pressable>
          </View>

          <Pressable onPress={() => router.push('/admin-register')} style={s.footerLink}>
            <Text style={[s.footerText, { color: colors.mutedForeground }]}>
              {COPY.hostLogin.noAccount}{' '}
              <Text style={{ color: colors.primary }}>{COPY.hostLogin.createOne}</Text>
            </Text>
          </Pressable>

          <View style={s.legalRow}>
            <Text style={[s.legalText, { color: colors.mutedForeground }]}>
              <Text style={{ color: colors.primary }} onPress={() => router.push('/terms')}>
                Terms of Service
              </Text>
              {'  ·  '}
              <Text style={{ color: colors.primary }} onPress={() => router.push('/privacy')}>
                Privacy Policy
              </Text>
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    container: { paddingHorizontal: 24, flexGrow: 1 },
    blob:  { position: 'absolute', width: 220, height: 220, borderRadius: 110, top: 60,   left: -80, opacity: 0.12 },
    blob2: { position: 'absolute', width: 180, height: 180, borderRadius: 90,  bottom: 120, right: -60, opacity: 0.10 },
    backBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 24 },
    backText: { fontSize: 15 },
    content:  { flex: 1, justifyContent: 'center' },
    iconRow:  { alignItems: 'center', marginBottom: 16 },
    title:    { fontSize: 32, fontFamily: 'Manrope_800ExtraBold', textAlign: 'center', letterSpacing: 2 },
    subtitle: { fontSize: 14, textAlign: 'center', marginTop: 8, marginBottom: 24, lineHeight: 20 },
    card:     { borderRadius: 16, borderWidth: 1, padding: 24, gap: 12 },
    label:    { fontSize: 11, fontFamily: 'Manrope_700Bold', letterSpacing: 2 },
    input: {
      borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
      fontSize: 15, fontFamily: 'Manrope_600SemiBold',
    },
    passwordRow: { position: 'relative' },
    passwordInput: { paddingRight: 48 },
    eyeBtn: { position: 'absolute', right: 14, top: 14 },
    errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    errorText: { flex: 1, fontSize: 13, lineHeight: 18 },
    btn:      { borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
    btnText:  { color: '#fff', fontSize: 16, fontFamily: 'Manrope_800ExtraBold', letterSpacing: 1 },
    textLink: { alignItems: 'center', paddingVertical: 4 },
    textLinkText: { fontSize: 13, fontFamily: 'Manrope_600SemiBold' },
    footerLink: { marginTop: 24, alignItems: 'center' },
    footerText: { fontSize: 14, textAlign: 'center' },
    legalRow:   { marginTop: 16, alignItems: 'center' },
    legalText:  { fontSize: 12, textAlign: 'center', lineHeight: 18 },
  });
