import { useEffect } from 'react';
import { AppState } from 'react-native';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import { scheduleDailyMoments } from '@/lib/notifications';

// Yerel açılış ekranı (lacivert zemin + logo), ana ekran hazır olana kadar açık kalır.
// Kapatma işi src/app/index.tsx içinde, yazı tipleri ve veriler yüklenince yapılır.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  useEffect(() => {
    // Güvenlik ağı: bir şey ters giderse açılış ekranı en geç 6 saniyede kapansın
    const fallback = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 6000);

    // Uygulama açılınca "Günün Anı" bildirimlerini planla
    scheduleDailyMoments().catch(() => {});

    // Uygulama arka plandan her döndüğünde planı yenile
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        scheduleDailyMoments().catch(() => {});
      }
    });

    return () => {
      clearTimeout(fallback);
      subscription.remove();
    };
  }, []);

  return (
    <ThemeProvider value={DefaultTheme}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
