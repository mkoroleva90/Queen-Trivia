/**
 * Host account registration — open self-service signup.
 * No existing admin session required.
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
import { useColors } from '@/hooks/useColors';
import { API_BASE_URL } from '@/lib/apiBase';

export default function AdminRegisterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  const baseUrl = API_BASE_URL;

  const handleSubmit = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) { setError('Enter your email address'); return; }
    if (!password) { setError('Enter a password'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setError('');
    setPending(true);
    try {
      const res = await fetch(`${baseUrl}/api/auth/email/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, password }),
      });
      if (res.status === 503) {
        setError('Email service unavailable — try again later');
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setError(body.error ?? 'Something went wrong — please retry');
        return;
      }
      setDone(true);
    } catch {
      setError('Connection error — please retry');
    } finally {
      setPending(false);
    }
  };

  const s = styles(colors);

  if (done) {
    return (
      <View style={[s.doneContainer, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <View style={[s.doneCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="mail" size={48} color={colors.primary} style={{ alignSelf: 'center' }} />
          <Text style={[s.doneTitle, { color: colors.foreground }]}>Check your inbox</Text>
          <Text style={[s.doneBody, { color: colors.mutedForeground }]}>
            We sent a verification link to{' '}
            <Text style={{ color: colors.foreground }}>{email}</Text>.
            {'\n\n'}Click the link to activate your account, then sign in.
          </Text>
          <Pressable
            style={[s.btn, { backgroundColor: colors.primary }]}
            onPress={() => router.replace('/admin-login')}
          >
            <Text style={s.btnText}>GO TO SIGN IN</Text>
          </Pressable>
        </View>
      </View>
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
          <Text style={[s.backText, { color: colors.mutedForeground }]}>Back</Text>
        </Pressable>

        <View style={s.content}>
          <View style={s.iconRow}>
            <Ionicons name="person-add" size={48} color={colors.primary} />
          </View>
          <Text style={[s.title, { color: colors.foreground }]}>CREATE ACCOUNT</Text>
          <Text style={[s.subtitle, { color: colors.mutedForeground }]}>
            Register as a host to create and manage trivia games
          </Text>

          <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.label, { color: colors.mutedForeground }]}>EMAIL</Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: error ? colors.destructive : colors.border }]}
              value={email}
              onChangeText={(t) => { setEmail(t); setError(''); }}
              placeholder="your@email.com"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />

            <Text style={[s.label, { color: colors.mutedForeground }]}>PASSWORD</Text>
            <View style={s.passwordRow}>
              <TextInput
                style={[s.input, s.passwordInput, { backgroundColor: colors.background, color: colors.foreground, borderColor: error ? colors.destructive : colors.border }]}
                value={password}
                onChangeText={(t) => { setPassword(t); setError(''); }}
                placeholder="At least 8 characters"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                returnKeyType="next"
              />
              <Pressable style={s.eyeBtn} onPress={() => setShowPassword(v => !v)} hitSlop={8}>
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>

            <Text style={[s.label, { color: colors.mutedForeground }]}>CONFIRM PASSWORD</Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: error ? colors.destructive : colors.border }]}
              value={confirm}
              onChangeText={(t) => { setConfirm(t); setError(''); }}
              placeholder="Repeat your password"
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
              By creating an account you agree to our{' '}
              <Text style={{ color: colors.primary }} onPress={() => router.push('/terms')}>
                Terms of Service
              </Text>
              {' '}and{' '}
              <Text style={{ color: colors.primary }} onPress={() => router.push('/privacy')}>
                Privacy Policy
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
                : <Text style={s.btnText}>CREATE ACCOUNT</Text>}
            </Pressable>
          </View>

          <Pressable onPress={() => router.replace('/admin-login')} style={s.footerLink}>
            <Text style={[s.footerText, { color: colors.mutedForeground }]}>
              Already have an account?{' '}
              <Text style={{ color: colors.primary }}>Sign in →</Text>
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
    doneContainer: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 24, justifyContent: 'center' },
    doneCard:      { borderRadius: 20, borderWidth: 1, padding: 28, gap: 16 },
    doneTitle:     { fontSize: 22, fontFamily: 'Manrope_800ExtraBold', textAlign: 'center' },
    doneBody:      { fontSize: 14, lineHeight: 21, textAlign: 'center' },
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
    passwordRow:  { position: 'relative' },
    passwordInput: { paddingRight: 48 },
    eyeBtn:       { position: 'absolute', right: 14, top: 14 },
    errorRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
    errorText:    { flex: 1, fontSize: 13, lineHeight: 18 },
    btn:          { borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
    btnText:      { color: '#fff', fontSize: 16, fontFamily: 'Manrope_800ExtraBold', letterSpacing: 1 },
    footerLink:   { marginTop: 24, alignItems: 'center' },
    footerText:   { fontSize: 14, textAlign: 'center' },
    legalText:    { fontSize: 12, textAlign: 'center', lineHeight: 18 },
  });
