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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { ADMIN_TOKEN_KEY, useAdminAuth } from '@/context/AdminAuthContext';
import { API_BASE_URL } from '@/lib/apiBase';
import { useColors } from '@/hooks/useColors';
import { COPY } from '@workspace/copy';

const PRIVACY_URL = 'https://queen-trivia.com/privacy';
const TERMS_URL   = 'https://queen-trivia.com/terms';

// ─────────────────────────────────────────────────────────────────────────────

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
 * Rooms tab — account management: change password, danger zone, legal.
 */
export function RoomsTab({ bottomPadding }: Props) {
  const colors = useColors();
  const router = useRouter();
  const { logoutAdmin } = useAdminAuth();

  // Display name state
  const [displayName, setDisplayName]         = useState('');
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [dnLoading, setDnLoading]             = useState(true);
  const [dnSaving, setDnSaving]               = useState(false);
  const [dnError, setDnError]                 = useState('');
  const [dnSuccess, setDnSuccess]             = useState('');

  const [deleting, setDeleting] = useState(false);
  const [globalError, setGlobalError] = useState('');

  // Change password state
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwShowCurrent, setPwShowCurrent] = useState(false);
  const [pwShowNew, setPwShowNew] = useState(false);
  const [pwShowConfirm, setPwShowConfirm] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  const baseUrl = API_BASE_URL;

  const dn = COPY.account.displayName;

  // Fetch current display name on mount
  useEffect(() => {
    (async () => {
      try {
        const r    = await adminFetch(`${baseUrl}/api/account/display-name`);
        const data = (await r.json()) as { displayName: string | null };
        const name = data.displayName ?? '';
        setDisplayName(name);
        setDisplayNameInput(name);
      } catch {
        // non-fatal — leave input empty
      } finally {
        setDnLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveDisplayName = async () => {
    setDnError('');
    setDnSuccess('');
    setDnSaving(true);
    try {
      const r    = await adminFetch(`${baseUrl}/api/account/display-name`, {
        method: 'PATCH',
        body:   JSON.stringify({ displayName: displayNameInput }),
      });
      const json = await r.json().catch(() => ({})) as { ok?: boolean; error?: string; message?: string; displayName?: string };
      if (!r.ok) {
        const msg =
          json.error === 'too_long'          ? dn.errorTooLong  :
          json.error === 'content_filtered'  ? dn.errorBlocked  :
          json.error === 'empty'             ? dn.errorEmpty     :
          dn.errorFailed;
        setDnError(msg);
        return;
      }
      const saved = json.displayName ?? displayNameInput.trim();
      setDisplayName(saved);
      setDisplayNameInput(saved);
      setDnSuccess(dn.saved);
    } catch {
      setDnError(dn.errorFailed);
    } finally {
      setDnSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPwError('');
    setPwSuccess('');
    if (!pwCurrent) { setPwError('Please enter your current password.'); return; }
    if (pwNew.length < 8) { setPwError('New password must be at least 8 characters.'); return; }
    if (pwNew !== pwConfirm) { setPwError('New passwords do not match.'); return; }
    setPwSaving(true);
    try {
      const r = await adminFetch(`${baseUrl}/api/auth/email/change-password`, {
        method: 'POST',
        body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew }),
      });
      const json = await r.json().catch(() => ({})) as { ok?: boolean; error?: string; message?: string; newAdminToken?: string };
      if (!r.ok) {
        setPwError(json.error ?? `HTTP ${r.status}`);
        return;
      }
      // Store the fresh token so the old (now-invalidated) one is replaced.
      if (json.newAdminToken) {
        await SecureStore.setItemAsync(ADMIN_TOKEN_KEY, json.newAdminToken).catch(() => null);
      }
      setPwCurrent('');
      setPwNew('');
      setPwConfirm('');
      setPwSuccess(json.message ?? 'Password changed successfully.');
    } catch {
      setPwError('Connection error — please retry.');
    } finally {
      setPwSaving(false);
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

  return (
    <KeyboardAvoidingView
      style={[s.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[s.body, { paddingBottom: bottomPadding + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Display name card */}
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={s.sectionHeader}>
            <Ionicons name="person-outline" size={18} color={colors.primary} />
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>{dn.sectionTitle}</Text>
          </View>
          <Text style={[s.sectionDesc, { color: colors.mutedForeground }]}>{dn.description}</Text>

          <View style={s.fieldGroup}>
            {dnLoading ? (
              <ActivityIndicator color={colors.primary} style={{ alignSelf: 'flex-start' }} />
            ) : (
              <TextInput
                style={[s.input, {
                  backgroundColor: colors.background,
                  color: colors.foreground,
                  borderColor: dnError ? colors.destructive : colors.border,
                }]}
                value={displayNameInput}
                onChangeText={(v) => { setDisplayNameInput(v); setDnError(''); setDnSuccess(''); }}
                placeholder={dn.placeholder}
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={64}
              />
            )}
            {!!dnError && (
              <Text style={[s.fieldError, { color: colors.destructive }]}>{dnError}</Text>
            )}
          </View>

          {/* Live leaderboard name preview */}
          <Text style={[s.sectionDesc, { color: colors.mutedForeground, marginTop: 2, marginBottom: 4 }]}>
            {dn.previewLabel + ' '}
            <Text style={{ color: colors.foreground, fontWeight: '600' }}>
              {displayNameInput.trim()
                ? `${displayNameInput.trim()}${COPY.hostName.suffix}`
                : COPY.hostName.generic}
            </Text>
          </Text>

          {!!dnSuccess && (
            <View style={[s.msgRow, { backgroundColor: colors.secondary + '15', borderColor: colors.secondary + '30' }]}>
              <Ionicons name="checkmark-circle" size={16} color={colors.secondary} />
              <Text style={[s.msgText, { color: colors.secondary }]}>{dnSuccess}</Text>
            </View>
          )}

          <Pressable
            style={[s.saveBtn, {
              backgroundColor: colors.primary,
              opacity: (dnSaving || dnLoading || displayNameInput.trim() === displayName) ? 0.45 : 1,
            }]}
            onPress={handleSaveDisplayName}
            disabled={dnSaving || dnLoading || displayNameInput.trim() === displayName}
          >
            {dnSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="person-outline" size={18} color="#fff" />
                <Text style={s.saveBtnText}>{dn.saveBtn}</Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Change password card */}
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={s.sectionHeader}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.primary} />
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>Change Password</Text>
          </View>
          <Text style={[s.sectionDesc, { color: colors.mutedForeground }]}>
            Enter your current password and choose a new one (at least 8 characters).
          </Text>

          {/* Current password */}
          <View style={s.fieldGroup}>
            <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Current password</Text>
            <View style={s.pwRow}>
              <TextInput
                style={[s.input, s.pwInput, {
                  backgroundColor: colors.background,
                  color: colors.foreground,
                  borderColor: colors.border,
                }]}
                value={pwCurrent}
                onChangeText={(v) => { setPwCurrent(v); setPwError(''); setPwSuccess(''); }}
                placeholder="Current password"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={!pwShowCurrent}
              />
              <Pressable onPress={() => setPwShowCurrent(v => !v)} style={s.eyeBtn}>
                <Ionicons name={pwShowCurrent ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>
          </View>

          {/* New password */}
          <View style={s.fieldGroup}>
            <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>New password</Text>
            <View style={s.pwRow}>
              <TextInput
                style={[s.input, s.pwInput, {
                  backgroundColor: colors.background,
                  color: colors.foreground,
                  borderColor: colors.border,
                }]}
                value={pwNew}
                onChangeText={(v) => { setPwNew(v); setPwError(''); setPwSuccess(''); }}
                placeholder="New password (min. 8 characters)"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={!pwShowNew}
              />
              <Pressable onPress={() => setPwShowNew(v => !v)} style={s.eyeBtn}>
                <Ionicons name={pwShowNew ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>
          </View>

          {/* Confirm new password */}
          <View style={s.fieldGroup}>
            <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Confirm new password</Text>
            <View style={s.pwRow}>
              <TextInput
                style={[s.input, s.pwInput, {
                  backgroundColor: colors.background,
                  color: colors.foreground,
                  borderColor: pwConfirm && pwConfirm !== pwNew ? colors.destructive : colors.border,
                }]}
                value={pwConfirm}
                onChangeText={(v) => { setPwConfirm(v); setPwError(''); setPwSuccess(''); }}
                placeholder="Confirm new password"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={!pwShowConfirm}
              />
              <Pressable onPress={() => setPwShowConfirm(v => !v)} style={s.eyeBtn}>
                <Ionicons name={pwShowConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>
            {!!pwConfirm && pwConfirm !== pwNew && (
              <Text style={[s.fieldError, { color: colors.destructive }]}>Passwords do not match.</Text>
            )}
          </View>

          {/* Inline error / success */}
          {!!pwError && (
            <View style={[s.msgRow, { backgroundColor: colors.destructive + '15', borderColor: colors.destructive + '30' }]}>
              <Ionicons name="alert-circle" size={16} color={colors.destructive} />
              <Text style={[s.msgText, { color: colors.destructive }]}>{pwError}</Text>
            </View>
          )}
          {!!pwSuccess && (
            <View style={[s.msgRow, { backgroundColor: colors.secondary + '15', borderColor: colors.secondary + '30' }]}>
              <Ionicons name="checkmark-circle" size={16} color={colors.secondary} />
              <Text style={[s.msgText, { color: colors.secondary }]}>{pwSuccess}</Text>
            </View>
          )}

          <Pressable
            style={[s.saveBtn, {
              backgroundColor: colors.primary,
              opacity: pwSaving ? 0.45 : 1,
            }]}
            onPress={handleChangePassword}
            disabled={pwSaving}
          >
            {pwSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="lock-closed-outline" size={18} color="#fff" />
                <Text style={s.saveBtnText}>Change Password</Text>
              </>
            )}
          </Pressable>
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
          {!!globalError && (
            <View style={[s.msgRow, { backgroundColor: colors.destructive + '15', borderColor: colors.destructive + '30' }]}>
              <Ionicons name="alert-circle" size={16} color={colors.destructive} />
              <Text style={[s.msgText, { color: colors.destructive }]}>{globalError}</Text>
            </View>
          )}
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
    pwRow: { flexDirection: 'row', alignItems: 'center' },
    pwInput: { flex: 1 },
    eyeBtn: { padding: 10, marginLeft: 4 },
  });
