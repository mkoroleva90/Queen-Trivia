import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { useColors } from '@/hooks/useColors';

export default function AdminLayout() {
  const { isAdmin, adminReady } = useAdminAuth();
  const colors = useColors();

  if (!adminReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isAdmin) {
    return <Redirect href="/admin-login" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[gameId]" />
      <Stack.Screen name="live/[gameId]" />
      <Stack.Screen name="results/[gameId]" />
    </Stack>
  );
}
