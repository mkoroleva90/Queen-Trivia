import React, { useEffect } from 'react';
import { Text, TextInput } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/manrope';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as SecureStore from 'expo-secure-store';
import { setBaseUrl, setAuthTokenGetter } from '@workspace/api-client-react';
import { AuthProvider } from '@/context/AuthContext';
import { AdminAuthProvider } from '@/context/AdminAuthContext';
import { PLAYER_TOKEN_KEY } from '@/context/AuthContext';

// Set API base URL at module load — before any component mounts.
setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN ?? ''}`);

// Default auth getter uses the PLAYER token only.
// AdminAuthContext.loginAdmin() switches this to the admin token for the
// duration of the admin session, then restores it on logout.
setAuthTokenGetter(async () => {
  try {
    return await SecureStore.getItemAsync(PLAYER_TOKEN_KEY);
  } catch {
    return null;
  }
});

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 5000 },
  },
});

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="lobby" />
      <Stack.Screen name="game/[id]" />
      <Stack.Screen name="results/[id]" />
      <Stack.Screen name="admin-login" />
      <Stack.Screen name="admin-register" />
      <Stack.Screen name="admin-forgot-password" />
      <Stack.Screen name="admin" />
      <Stack.Screen name="admin/settings" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  // Apply Manrope as the default font for every Text and TextInput in the app.
  // React Native doesn't inherit fonts via CSS — this is the global baseline.
  // Individual styles that explicitly set fontFamily override this correctly.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Text as any).defaultProps = { style: { fontFamily: 'Manrope_400Regular' } };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (TextInput as any).defaultProps = { style: { fontFamily: 'Manrope_400Regular' } };

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AdminAuthProvider queryClient={queryClient}>
            <AuthProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <KeyboardProvider>
                  <RootLayoutNav />
                </KeyboardProvider>
              </GestureHandlerRootView>
            </AuthProvider>
          </AdminAuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
