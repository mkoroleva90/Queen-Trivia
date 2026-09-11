/**
 * Account screen — host account management, reached from the person icon in
 * the admin header. Mirrors the web Account page (AdminSettings.tsx) card for
 * card: display name, change password (accounts with a password only),
 * sign out, danger zone (delete account with confirmation), legal links.
 */
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
  View,
} from 'react-native';
import { Text } from '@/components/ThemedText';
import { TextInput } from '@/components/ThemedTextInput';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getItem, setItem } from '@/lib/storage';
import { ADMIN_TOKEN_KEY, useAdminAuth } from '@/context/AdminAuthContext';
import { API_BASE_URL } from '@/lib/apiBase';
import { useColors } from '@/hooks/useColors';
import { COPY } from '@workspace/copy';

const PRIVACY_URL = 'https://queen-trivia.com/privacy';
const TERMS_URL   = 'https://queen-trivia.com/terms';
const SUPPORT_URL = 'https://queen-trivia.com/support';

// ─────────────────────────────────────────────────────────────────────────────

async function adminFetch(url: string, options?: RequestInit) {
  const token = await getItem(ADMIN_TOKEN_KEY).catch(() => null);
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });
}

export default function AdminAccountScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { logoutAdmin } = useAdminAuth();

  // Profile — decides whether the change-password card is shown
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);

  // Display name state
  const [displayName, setDisplayName]         = useState('');
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [dnLoading, setDnLoading]             = useState(true);
  const [dnSaving, setDnSaving]               = useState(false);
  const [dnError, setDnError]                 = useState('');
  const [dnSuccess, setDnSuccess]             = useState('');

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

  // Sign out / delete state
  const [signingOut, setSigningOut] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [globalError, setGlobalError] = useState('');

  const baseUrl = API_BASE_URL;
  const dn = COPY.account.displayName;

  // Fetch profile + current display name on mount
  useEffect(() => {
    (async () => {
      try {
        const r    = await adminFetch(`${baseUrl}/api/account/profile`);
        const data = (await r.json()) as { hasPassword?: boolean };
        setHasPassword(data.hasPassword === true);
      } catch {
        // non-fatal — keep the password card hidden until we know
        setHasPassword(false);
      }
    })();
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
    if (!pwCurrent) { setPwError(COPY.account.changePassword.errorCurrentRequired); return; }
    if (pwNew.length < 8) { setPwError(COPY.account.changePassword.errorTooShort); return; }
    if (pwNew !== pwConfirm) { setPwError(COPY.account.changePassword.errorNoMatch); return; }
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
        await setItem(ADMIN_TOKEN_KEY, json.newAdminToken).catch(() => null);
      }
      setPwCurrent('');
      setPwNew('');
      setPwConfirm('');
      setPwSuccess(json.message ?? COPY.account.changePassword.success);
    } catch {
      setPwError(COPY.account.connectionError);
    } finally {
      setPwSaving(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await logoutAdmin();
      router.replace('/admin-login');
    } finally {
      setSigningOut(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      COPY.account.deleteAccount.confirmTitle,
      `${COPY.account.deleteAccount.confirmBody}\n\n${COPY.account.deleteAccount.confirmQuestion}`,
      [
        { text: COPY.account.deleteAccount.confirmCancel, style: 'cancel' },
        { text: COPY.account.deleteAccount.confirmAction, style: 'destructive', onPress: confirmDeleteAccount },
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
        setGlobalError(body.error ?? COPY.account.deleteAccount.failed);
        return;
      }
      await logoutAdmin();
      router.replace('/admin-login');
    } catch {
      setGlobalError(COPY.account.connectionError);
    } finally {
      setDeleting(false);
    }
  };

  const s = styles(colors);

  return (
    <KeyboardAvoidingView
      style={[s.container, { backgroundColor: colors.background, paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.backBtn} accessibilityRole="button" accessibilityLabel={COPY.common.back}>
          <Ionicons name="chevron-back" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[s.headerTitle, { color: colors.foreground }]}>{COPY.nav.rooms}</Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[s.subtitle, { color: colors.mutedForeground }]}>{COPY.account.subtitle}</Text>

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

        {/* Change password card — accounts with a password only */}
        {hasPassword && (
          <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={s.sectionHeader}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.primary} />
              <Text style={[s.sectionTitle, { color: colors.foreground }]}>{COPY.account.changePassword.sectionTitle}</Text>
            </View>
            <Text style={[s.sectionDesc, { color: colors.mutedForeground }]}>
              {COPY.account.changePassword.description}
            </Text>

            {/* Current password */}
            <View style={s.fieldGroup}>
              <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>{COPY.account.changePassword.currentLabel}</Text>
              <View style={s.pwRow}>
                <TextInput
                  style={[s.input, s.pwInput, {
                    backgroundColor: colors.background,
                    color: colors.foreground,
                    borderColor: colors.border,
                  }]}
                  value={pwCurrent}
                  onChangeText={(v) => { setPwCurrent(v); setPwError(''); setPwSuccess(''); }}
                  placeholder={COPY.account.changePassword.currentPlaceholder}
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
              <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>{COPY.account.changePassword.newLabel}</Text>
              <View style={s.pwRow}>
                <TextInput
                  style={[s.input, s.pwInput, {
                    backgroundColor: colors.background,
                    color: colors.foreground,
                    borderColor: colors.border,
                  }]}
                  value={pwNew}
                  onChangeText={(v) => { setPwNew(v); setPwError(''); setPwSuccess(''); }}
                  placeholder={COPY.account.changePassword.newPlaceholder}
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
              <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>{COPY.account.changePassword.confirmLabel}</Text>
              <View style={s.pwRow}>
                <TextInput
                  style={[s.input, s.pwInput, {
                    backgroundColor: colors.background,
                    color: colors.foreground,
                    borderColor: pwConfirm && pwConfirm !== pwNew ? colors.destructive : colors.border,
                  }]}
                  value={pwConfirm}
                  onChangeText={(v) => { setPwConfirm(v); setPwError(''); setPwSuccess(''); }}
                  placeholder={COPY.account.changePassword.confirmPlaceholder}
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
                <Text style={[s.fieldError, { color: colors.destructive }]}>{COPY.account.changePassword.mismatch}</Text>
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
                  <Text style={s.saveBtnText}>{COPY.account.changePassword.submitBtn}</Text>
                </>
              )}
            </Pressable>
          </View>
        )}

        {/* Sign out */}
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={s.sectionHeader}>
            <Ionicons name="log-out-outline" size={18} color={colors.primary} />
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>{COPY.account.signOut.sectionTitle}</Text>
          </View>
          <Text style={[s.sectionDesc, { color: colors.mutedForeground }]}>
            {COPY.account.signOut.description}
          </Text>
          <Pressable
            style={[s.outlineBtn, { borderColor: colors.primary, opacity: signingOut ? 0.7 : 1 }]}
            onPress={handleSignOut}
            disabled={signingOut}
          >
            {signingOut ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <Ionicons name="log-out-outline" size={18} color={colors.primary} />
                <Text style={[s.outlineBtnText, { color: colors.primary }]}>{COPY.account.signOut.btn}</Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Danger zone */}
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.destructive + '40' }]}>
          <View style={s.sectionHeader}>
            <Ionicons name="warning-outline" size={18} color={colors.destructive} />
            <Text style={[s.sectionTitle, { color: colors.destructive }]}>{COPY.heading.dangerZone}</Text>
          </View>
          <Text style={[s.sectionDesc, { color: colors.mutedForeground }]}>
            {COPY.account.dangerZoneBody}
          </Text>
          {!!globalError && (
            <View style={[s.msgRow, { backgroundColor: colors.destructive + '15', borderColor: colors.destructive + '30' }]}>
              <Ionicons name="alert-circle" size={16} color={colors.destructive} />
              <Text style={[s.msgText, { color: colors.destructive }]}>{globalError}</Text>
            </View>
          )}
          <Pressable
            style={[s.outlineBtn, { borderColor: colors.destructive, opacity: deleting ? 0.7 : 1 }]}
            onPress={handleDeleteAccount}
            disabled={deleting}
          >
            {deleting ? (
              <ActivityIndicator color={colors.destructive} />
            ) : (
              <>
                <Ionicons name="trash-outline" size={18} color={colors.destructive} />
                <Text style={[s.outlineBtnText, { color: colors.destructive }]}>{COPY.btn.deleteAccount}</Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Legal */}
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={s.sectionHeader}>
            <Ionicons name="document-text-outline" size={18} color={colors.primary} />
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>{COPY.account.legalTitle}</Text>
          </View>
          <Pressable style={s.legalRow} onPress={() => Linking.openURL(PRIVACY_URL)}>
            <Text style={[s.legalLink, { color: colors.primary }]}>{COPY.footer.privacyPolicy}</Text>
            <Ionicons name="open-outline" size={15} color={colors.primary} />
          </Pressable>
          <View style={[s.legalDivider, { backgroundColor: colors.border }]} />
          <Pressable style={s.legalRow} onPress={() => Linking.openURL(TERMS_URL)}>
            <Text style={[s.legalLink, { color: colors.primary }]}>{COPY.footer.termsOfService}</Text>
            <Ionicons name="open-outline" size={15} color={colors.primary} />
          </Pressable>
          <View style={[s.legalDivider, { backgroundColor: colors.border }]} />
          <Pressable style={s.legalRow} onPress={() => Linking.openURL(SUPPORT_URL)}>
            <Text style={[s.legalLink, { color: colors.primary }]}>{COPY.footer.support}</Text>
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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    headerTitle: { fontSize: 17, fontFamily: 'Manrope_700Bold' },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    body: { paddingHorizontal: 16, paddingTop: 16, gap: 16 },
    subtitle: { fontSize: 13, lineHeight: 19, marginTop: -4 },
    card: { borderRadius: 16, borderWidth: 1, padding: 20, gap: 12 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sectionTitle: { fontSize: 17, fontFamily: 'Manrope_700Bold' },
    sectionDesc: { fontSize: 13, lineHeight: 19 },
    fieldGroup: { gap: 6 },
    fieldLabel: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', letterSpacing: 0 },
    fieldError: { fontSize: 12, lineHeight: 17 },
    input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
    msgRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 1, borderRadius: 10, padding: 12 },
    msgText: { flex: 1, fontSize: 13, lineHeight: 18 },
    saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 14, marginTop: 4 },
    saveBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Manrope_700Bold' },
    outlineBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 14, borderWidth: 1.5 },
    outlineBtnText: { fontSize: 16, fontFamily: 'Manrope_700Bold' },
    legalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
    legalLink: { fontSize: 15, fontFamily: 'Manrope_600SemiBold' },
    legalDivider: { height: StyleSheet.hairlineWidth },
    pwRow: { flexDirection: 'row', alignItems: 'center' },
    pwInput: { flex: 1 },
    eyeBtn: { padding: 10, marginLeft: 4 },
  });
