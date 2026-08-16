import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
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
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useColors } from '@/hooks/useColors';
import { useAuth, PLAYER_TOKEN_KEY } from '@/context/AuthContext';
import { CrownMark } from '@/components/CrownMark';
import { API_BASE_URL } from '@/lib/apiBase';
import { COPY } from '@workspace/copy';

type Step = 0 | 1 | 2 | 3;

export default function WelcomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, authReady, loginUser } = useAuth();

  const [step, setStep] = useState<Step>(0);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [codeError, setCodeError] = useState('');
  const [nameError, setNameError] = useState('');
  const [pending, setPending] = useState(false);

  const slideAnim = useRef(new Animated.Value(0)).current;

  const baseUrl = API_BASE_URL;

  // Note: logged-in players stay on the home screen so they can enter a per-game code.

  const animateStep = (nextStep: Step) => {
    Animated.sequence([
      Animated.timing(slideAnim, { toValue: -20, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
    setStep(nextStep);
  };

  const goNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    animateStep((step + 1) as Step);
  };

  const goBack = () => {
    if (step === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    animateStep((step - 1) as Step);
  };

  const handleCodeSubmit = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) { setCodeError(COPY.join.error.enterCode); return; }
    setCodeError('');
    setPending(true);
    try {
      const res = await fetch(`${baseUrl}/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      });
      const data = (await res.json()) as { valid: boolean; role: string };
      if (!data.valid) { setCodeError(COPY.join.error.wrongCode); return; }
      if (data.role === 'admin') { setCodeError(COPY.join.error.adminCode); return; }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      animateStep(3);
    } catch {
      setCodeError(COPY.join.error.connectionError);
    } finally {
      setPending(false);
    }
  };

  const handleNameSubmit = async () => {
    const trimmedName = name.trim();
    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedName) { setNameError(COPY.join.error.enterName); return; }
    if (trimmedName.length > 50) { setNameError(COPY.join.error.nameTooLong); return; }
    setNameError('');
    setPending(true);
    try {
      // If the player already has a stored session token, send it as a Bearer
      // header. The server's "already-logged-in" path will restore their
      // existing user identity — preserving any prior answers and score —
      // rather than creating a duplicate participant record.
      const storedToken = await SecureStore.getItemAsync(PLAYER_TOKEN_KEY).catch(() => null);
      const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (storedToken) authHeaders['Authorization'] = `Bearer ${storedToken}`;

      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ code: trimmedCode, name: trimmedName }),
      });
      if (res.status === 401) { setCodeError(COPY.join.error.codeExpired); animateStep(2); return; }
      if (!res.ok) {
        const errBody = await res.json().catch(() => null) as { error?: string; code?: string } | null;
        if (errBody?.code === 'content_filtered' && errBody.error) {
          setNameError(errBody.error);
        } else {
          setNameError(COPY.join.error.somethingWrong);
        }
        return;
      }
      const userData = (await res.json()) as { id: number; name: string; gameId: number | null; mobileToken: string };
      await loginUser({ id: userData.id, name: userData.name }, userData.mobileToken);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (userData.gameId) {
        try {
          const joinRes = await fetch(`${baseUrl}/api/games/${userData.gameId}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userData.mobileToken}` },
            body: JSON.stringify({}),
          });
          if (joinRes.ok || joinRes.status === 409) {
            router.replace(`/game/${userData.gameId}`);
            return;
          }
        } catch { /* fall through to error */ }
      }
      // Per-game code always has a gameId — show an error if join failed
      setNameError(COPY.join.error.couldNotJoin);
      animateStep(2);
    } catch {
      setNameError(COPY.join.error.connectionError);
    } finally {
      setPending(false);
    }
  };

  if (!authReady) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
      {/* Ambient glow blobs */}
      <View style={[styles.blob, { top: 80, left: -60, backgroundColor: colors.primary }]} />
      <View style={[styles.blob2, { top: 300, right: -80, backgroundColor: colors.secondary }]} />

      {/* ── Progress dots ── */}
      <View style={styles.dotsRow}>
        {([0, 1, 2, 3] as const).map((s) => (
          <View
            key={s}
            style={[
              styles.dot,
              s === step
                ? { width: 24, backgroundColor: '#ffe500' }
                : { width: 8, backgroundColor: 'rgba(255,255,255,.22)' },
            ]}
          />
        ))}
      </View>

      <Animated.View
        style={[styles.content, { transform: [{ translateY: slideAnim }], paddingBottom: botPad + 16 }]}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Step 0: Welcome ── */}
          {step === 0 && (
            <View style={styles.stepContainer}>
              <View style={{ alignItems: 'center' }}><CrownMark size={72} /></View>
              <Text style={[styles.heroTitle, { color: colors.foreground }]}>
                <Text style={{ color: colors.accent }}>QUEEN</Text>{'\n'}
                <Text style={{ color: colors.primary }}>TRIVIA</Text>
              </Text>
              <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
                {COPY.join.tagline}
              </Text>

              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <CTAButton bg={colors.accent} color={colors.accentForeground} onPress={() => animateStep(1)}>
                  {COPY.join.letsPlay}
                </CTAButton>
                <CTAButton bg={colors.primary} color={colors.primaryForeground} onPress={() => router.push('/admin-login')}>
                  Host a Game
                </CTAButton>
              </View>
            </View>
          )}

          {/* ── Step 1: How it works ── */}
          {step === 1 && (
            <View style={styles.stepContainer}>
              <Pressable onPress={goBack} style={styles.backBtn} hitSlop={12}>
                <Ionicons name="chevron-back" size={22} color={colors.foreground} />
              </Pressable>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                {COPY.join.heresDeal}
              </Text>

              <View style={{ gap: 12 }}>
                {[
                  { bar: '#ff0080', title: COPY.join.howStep1Title, sub: COPY.join.howStep1Sub },
                  { bar: '#00ddff', title: COPY.join.howStep2Title, sub: COPY.join.howStep2Sub },
                  { bar: '#ffe500', title: COPY.join.howStep3Title, sub: COPY.join.howStep3Sub },
                ].map((item) => (
                  <View
                    key={item.title}
                    style={{
                      flexDirection: 'row',
                      borderRadius: 16,
                      overflow: 'hidden',
                      backgroundColor: 'rgba(255,255,255,.05)',
                    }}
                  >
                    <View style={{ width: 8, backgroundColor: item.bar }} />
                    <View style={{ flex: 1, paddingHorizontal: 16, paddingVertical: 14, gap: 3 }}>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: colors.foreground, fontFamily: 'Manrope_800ExtraBold' }}>
                        {item.title}
                      </Text>
                      <Text style={{ fontSize: 13, fontWeight: '500', color: colors.mutedForeground }}>
                        {item.sub}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              <CTAButton
                bg={colors.accent}
                color={colors.accentForeground}
                onPress={() => animateStep(2)}
              >
                {COPY.join.gotIt}
              </CTAButton>
            </View>
          )}

          {/* ── Step 2: Code entry ── */}
          {step === 2 && (
            <View style={styles.stepContainer}>
              <Pressable onPress={goBack} style={styles.backBtn} hitSlop={12}>
                <Ionicons name="chevron-back" size={22} color={colors.foreground} />
              </Pressable>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{COPY.join.magicWord}</Text>
              <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
                {COPY.join.punchIn}
              </Text>

              <View style={styles.inputGroup}>
                <TextInput
                  style={[
                    styles.codeInput,
                    {
                      backgroundColor: colors.card,
                      color: colors.foreground,
                      borderColor: codeError ? colors.destructive : colors.secondary,
                    },
                  ]}
                  value={code}
                  onChangeText={(t) => { setCode(t); setCodeError(''); }}
                  placeholder={COPY.join.codePlaceholder}
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="go"
                  onSubmitEditing={handleCodeSubmit}
                  maxLength={12}
                />
                {codeError ? (
                  <Text style={[styles.errorText, { color: colors.destructive }]}>
                    <Ionicons name="alert-circle" size={13} /> {codeError}
                  </Text>
                ) : null}
              </View>

              <CTAButton
                bg={colors.secondary}
                color={colors.secondaryForeground}
                onPress={handleCodeSubmit}
                loading={pending}
                pendingLabel={COPY.join.checking}
              >
                {COPY.join.checkIt}
              </CTAButton>
            </View>
          )}

          {/* ── Step 3: Name + avatar ── */}
          {step === 3 && (
            <View style={styles.stepContainer}>
              <Pressable onPress={goBack} style={styles.backBtn} hitSlop={12}>
                <Ionicons name="chevron-back" size={22} color={colors.foreground} />
              </Pressable>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{COPY.join.youreIn}</Text>
              <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
                {COPY.join.whatsYourName}
              </Text>

              <View style={styles.inputGroup}>
                <TextInput
                  style={[
                    styles.nameInput,
                    {
                      backgroundColor: colors.card,
                      color: colors.foreground,
                      borderColor: nameError ? colors.destructive : colors.muted,
                    },
                  ]}
                  value={name}
                  onChangeText={(t) => { setName(t); setNameError(''); }}
                  placeholder={COPY.join.yourName}
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="words"
                  returnKeyType="join"
                  onSubmitEditing={handleNameSubmit}
                  maxLength={50}
                  autoFocus
                />
                {nameError ? (
                  <Text style={[styles.errorText, { color: colors.destructive }]}>
                    <Ionicons name="alert-circle" size={13} /> {nameError}
                  </Text>
                ) : null}
              </View>

              <CTAButton
                bg={colors.accent}
                color={colors.accentForeground}
                onPress={handleNameSubmit}
                loading={pending}
                pendingLabel={COPY.join.joining}
              >
                {COPY.join.enterLobby}
              </CTAButton>
            </View>
          )}

          {/* Privacy, Terms & Support footer — shown on every step (matches web) */}
          <View style={{ flexDirection: 'row', alignSelf: 'center', gap: 16, paddingVertical: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Pressable onPress={() => router.push('/privacy')} hitSlop={12}>
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                {COPY.footer.privacyPolicy}
              </Text>
            </Pressable>
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>·</Text>
            <Pressable onPress={() => router.push('/terms')} hitSlop={12}>
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                {COPY.footer.termsOfService}
              </Text>
            </Pressable>
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>·</Text>
            <Pressable onPress={() => router.push('/support')} hitSlop={12}>
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                {COPY.footer.support}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

function CTAButton({
  children,
  bg,
  color,
  onPress,
  loading,
  pendingLabel,
}: {
  children: React.ReactNode;
  bg: string;
  color: string;
  onPress: () => void;
  loading?: boolean;
  pendingLabel?: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 30 }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20 }).start();

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={loading}
      style={{ marginTop: 4 }}
    >
      <Animated.View
        style={[
          styles.ctaBtn,
          { backgroundColor: bg, transform: [{ scale }], opacity: loading ? 0.7 : 1 },
        ]}
      >
        {loading ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ActivityIndicator color={color} size="small" />
            {pendingLabel ? <Text style={[styles.ctaBtnText, { color }]}>{pendingLabel}</Text> : null}
          </View>
        ) : (
          <Text style={[styles.ctaBtnText, { color }]}>{children}</Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blob: { position: 'absolute', width: 220, height: 220, borderRadius: 110, opacity: 0.08 },
  blob2: { position: 'absolute', width: 180, height: 180, borderRadius: 90, opacity: 0.07 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 22 },
  stepContainer: { flex: 1, justifyContent: 'center', gap: 20, paddingTop: 16, paddingBottom: 32 },
  heroTitle: { fontSize: 56, fontWeight: '900', letterSpacing: -2, lineHeight: 58, textAlign: 'center', fontFamily: 'Manrope_800ExtraBold' },
  tagline: { fontSize: 15, fontWeight: '500', textAlign: 'center', lineHeight: 22 },
  card: { borderRadius: 20, padding: 20, borderWidth: 1, gap: 14 },
  cardLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2, textAlign: 'center' },
  codePlaceholder: { borderRadius: 13, padding: 14, borderWidth: 1.5, alignItems: 'center' },
  codePlaceholderText: { fontSize: 22, fontWeight: '800', letterSpacing: 4, fontFamily: 'Manrope_800ExtraBold' },
  sectionTitle: { fontSize: 32, fontWeight: '900', letterSpacing: -1, fontFamily: 'Manrope_800ExtraBold' },
  sectionSub: { fontSize: 15, fontWeight: '500', marginTop: -8 },
  inputGroup: { gap: 8 },
  codeInput: { height: 70, borderRadius: 18, borderWidth: 2, fontSize: 30, fontWeight: '800', textAlign: 'center', letterSpacing: 6, paddingHorizontal: 16 },
  nameInput: { height: 60, borderRadius: 16, borderWidth: 1.5, fontSize: 20, fontWeight: '700', textAlign: 'center', letterSpacing: 2, paddingHorizontal: 16 },
  errorText: { fontSize: 13, fontWeight: '500' },
  ctaBtn: { height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  ctaBtnText: { fontSize: 15, fontWeight: '800', letterSpacing: 1 },
  dotsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingTop: 12, paddingBottom: 4 },
  dot: { height: 8, borderRadius: 4 },
});
