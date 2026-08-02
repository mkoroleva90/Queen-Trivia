import React, { useState } from 'react';
import {
  ActivityIndicator,
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

export default function AdminForgotPasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  const baseUrl = process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
    : '';

  const handleSubmit = async () => {
    if (!email.trim()) { setError('Enter your email address'); return; }
    setError('');
    setPending(true);
    try {
      const res = await fetch(`${baseUrl}/api/auth/email/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      if (res.status === 503) {
        setError('Email service unavailable — try again later');
        return;
      }
      // Always show success to avoid account enumeration, same as the web app.
      setDone(true);
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
      <View style={[s.blob,  { backgroundColor: colors.primary }]} />
      <View style={[s.blob2, { backgroundColor: colors.secondary }]} />

      <Pressable onPress={() => router.back()} style={s.backBtn}>
        <Ionicons name="chevron-back" size={22} color={colors.mutedForeground} />
        <Text style={[s.backText, { color: colors.mutedForeground }]}>Back</Text>
      </Pressable>

      <View style={s.content}>
        <View style={s.iconRow}>
          <Ionicons name="lock-open" size={48} color={colors.primary} />
        </View>
        <Text style={[s.title, { color: colors.foreground }]}>FORGOT PASSWORD</Text>
        <Text style={[s.subtitle, { color: colors.mutedForeground }]}>
          Enter your email and we'll send a reset link
        </Text>

        {done ? (
          <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={s.successIcon}>
              <Ionicons name="mail" size={36} color={colors.primary} />
            </View>
            <Text style={[s.successTitle, { color: colors.foreground }]}>Check your inbox</Text>
            <Text style={[s.successBody, { color: colors.mutedForeground }]}>
              If that address is registered, a reset link is on its way.
            </Text>
            <Text style={[s.successBody, { color: colors.mutedForeground, marginTop: 4 }]}>
              Don't see it? Check your spam folder.
            </Text>
            <Pressable
              style={[s.btn, { backgroundColor: colors.primary }]}
              onPress={() => router.replace('/admin-login')}
            >
              <Text style={s.btnText}>BACK TO SIGN IN</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.label, { color: colors.mutedForeground }]}>EMAIL ADDRESS</Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]}
              value={email}
              onChangeText={(t) => { setEmail(t); setError(''); }}
              placeholder="you@example.com"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              returnKeyType="go"
              onSubmitEditing={handleSubmit}
            />

            {!!error && (
              <View style={s.errorRow}>
                <Ionicons name="alert-circle" size={14} color={colors.destructive} />
                <Text style={[s.errorText, { color: colors.destructive }]}>{error}</Text>
              </View>
            )}

            <Pressable
              style={({ pressed }) => [s.btn, { backgroundColor: colors.primary, opacity: pressed || pending ? 0.8 : 1 }]}
              onPress={handleSubmit}
              disabled={pending}
            >
              {pending
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnText}>SEND RESET LINK</Text>}
            </Pressable>
          </View>
        )}

        <Pressable onPress={() => router.replace('/admin-login')} style={s.footerLink}>
          <Text style={[s.footerText, { color: colors.mutedForeground }]}>
            Remembered it?{' '}
            <Text style={{ color: colors.primary }}>Sign in →</Text>
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    container: { paddingHorizontal: 24, flexGrow: 1 },
    blob:  { position: 'absolute', width: 220, height: 220, borderRadius: 110, top: 60,    left: -80,  opacity: 0.12 },
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
    errorRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
    errorText: { fontSize: 13 },
    btn:     { borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
    btnText: { color: '#fff', fontSize: 16, fontFamily: 'Manrope_800ExtraBold', letterSpacing: 1 },
    successIcon:  { alignItems: 'center', marginBottom: 8 },
    successTitle: { fontSize: 20, fontFamily: 'Manrope_800ExtraBold', textAlign: 'center' },
    successBody:  { fontSize: 14, textAlign: 'center', lineHeight: 20 },
    footerLink: { marginTop: 20, alignItems: 'center' },
    footerText: { fontSize: 14, textAlign: 'center' },
  });
