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
import * as AppleAuthentication from 'expo-apple-authentication';
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
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [ssoPending, setSsoPending] = useState<'google' | 'apple' | null>(null);

  const baseUrl = API_BASE_URL;

  /** Posts an SSO ID token to the server, stores the admin token and enters the admin area. */
  const submitSsoToken = async (
    endpoint: '/api/auth/sso/google/mobile' | '/api/auth/sso/apple/mobile',
    body: { idToken: string; name?: string },
  ) => {
    const res = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let message: string = COPY.hostLogin.error.somethingWrong;
      try {
        const data = (await res.json()) as { error?: string };
        if (typeof data?.error === 'string' && data.error) message = data.error;
      } catch {
        /* non-JSON error body — keep the generic message */
      }
      setError(message);
      return;
    }
    const data = (await res.json()) as { ok: boolean; adminToken: string };
    await loginAdmin(data.adminToken);
    router.replace('/admin');
  };

  const handleGoogleLogin = async () => {
    setError('');
    setSsoPending('google');
    try {
      // Lazily required: the native module is unavailable on web builds.
      const { GoogleSignin } = require('@react-native-google-signin/google-signin');
      GoogleSignin.configure({
        webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
        iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      });
      await GoogleSignin.hasPlayServices();
      const result = await GoogleSignin.signIn();
      if (result.type === 'cancelled') return;
      const idToken: string | undefined = result.data?.idToken ?? undefined;
      if (!idToken) {
        setError(COPY.hostLogin.error.somethingWrong);
        return;
      }
      await submitSsoToken('/api/auth/sso/google/mobile', { idToken });
    } catch {
      setError(COPY.hostLogin.error.somethingWrong);
    } finally {
      setSsoPending(null);
    }
  };

  const handleAppleLogin = async () => {
    setError('');
    setSsoPending('apple');
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const idToken = credential.identityToken;
      if (!idToken) {
        setError(COPY.hostLogin.error.somethingWrong);
        return;
      }
      // Apple only supplies the name on the very first authorization — pass it
      // through only when present so the server can backfill displayName.
      const nameParts = [credential.fullName?.givenName, credential.fullName?.familyName]
        .filter(Boolean)
        .join(' ');
      await submitSsoToken('/api/auth/sso/apple/mobile', {
        idToken,
        ...(nameParts ? { name: nameParts } : {}),
      });
    } catch (e: any) {
      if (e?.code === 'ERR_REQUEST_CANCELED') return; // user dismissed the sheet
      setError(COPY.hostLogin.error.somethingWrong);
    } finally {
      setSsoPending(null);
    }
  };

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
        body: JSON.stringify({ email: trimmedEmail, password, rememberMe }),
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

            <Pressable
              style={s.checkboxRow}
              onPress={() => setRememberMe(v => !v)}
              hitSlop={4}
            >
              <View
                style={[
                  s.checkbox,
                  {
                    borderColor: rememberMe ? colors.primary : colors.border,
                    backgroundColor: rememberMe ? colors.primary : 'transparent',
                  },
                ]}
              >
                {rememberMe && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <Text style={[s.checkboxLabel, { color: colors.mutedForeground }]}>
                {COPY.hostLogin.rememberMe}
              </Text>
            </Pressable>

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
                ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <ActivityIndicator color="#fff" />
                    <Text style={s.btnText}>{COPY.hostLogin.signingIn}</Text>
                  </View>
                )
                : <Text style={s.btnText}>{COPY.hostLogin.signInBtn}</Text>}
            </Pressable>

            {Platform.OS !== 'web' && (
              <>
                <View style={s.dividerRow}>
                  <View style={[s.dividerLine, { backgroundColor: colors.border }]} />
                  <Text style={[s.dividerText, { color: colors.mutedForeground }]}>
                    {COPY.hostLogin.orDivider}
                  </Text>
                  <View style={[s.dividerLine, { backgroundColor: colors.border }]} />
                </View>

                <Pressable
                  style={({ pressed }) => [
                    s.ssoBtn,
                    { borderColor: colors.border, backgroundColor: colors.background, opacity: pressed || ssoPending !== null ? 0.7 : 1 },
                  ]}
                  onPress={handleGoogleLogin}
                  disabled={ssoPending !== null || pending}
                >
                  {ssoPending === 'google'
                    ? <ActivityIndicator color={colors.foreground} />
                    : <Ionicons name="logo-google" size={18} color={colors.foreground} />}
                  <Text style={[s.ssoBtnText, { color: colors.foreground }]}>
                    {COPY.hostLogin.continueWithGoogle}
                  </Text>
                </Pressable>

                {Platform.OS === 'ios' && (
                  <Pressable
                    style={({ pressed }) => [
                      s.ssoBtn,
                      { borderColor: colors.border, backgroundColor: colors.background, opacity: pressed || ssoPending !== null ? 0.7 : 1 },
                    ]}
                    onPress={handleAppleLogin}
                    disabled={ssoPending !== null || pending}
                  >
                    {ssoPending === 'apple'
                      ? <ActivityIndicator color={colors.foreground} />
                      : <Ionicons name="logo-apple" size={20} color={colors.foreground} />}
                    <Text style={[s.ssoBtnText, { color: colors.foreground }]}>
                      {COPY.hostLogin.continueWithApple}
                    </Text>
                  </Pressable>
                )}
              </>
            )}

            <Pressable onPress={() => router.push('/admin-forgot-password')} style={s.textLink}>
              <Text style={[s.textLinkText, { color: colors.primary }]}>{COPY.hostLogin.forgotPassword}</Text>
            </Pressable>
          </View>

          <Pressable onPress={() => router.replace('/')} style={s.footerLink}>
            <Text style={[s.footerText, { color: colors.mutedForeground }]}>
              <Text style={{ color: colors.primary }}>{COPY.hostLogin.backToPlayer}</Text>
            </Text>
          </Pressable>

          <Pressable onPress={() => router.push('/admin-register')} style={s.footerLink}>
            <Text style={[s.footerText, { color: colors.mutedForeground }]}>
              {COPY.hostLogin.noAccount}{' '}
              <Text style={{ color: colors.primary }}>{COPY.hostLogin.createOne}</Text>
            </Text>
          </Pressable>

          <View style={s.legalRow}>
            <Text style={[s.legalText, { color: colors.mutedForeground }]}>
              <Text style={{ color: colors.primary }} onPress={() => router.push('/terms')}>
                {COPY.footer.termsOfService}
              </Text>
              {'  ·  '}
              <Text style={{ color: colors.primary }} onPress={() => router.push('/privacy')}>
                {COPY.footer.privacyPolicy}
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
    checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
    checkbox: {
      width: 20, height: 20, borderRadius: 5, borderWidth: 1.5,
      alignItems: 'center', justifyContent: 'center',
    },
    checkboxLabel: { fontSize: 13, fontFamily: 'Manrope_600SemiBold' },
    errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    errorText: { flex: 1, fontSize: 13, lineHeight: 18 },
    btn:      { borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
    btnText:  { color: '#fff', fontSize: 16, fontFamily: 'Manrope_800ExtraBold', letterSpacing: 1 },
    dividerRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 },
    dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
    dividerText: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', letterSpacing: 1 },
    ssoBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      borderWidth: 1, borderRadius: 12, paddingVertical: 14,
    },
    ssoBtnText: { fontSize: 15, fontFamily: 'Manrope_700Bold' },
    textLink: { alignItems: 'center', paddingVertical: 4 },
    textLinkText: { fontSize: 13, fontFamily: 'Manrope_600SemiBold' },
    footerLink: { marginTop: 24, alignItems: 'center' },
    footerText: { fontSize: 14, textAlign: 'center' },
    legalRow:   { marginTop: 16, alignItems: 'center' },
    legalText:  { fontSize: 12, textAlign: 'center', lineHeight: 18 },
  });
