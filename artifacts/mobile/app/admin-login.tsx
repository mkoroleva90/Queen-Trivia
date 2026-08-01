/**
 * Admin login screen.
 *
 * Two paths:
 *  1. Email + password → POST /api/auth/email/admin-mobile-login
 *     Returns a Bearer token scoped to the admin's account (adminAccountId).
 *     Game-ownership restrictions apply: admins only see/edit their own games.
 *
 *  2. Access code → POST /api/admin/login
 *     Returns a Bearer token without adminAccountId (super-admin).
 *     Legacy code-based path: all games visible (same as browser code login).
 *
 * New admins who registered with email should use path 1.
 * Hosts who only have the shared access code use path 2.
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { useColors } from '@/hooks/useColors';

type LoginMode = 'email' | 'code';

export default function AdminLoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { loginAdmin } = useAdminAuth();

  const [mode, setMode] = useState<LoginMode>('email');

  // Email login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Code login state
  const [code, setCode] = useState('');

  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const baseUrl = process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
    : '';

  const handleEmailLogin = async () => {
    if (!email.trim()) { setError('Enter your email address'); return; }
    if (!password) { setError('Enter your password'); return; }
    setError('');
    setPending(true);
    try {
      const res = await fetch(`${baseUrl}/api/auth/email/admin-mobile-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password, rememberMe: true }),
      });
      if (res.status === 401) { setError('Incorrect email or password'); return; }
      if (res.status === 403) { setError('Account not verified — check your inbox for the verification email (or spam folder)'); return; }
      if (!res.ok) { setError('Something went wrong — please retry'); return; }
      const data = (await res.json()) as { ok: boolean; adminToken: string };
      await loginAdmin(data.adminToken);
      router.replace('/admin');
    } catch {
      setError('Connection error — please retry');
    } finally {
      setPending(false);
    }
  };

  const handleCodeLogin = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) { setError('Enter your admin code'); return; }
    setError('');
    setPending(true);
    try {
      const res = await fetch(`${baseUrl}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed, rememberMe: true }),
      });
      if (res.status === 401) { setError("That code isn't right — try again"); return; }
      if (!res.ok) { setError('Something went wrong — please retry'); return; }
      const data = (await res.json()) as { ok: boolean; adminToken: string };
      await loginAdmin(data.adminToken);
      router.replace('/admin');
    } catch {
      setError('Connection error — please retry');
    } finally {
      setPending(false);
    }
  };

  const s = styles(colors);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[s.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
      keyboardShouldPersistTaps="handled"
    >
      {/* Ambient blobs */}
      <View style={[s.blob, { backgroundColor: colors.primary }]} />
      <View style={[s.blob2, { backgroundColor: colors.secondary }]} />

      <Pressable onPress={() => router.back()} style={s.backBtn}>
        <Ionicons name="chevron-back" size={22} color={colors.muted} />
        <Text style={[s.backText, { color: colors.muted }]}>Back</Text>
      </Pressable>

      <View style={s.content}>
        <View style={s.iconRow}>
          <Ionicons name="shield-checkmark" size={48} color={colors.primary} />
        </View>
        <Text style={[s.title, { color: colors.foreground }]}>HOST ACCESS</Text>
        <Text style={[s.subtitle, { color: colors.muted }]}>
          Sign in to manage tonight's games
        </Text>

        {/* Mode tabs */}
        <View style={[s.tabs, { borderColor: colors.border }]}>
          <TouchableOpacity
            style={[s.tab, mode === 'email' && { backgroundColor: colors.primary }]}
            onPress={() => { setMode('email'); setError(''); }}
          >
            <Text style={[s.tabText, { color: mode === 'email' ? '#fff' : colors.muted }]}>
              Email
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tab, mode === 'code' && { backgroundColor: colors.primary }]}
            onPress={() => { setMode('code'); setError(''); }}
          >
            <Text style={[s.tabText, { color: mode === 'code' ? '#fff' : colors.muted }]}>
              Access Code
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {mode === 'email' ? (
            <>
              <Text style={[s.label, { color: colors.muted }]}>EMAIL</Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]}
                value={email}
                onChangeText={(t) => { setEmail(t); setError(''); }}
                placeholder="you@example.com"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                autoComplete="email"
                returnKeyType="next"
              />
              <Text style={[s.label, { color: colors.muted, marginTop: 4 }]}>PASSWORD</Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]}
                value={password}
                onChangeText={(t) => { setPassword(t); setError(''); }}
                placeholder="••••••••"
                placeholderTextColor={colors.muted}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="go"
                onSubmitEditing={handleEmailLogin}
              />
              {!!error && (
                <View style={s.errorRow}>
                  <Ionicons name="alert-circle" size={14} color={colors.destructive} />
                  <Text style={[s.errorText, { color: colors.destructive }]}>{error}</Text>
                </View>
              )}
              <Pressable
                style={({ pressed }) => [s.btn, { backgroundColor: colors.primary, opacity: pressed || pending ? 0.8 : 1 }]}
                onPress={handleEmailLogin}
                disabled={pending}
              >
                {pending ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>SIGN IN</Text>}
              </Pressable>

              <TouchableOpacity onPress={() => router.push('/admin-forgot-password')} style={s.textLink}>
                <Text style={[s.textLinkText, { color: colors.primary }]}>Forgot password?</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={[s.label, { color: colors.muted }]}>ADMIN CODE</Text>
              <TextInput
                style={[s.codeInput, {
                  backgroundColor: colors.background,
                  color: colors.foreground,
                  borderColor: error ? colors.destructive : colors.border,
                }]}
                value={code}
                onChangeText={(t) => { setCode(t); setError(''); }}
                placeholder="ENTER CODE"
                placeholderTextColor={colors.muted}
                autoCapitalize="characters"
                autoCorrect={false}
                autoComplete="off"
                returnKeyType="go"
                onSubmitEditing={handleCodeLogin}
              />
              {!!error && (
                <View style={s.errorRow}>
                  <Ionicons name="alert-circle" size={14} color={colors.destructive} />
                  <Text style={[s.errorText, { color: colors.destructive }]}>{error}</Text>
                </View>
              )}
              <Pressable
                style={({ pressed }) => [s.btn, { backgroundColor: colors.primary, opacity: pressed || pending ? 0.8 : 1 }]}
                onPress={handleCodeLogin}
                disabled={pending}
              >
                {pending ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>UNLOCK DASHBOARD</Text>}
              </Pressable>
            </>
          )}
        </View>

        {mode === 'email' && (
          <TouchableOpacity onPress={() => router.push('/admin-register')} style={s.footerLink}>
            <Text style={[s.footerText, { color: colors.muted }]}>
              New here?{' '}
              <Text style={{ color: colors.secondary }}>Create an account →</Text>
            </Text>
          </TouchableOpacity>
        )}

        {mode === 'code' && (
          <Text style={[s.hint2, { color: colors.muted }]}>
            If you registered with email, use the Email tab for game-scoped access.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    container: { paddingHorizontal: 24, flexGrow: 1 },
    blob: { position: 'absolute', width: 220, height: 220, borderRadius: 110, top: 60, left: -80, opacity: 0.12 },
    blob2: { position: 'absolute', width: 180, height: 180, borderRadius: 90, bottom: 120, right: -60, opacity: 0.10 },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 24 },
    backText: { fontSize: 15 },
    content: { flex: 1, justifyContent: 'center' },
    iconRow: { alignItems: 'center', marginBottom: 16 },
    title: { fontSize: 32, fontFamily: 'Manrope_800ExtraBold', textAlign: 'center', letterSpacing: 2 },
    subtitle: { fontSize: 14, textAlign: 'center', marginTop: 8, marginBottom: 24 },
    tabs: {
      flexDirection: 'row', borderWidth: 1, borderRadius: 12, overflow: 'hidden', marginBottom: 16,
    },
    tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 11 },
    tabText: { fontSize: 14, fontFamily: 'Manrope_700Bold' },
    card: { borderRadius: 16, borderWidth: 1, padding: 24, gap: 12 },
    label: { fontSize: 11, fontFamily: 'Manrope_700Bold', letterSpacing: 2 },
    input: {
      borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
      fontSize: 15, fontFamily: 'Manrope_600SemiBold',
    },
    codeInput: {
      borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
      fontSize: 22, textAlign: 'center', letterSpacing: 6, fontFamily: 'Manrope_700Bold',
    },
    errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    errorText: { fontSize: 13 },
    btn: { borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
    btnText: { color: '#fff', fontSize: 16, fontFamily: 'Manrope_800ExtraBold', letterSpacing: 1 },
    hint2: { fontSize: 12, textAlign: 'center', marginTop: 16, lineHeight: 18 },
    textLink: { alignItems: 'center', paddingVertical: 4 },
    textLinkText: { fontSize: 13 },
    footerLink: { marginTop: 20, alignItems: 'center' },
    footerText: { fontSize: 14, textAlign: 'center' },
  });
