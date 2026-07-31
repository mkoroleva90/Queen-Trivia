import { Redirect } from 'expo-router';
// This file exists to satisfy the (tabs) group — actual entry is app/index.tsx
export default function TabsRedirect() {
  return <Redirect href="/" />;
}
