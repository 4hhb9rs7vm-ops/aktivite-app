import { useEffect } from 'react';
import { AppState } from 'react-native';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import { getNotifications, scheduleDailyMoments } from '@/lib/notifications';
import { startAnalytics, track } from '@/lib/analytics';
import { openTabFromNotification, registerPushToken, tabForNotification } from '@/lib/ask';
import { DailyQuestionGate } from '@/components/DailyQuestionGate';
import { BadgeCelebration } from '@/components/BadgeCelebration';
import { CampusLeagueHost } from '@/components/CampusLeague';

// Yerel açılış ekranı (lacivert zemin + logo), ana ekran hazır olana kadar açık kalır.
// Kapatma işi src/app/index.tsx içinde, yazı tipleri ve veriler yüklenince yapılır.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  useEffect(() => {
    // Güvenlik ağı: bir şey ters giderse açılış ekranı en geç 6 saniyede kapansın
    const fallback = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 6000);

    // Ölçüm: açılışı kaydet, arka plandan dönüşleri izle
    startAnalytics();

    // Bildirime dokunarak gelenleri say (Günün Anı / 21:00 sonuç / Sor)
    // "Sor" bildirimleri ilgili sekmeyi açar. Aynı bildirim iki kez işlenmesin diye kimliği tutulur.
    const Notifications = getNotifications();
    const handled = new Set<string>();
    function handleResponse(res: any) {
      const id: string = res?.notification?.request?.identifier ?? '';
      if (id && handled.has(id)) return;
      if (id) handled.add(id);
      const type = (res?.notification?.request?.content?.data as { type?: string } | undefined)?.type ?? 'unknown';
      track('notif_open', { type });
      const target = tabForNotification(type);
      if (target) {
        track('ask_tap', { type });
        openTabFromNotification(target);
      }
    }
    const notifSub = Notifications?.addNotificationResponseReceivedListener(handleResponse);
    // Uygulama kapalıyken bildirime dokunulduysa (soğuk açılış): son 10 dakikadaki bildirimi uygula
    Notifications?.getLastNotificationResponseAsync()
      .then((res) => {
        if (!res) return;
        const at = res.notification?.date ?? 0;
        const ms = at > 1e12 ? at : at * 1000;
        if (Date.now() - ms < 10 * 60 * 1000) handleResponse(res);
      })
      .catch(() => {});

    // Sor: bildirim izni varsa bildirim adresini sunucuya kaydet
    registerPushToken().catch(() => {});

    // Uygulama açılınca "Günün Anı" bildirimlerini planla
    scheduleDailyMoments().catch(() => {});

    // Uygulama arka plandan her döndüğünde planı yenile
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        scheduleDailyMoments().catch(() => {});
        registerPushToken().catch(() => {});
      }
    });

    return () => {
      clearTimeout(fallback);
      subscription.remove();
      notifSub?.remove();
    };
  }, []);

  return (
    <ThemeProvider value={DefaultTheme}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
      {/* Günün Sorusu: açılış animasyonundan sonra, günde bir kez tam ekran soru */}
      <DailyQuestionGate />
      {/* Yeni rozet kazanılınca kutlama */}
      <BadgeCelebration />
      {/* 1.5.2 Kampüs Ligi: öğrenci sorusu, okul kilidi, Pazartesi sonucu */}
      <CampusLeagueHost />
    </ThemeProvider>
  );
}
