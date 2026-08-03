import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import * as SecureStore from 'expo-secure-store';
import { ADMIN_TOKEN_KEY, useAdminAuth } from '@/context/AdminAuthContext';
import { useColors } from '@/hooks/useColors';

type Settings = {
  triviaAccessCode: string;
  adminAccessCode: string;
};

async function adminFetch(url: string, options?: RequestInit) {
  const token = await SecureStore.getItemAsync(ADMIN_TOKEN_KEY).catch(() => null);
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { logoutAdmin } = useAdminAuth();

  const [triviaCode, setTriviaCode] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const baseUrl = process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
    : '';

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        const r = await adminFetch(`${baseUrl}/api/settings`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = (await r.json()) as Settings;
        setTriviaCode(data.triviaAccessCode);
        setAdminCode(data.adminAccessCode);
      } catch {
        setError('Could not load settings. Check your connection and try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    setError('');
    setSuccess('');
    const t = triviaCode.trim();
    const a = adminCode.trim();
    if (t.length < 8) { setError('Trivia access code must be at least 8 characters'); return; }
    if (a.length < 8) { setError('Admin access code must be at least 8 characters'); return; }
    if (t === a) { setError('Trivia and admin codes must be different'); return; }
    setSaving(true);
    try {
      const r = await adminFetch(`${baseUrl}/api/settings`, {
        method: 'PATCH',
        body: JSON.stringify({ triviaAccessCode: t, adminAccessCode: a }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${r.status}`);
      }
      setSuccess('Settings saved successfully.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your games. This cannot be undone.\n\nAre you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: confirmDeleteAccount,
        },
      ],
    );
  };

  const confirmDeleteAccount = async () => {
    setDeleting(true);
    setError('');
    try {
      const r = await adminFetch(`${baseUrl}/api/auth/email/account`, {
        method: 'DELETE',
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({})) as { error?: string };
        setError(body.error ?? 'Failed to delete account. Please try again.');
        return;
      }
      await logoutAdmin();
      router.replace('/admin-login');
    } catch {
      setError('Connection error — please retry.');
    } finally {
      setDeleting(false);
    }
  };

  const s = styles(colors);

  return (
    <KeyboardAvoidingView
      style={[s.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[s.headerTitle, { color: colors.foreground }]}>Settings</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          {/* Access Codes */}
          <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={s.sectionHeader}>
              <Ionicons name="key-outline" size={18} color={colors.primary} />
              <Text style={[s.sectionTitle, { color: colors.foreground }]}>Access Codes</Text>
            </View>
            <Text style={[s.sectionDesc, { color: colors.mutedForeground }]}>
              Players use the trivia code to join games. The admin code is your login password.
              Both must be at least 8 characters and must differ from each other.
            </Text>

            <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>TRIVIA ACCESS CODE</Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]}
              value={triviaCode}
              onChangeText={(v) => { setTriviaCode(v); setError(''); setSuccess(''); }}
              placeholder="Minimum 8 characters"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>ADMIN ACCESS CODE</Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]}
              value={adminCode}
              onChangeText={(v) => { setAdminCode(v); setError(''); setSuccess(''); }}
              placeholder="Minimum 8 characters"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {!!error && (
              <View style={[s.msgRow, { backgroundColor: colors.destructive + '15', borderColor: colors.destructive + '30' }]}>
                <Ionicons name="alert-circle" size={16} color={colors.destructive} />
                <Text style={[s.msgText, { color: colors.destructive }]}>{error}</Text>
              </View>
            )}
            {!!success && (
              <View style={[s.msgRow, { backgroundColor: colors.secondary + '15', borderColor: colors.secondary + '30' }]}>
                <Ionicons name="checkmark-circle" size={16} color={colors.secondary} />
                <Text style={[s.msgText, { color: colors.secondary }]}>{success}</Text>
              </View>
            )}

            <Pressable
              style={[s.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={18} color="#fff" />
                  <Text style={s.saveBtnText}>Save Changes</Text>
                </>
              )}
            </Pressable>
          </View>

          {/* Danger Zone */}
          <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.destructive + '40' }]}>
            <View style={s.sectionHeader}>
              <Ionicons name="warning-outline" size={18} color={colors.destructive} />
              <Text style={[s.sectionTitle, { color: colors.destructive }]}>Danger Zone</Text>
            </View>
            <Text style={[s.sectionDesc, { color: colors.mutedForeground }]}>
              Deleting your account is permanent and cannot be undone. Your account and all
              associated games will be removed immediately.
            </Text>

            <Pressable
              style={[s.deleteBtn, { borderColor: colors.destructive, opacity: deleting ? 0.7 : 1 }]}
              onPress={handleDeleteAccount}
              disabled={deleting}
            >
              {deleting ? (
                <ActivityIndicator color={colors.destructive} />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={18} color={colors.destructive} />
                  <Text style={[s.deleteBtnText, { color: colors.destructive }]}>Delete Account</Text>
                </>
              )}
            </Pressable>
          </View>

          <View style={{ height: insets.bottom + 24 }} />
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
    backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { flex: 1, fontSize: 18, fontFamily: 'Manrope_700Bold', textAlign: 'center' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    body: { paddingHorizontal: 16, paddingTop: 8, gap: 16 },
    card: { borderRadius: 16, borderWidth: 1, padding: 20, gap: 12 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sectionTitle: { fontSize: 17, fontFamily: 'Manrope_700Bold' },
    sectionDesc: { fontSize: 13, lineHeight: 19 },
    fieldLabel: { fontSize: 11, fontFamily: 'Manrope_700Bold', letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 4 },
    input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
    msgRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 1, borderRadius: 10, padding: 12 },
    msgText: { flex: 1, fontSize: 13, lineHeight: 18 },
    saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 14, marginTop: 4 },
    saveBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Manrope_700Bold' },
    deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 14, borderWidth: 1.5 },
    deleteBtnText: { fontSize: 16, fontFamily: 'Manrope_700Bold' },
  });
