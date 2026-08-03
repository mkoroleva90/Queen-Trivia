import React, { useEffect, useRef, useState } from 'react';
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
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { CrownMark } from '@/components/CrownMark';

const AVATAR_COLORS = ['#ff0080', '#00ddff', '#8b5cf6', '#22c55e'];

type Step = 0 | 1 | 2 | 3;

export default function WelcomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, authReady, loginUser } = useAuth();

  const [step, setStep] = useState<Step>(0);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(0);
  const [codeError, setCodeError] = useState('');
  const [nameError, setNameError] = useState('');
  const [pending, setPending] = useState(false);

  const slideAnim = useRef(new Animated.Value(0)).current;

  const baseUrl = process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
    : '';

  // Redirect already-logged-in users
  useEffect(() => {
    if (authReady && user) {
      router.replace('/lobby');
    }
  }, [authReady, user, router]);

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
    if (!trimmed) { setCodeError('Enter your room code'); return; }
    setCodeError('');
    setPending(true);
    try {
      const res = await fetch(`${baseUrl}/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      });
      const data = (await res.json()) as { valid: boolean; role: string };
      if (!data.valid) { setCodeError("That code isn't right — try again"); return; }
      if (data.role === 'admin') { setCodeError('Use the admin app to manage games'); return; }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      animateStep(3);
    } catch {
      setCodeError('Connection error — please retry');
    } finally {
      setPending(false);
    }
  };

  const handleNameSubmit = async () => {
    const trimmedName = name.trim();
    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedName) { setNameError('Enter your display name'); return; }
    if (trimmedName.length > 50) { setNameError('Name must be 50 characters or fewer'); return; }
    setNameError('');
    setPending(true);
    try {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmedCode, name: trimmedName }),
      });
      if (res.status === 401) { setCodeError('Code expired — re-enter'); animateStep(2); return; }
      if (!res.ok) { setNameError('Something went wrong — please retry'); return; }
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
        } catch { /* fall through to lobby */ }
      }
      router.replace('/lobby');
    } catch {
      setNameError('Connection error — please retry');
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
                Enter the code. Answer fast. Take the throne.
              </Text>

              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.cardLabel, { color: '#ffffff' }]}>ENTER ROOM CODE</Text>
                <View style={[styles.codePlaceholder, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                  <Text style={[styles.codePlaceholderText, { color: colors.mutedForeground }]}>A1B2…</Text>
                </View>
                <CTAButton bg={colors.accent} color={colors.accentForeground} onPress={goNext}>
                  Let's play →
                </CTAButton>
              </View>

              {/* Admin / host access */}
              <Pressable
                onPress={() => router.push('/admin-login')}
                hitSlop={12}
                style={{ alignSelf: 'center', paddingVertical: 4 }}
              >
                <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
                  Hosting tonight?{' '}
                  <Text style={{ color: colors.primary, fontFamily: 'Manrope_600SemiBold' }}>
                    Admin sign-in →
                  </Text>
                </Text>
              </Pressable>
            </View>
          )}

          {/* ── Step 1: How it works ── */}
          {step === 1 && (
            <View style={styles.stepContainer}>
              <Pressable onPress={goBack} style={styles.backBtn} hitSlop={12}>
                <Ionicons name="chevron-back" size={22} color={colors.foreground} />
              </Pressable>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Here's the deal</Text>
              <View style={styles.rules}>
                {[
                  { color: colors.primary, title: '1 · Enter the code', sub: 'Your host shares it at the door.' },
                  { color: colors.secondary, title: '2 · Grab a name', sub: "Make it one they'll fear." },
                  { color: colors.accent, title: '3 · Go fast', sub: 'Speed = bonus points.' },
                ].map((item) => (
                  <View key={item.title} style={[styles.ruleCard, { backgroundColor: colors.card }]}>
                    <View style={[styles.ruleBar, { backgroundColor: item.color }]} />
                    <View style={styles.ruleText}>
                      <Text style={[styles.ruleTitle, { color: colors.foreground }]}>{item.title}</Text>
                      <Text style={[styles.ruleSub, { color: colors.mutedForeground }]}>{item.sub}</Text>
                    </View>
                  </View>
                ))}
              </View>
              <CTAButton bg={colors.primary} color={colors.primaryForeground} onPress={goNext}>
                Got it →
              </CTAButton>
            </View>
          )}

          {/* ── Step 2: Code entry ── */}
          {step === 2 && (
            <View style={styles.stepContainer}>
              <Pressable onPress={goBack} style={styles.backBtn} hitSlop={12}>
                <Ionicons name="chevron-back" size={22} color={colors.foreground} />
              </Pressable>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Magic word?</Text>
              <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
                Punch in tonight's access code.
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
                  placeholder="ROOM CODE"
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
              >
                Check it →
              </CTAButton>
            </View>
          )}

          {/* ── Step 3: Name + avatar ── */}
          {step === 3 && (
            <View style={styles.stepContainer}>
              <Pressable onPress={goBack} style={styles.backBtn} hitSlop={12}>
                <Ionicons name="chevron-back" size={22} color={colors.foreground} />
              </Pressable>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>You're in!</Text>
              <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
                Pick a color and a name.
              </Text>

              {/* Avatar swatches */}
              <View style={styles.avatarRow}>
                {AVATAR_COLORS.map((c, i) => (
                  <Pressable
                    key={c}
                    onPress={() => { setAvatar(i); Haptics.selectionAsync(); }}
                    style={[
                      styles.avatarSwatch,
                      { backgroundColor: c },
                      avatar === i && { borderWidth: 3, borderColor: colors.accent },
                    ]}
                  />
                ))}
              </View>

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
                  placeholder="YOUR NAME"
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
              >
                Join the game →
              </CTAButton>
            </View>
          )}
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
}: {
  children: React.ReactNode;
  bg: string;
  color: string;
  onPress: () => void;
  loading?: boolean;
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
          <ActivityIndicator color={color} size="small" />
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
  rules: { gap: 12 },
  ruleCard: { flexDirection: 'row', borderRadius: 16, overflow: 'hidden' },
  ruleBar: { width: 8, flexShrink: 0 },
  ruleText: { flex: 1, padding: 16 },
  ruleTitle: { fontSize: 16, fontWeight: '800' },
  ruleSub: { fontSize: 13, fontWeight: '500', marginTop: 3 },
  inputGroup: { gap: 8 },
  codeInput: { height: 70, borderRadius: 18, borderWidth: 2, fontSize: 30, fontWeight: '800', textAlign: 'center', letterSpacing: 6, paddingHorizontal: 16 },
  nameInput: { height: 60, borderRadius: 16, borderWidth: 1.5, fontSize: 20, fontWeight: '700', textAlign: 'center', letterSpacing: 2, paddingHorizontal: 16 },
  errorText: { fontSize: 13, fontWeight: '500' },
  avatarRow: { flexDirection: 'row', gap: 12 },
  avatarSwatch: { width: 46, height: 46, borderRadius: 16 },
  ctaBtn: { height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  ctaBtnText: { fontSize: 15, fontWeight: '800', letterSpacing: 1 },
});
