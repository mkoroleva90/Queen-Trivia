// Lobby screen removed — players now go directly to their game via per-game code.
// This file is kept as a redirect stub so deep links don't 404.
import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function LobbyRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/');
  }, [router]);
  return null;
}
