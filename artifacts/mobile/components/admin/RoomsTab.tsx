import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const PRIVACY_URL = 'https://queen-trivia.com/privacy';
const TERMS_URL   = 'https://queen-trivia.com/terms';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { ADMIN_TOKEN_KEY, useAdminAuth } from '@/context/AdminAuthContext';
import { API_BASE_URL } from '@/lib/apiBase';
import { useColors } from '@/hooks/useColors';

// ── Validation helpers (mirror of server rules in accessCodeValidation.ts) ────

const ADMIN_COMMON = new Set([
  'password','passw0rd','letmein','welcome','monkey','dragon','master',
  'iloveyou','sunshine','princess','football','shadow','superman','batman',
  'qwerty','qwerty123','abc123','abcdef','trustno1','access','admin','changeme',
]);
const KBD_ROWS = ['qwertyuiop','asdfghjkl','zxcvbnm','1234567890',
  'poiuytrewq','lkjhgfdsa','mnbvcxz','0987654321'];

function adminCodeError(code: string): string | null {
  if (code.length < 12) return 'Admin access code must be at least 12 characters.';
  if (code.length > 64) return 'Admin access code must be at most 64 characters.';
  const s = code.toLowerCase().replace(/\s+/g, '');
  if (ADMIN_COMMON.has(s)) return 'Admin access code is too common. Choose a less predictable passphrase.';
  for (let i = 0; i <= s.length - 4; i++) {
    let asc = true, dsc = true;
    for (let j = 1; j < 4; j++) {
      const d = s.charCodeAt(i + j) - s.charCodeAt(i + j - 1);
      if (d !== 1) asc = false; if (d !== -1) dsc = false;
    }
    if (asc || dsc) return 'Admin access code contains a sequential run (e.g. "abcd" or "1234"). Choose something less predictable.';
  }
  for (let i = 0; i <= s.length - 3; i++) {
    if (s[i] === s[i + 1] && s[i] === s[i + 2]) return 'Admin access code contains repeated characters (e.g. "aaa"). Choose something less predictable.';
  }
  for (const row of KBD_ROWS) {
    for (let i = 0; i <= s.length - 4; i++) {
      if (row.includes(s.slice(i, i + 4))) return 'Admin access code follows a keyboard pattern (e.g. "qwerty"). Choose something less predictable.';
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────

type Settings = { adminCodeIsSet: boolean };

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

type Props = { bottomPadding: number };

/**
 * Rooms tab — admin access code management + account danger zone.
 */
export function RoomsTab({ bottomPadding }: Props) {
  const colors = useColors();
  const router = useRouter();
  const { logoutAdmin } = useAdminAuth();

  const [adminCode, setAdminCode] = useState('');
  const [adminCodeIsSet, setAdminCodeIsSet] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [success, setSuccess] = useState('');

  // Per-field computed validation
  const adminErr = adminCode.trim() ? adminCodeError(adminCode) : null;
  const isInvalid = !!adminErr;
  const unchanged = adminCode.trim() === '';

  const baseUrl = API_BASE_URL;

  useEffect(() => {
    (async () => {
      setLoading(true);
      setGlobalError('');
      try {
        const r = await adminFetch(`${baseUrl}/api/settings`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = (await r.json()) as Settings;
        setAdminCodeIsSet(data.adminCodeIsSet);
      } catch {
        setGlobalError('Could not load settings. Check your connection and try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    if (isInvalid || unchanged) return;
    setGlobalError('');
    setSuccess('');
    setSaving(true);
    const body: Record<string, string> = {};
    if (adminCode.trim()) body.adminAccessCode = adminCode;
    try {
      const r = await adminFetch(`${baseUrl}/api/settings`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const json = await r.json().catch(() => ({})) as { error?: string };
        throw new Error(json.error ?? `HTTP ${r.status}`);
      }
      const updated = (await r.json()) as { adminCodeIsSet: boolean };
      if (updated.adminCodeIsSet) setAdminCodeIsSet(true);
      setAdminCode(''); // clear after save — hash is never displayed
      setSuccess('Settings saved successfully.');
    } catch (e) {
      setGlobalError(e instanceof Error ? e.message : 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete account',
      'This will permanently delete your account and all your games. This cannot be undone.\n\nAre you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete my account', style: 'destructive', onPress: confirmDeleteAccount },
      ],
    );
  };

  const confirmDeleteAccount = async () => {
    setDeleting(true);
    setGlobalError('');
    try {
      const r = await adminFetch(`${baseUrl}/api/auth/email/account`, { method: 'DELETE' });
      if (!r.ok) {
        const body = await r.json().catch(() => ({})) as { error?: string };
        setGlobalError(body.error ?? 'Failed to delete account. Please try again.');
        return;
      }
      await logoutAdmin();
      router.replace('/admin-login');
    } catch {
      setGlobalError('Connection error — please retry.');
    } finally {
      setDeleting(false);
    }
  };

  const s = styles(colors);

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: colors.background, paddingBottom: bottomPadding }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[s.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[s.body, { paddingBottom: bottomPadding + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Admin access code card */}
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={s.sectionHeader}>
            <Ionicons name="key-outline" size={18} color={colors.primary} />
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>Admin access code</Text>
          </View>
          <Text style={[s.sectionDesc, { color: colors.mutedForeground }]}>
            The admin access code is stored encrypted and never shown — enter a new value to change it.
          </Text>

          {/* Admin access code */}
          <View style={s.fieldGroup}>
            <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Admin access code</Text>
            <Text style={[s.fieldHelper, { color: colors.mutedForeground }]}>
              {adminCodeIsSet
                ? 'A code is set. Leave blank to keep it, or enter a new passphrase (12–64 chars) to replace it.'
                : 'No code set. Enter a passphrase (12–64 characters). Spaces are allowed.'}
            </Text>
            <TextInput
              style={[s.input, {
                backgroundColor: colors.background,
                color: colors.foreground,
                borderColor: adminErr ? colors.destructive : colors.border,
              }]}
              value={adminCode}
              onChangeText={(v) => { setAdminCode(v); setGlobalError(''); setSuccess(''); }}
              placeholder={adminCodeIsSet ? 'Leave blank to keep existing code' : 'Enter new admin access code'}
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
            {!!adminErr && (
              <Text style={[s.fieldError, { color: colors.destructive }]}>{adminErr}</Text>
            )}
          </View>

          {/* Global success / error messages */}
          {!!globalError && (
            <View style={[s.msgRow, { backgroundColor: colors.destructive + '15', borderColor: colors.destructive + '30' }]}>
              <Ionicons name="alert-circle" size={16} color={colors.destructive} />
              <Text style={[s.msgText, { color: colors.destructive }]}>{globalError}</Text>
            </View>
          )}
          {!!success && (
            <View style={[s.msgRow, { backgroundColor: colors.secondary + '15', borderColor: colors.secondary + '30' }]}>
              <Ionicons name="checkmark-circle" size={16} color={colors.secondary} />
              <Text style={[s.msgText, { color: colors.secondary }]}>{success}</Text>
            </View>
          )}

          <Pressable
            style={[s.saveBtn, {
              backgroundColor: colors.primary,
              opacity: (saving || isInvalid || unchanged) ? 0.45 : 1,
            }]}
            onPress={handleSave}
            disabled={saving || isInvalid || unchanged}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color="#fff" />
                <Text style={s.saveBtnText}>Save changes</Text>
              </>
            )}
          </Pressable>
          {unchanged && !isInvalid && (
            <Text style={[s.noChanges, { color: colors.mutedForeground }]}>Enter a new passphrase to update.</Text>
          )}
        </View>

        {/* Danger zone */}
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.destructive + '40' }]}>
          <View style={s.sectionHeader}>
            <Ionicons name="warning-outline" size={18} color={colors.destructive} />
            <Text style={[s.sectionTitle, { color: colors.destructive }]}>Danger zone</Text>
          </View>
          <Text style={[s.sectionDesc, { color: colors.mutedForeground }]}>
            Deleting your account is permanent and cannot be undone. Your account and all associated games will be removed immediately.
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
                <Text style={[s.deleteBtnText, { color: colors.destructive }]}>Delete account</Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Legal */}
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={s.sectionHeader}>
            <Ionicons name="document-text-outline" size={18} color={colors.primary} />
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>Legal</Text>
          </View>
          <Pressable
            style={s.legalRow}
            onPress={() => Linking.openURL(PRIVACY_URL)}
          >
            <Text style={[s.legalLink, { color: colors.primary }]}>Privacy Policy</Text>
            <Ionicons name="open-outline" size={15} color={colors.primary} />
          </Pressable>
          <View style={[s.legalDivider, { backgroundColor: colors.border }]} />
          <Pressable
            style={s.legalRow}
            onPress={() => Linking.openURL(TERMS_URL)}
          >
            <Text style={[s.legalLink, { color: colors.primary }]}>Terms of Service</Text>
            <Ionicons name="open-outline" size={15} color={colors.primary} />
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    body: { paddingHorizontal: 16, paddingTop: 16, gap: 16 },
    card: { borderRadius: 16, borderWidth: 1, padding: 20, gap: 12 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sectionTitle: { fontSize: 17, fontFamily: 'Manrope_700Bold' },
    sectionDesc: { fontSize: 13, lineHeight: 19 },
    fieldGroup: { gap: 6 },
    fieldLabel: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', letterSpacing: 0 },
    fieldHelper: { fontSize: 11.5, lineHeight: 16 },
    fieldError: { fontSize: 12, lineHeight: 17 },
    input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
    msgRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 1, borderRadius: 10, padding: 12 },
    msgText: { flex: 1, fontSize: 13, lineHeight: 18 },
    noChanges: { textAlign: 'center', fontSize: 12 },
    saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 14, marginTop: 4 },
    saveBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Manrope_700Bold' },
    deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 14, borderWidth: 1.5 },
    deleteBtnText: { fontSize: 16, fontFamily: 'Manrope_700Bold' },
    legalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
    legalLink: { fontSize: 15, fontFamily: 'Manrope_600SemiBold' },
    legalDivider: { height: StyleSheet.hairlineWidth },
  });
