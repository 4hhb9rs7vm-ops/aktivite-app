import { useEffect } from 'react';
import { AppState } from 'react-native';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { scheduleDailyMoments } from '@/lib/notifications';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    // Uygulama açılınca "Günün Anı" bildirimlerini planla
    scheduleDailyMoments().catch(() => {});

    // Uygulama arka plandan her döndüğünde planı yenile
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        scheduleDailyMoments().catch(() => {});
      }
    });

    return () => subscription.remove();
  }, []);

  return (
    <ThemeProvider value={DefaultTheme}>
      <AnimatedSplashOverlay />
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}