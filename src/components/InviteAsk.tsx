// 1.5.7: Davet sorusu. İkinci gün (ya da güncellemeden sonraki ilk) açılışta, ana ekranda bir kez sorulur.
// "Davet et" Arkadaşlar sekmesine götürür: ad yazılır, davet bağlantısı paylaşılır.
// Bağlantıdan katılan her arkadaş için iki tarafa 50 puan (sunucu yazar).
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import type { Lang } from '@/lib/i18n';
import { celebratedThisSession, isOverlayBusy, setOverlayBusy, whenOverlayFree } from '@/lib/overlay';
import { isFirstDay } from '@/lib/firstRun';
import { INVITE_POINTS } from '@/lib/prediction';
import { track } from '@/lib/analytics';

const ASKED_KEY = 'invite_ask_v1';
const F = { regular: 'DMSans_400Regular', medium: 'DMSans_500Medium', bold: 'DMSans_700Bold' };
const INK = '#16161A';
const MUTED = '#6B6F7B';
const ACCENT = '#3F3BC9';
const PEACH = '#F4B88A';

export function InviteAskHost({
  lang,
  active,
  bottomInset,
  onInvite,
}: {
  lang: Lang;
  active: boolean; // ana ekran açık, an seçili değil
  bottomInset: number;
  onInvite: () => void;
}) {
  const [open, setOpen] = useState(false);
  const T = (lang as string) === 'tr';

  useEffect(() => {
    setOverlayBusy('invite_ask', open);
    return () => setOverlayBusy('invite_ask', false);
  }, [open]);

  useEffect(() => {
    if (!active || open) return;
    let cancelled = false;
    let cancelWait = () => {};
    let settle: ReturnType<typeof setTimeout> | null = null;
    const start = setTimeout(async () => {
      try {
        if (cancelled) return;
        if (await AsyncStorage.getItem(ASKED_KEY)) return;
        if (await isFirstDay()) return; // ilk gün sorulmaz
        if (cancelled) return;
        cancelWait = whenOverlayFree(() => {
          // Bir pencere kapanıp diğeri açılıyor olabilir: kısa bekle, hâlâ boşsa göster
          settle = setTimeout(() => {
            if (cancelled || isOverlayBusy('invite_ask') || celebratedThisSession()) return;
            AsyncStorage.setItem(ASKED_KEY, '1').catch(() => {});
            track('invite_ask_shown', {});
            setOpen(true);
          }, 900);
        }, 'invite_ask');
      } catch {}
    }, 2500);
    return () => {
      cancelled = true;
      clearTimeout(start);
      if (settle) clearTimeout(settle);
      cancelWait();
    };
  }, [active, open]);

  function answer(yes: boolean) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    track('invite_ask_answer', { yes });
    setOpen(false);
    if (yes) setTimeout(onInvite, 350);
  }

  if (!open) return null;
  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={() => answer(false)}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => answer(false)} accessibilityLabel={T ? 'Kapat' : 'Close'} />
        <View style={[styles.sheet, { paddingBottom: Math.max(bottomInset, 16) + 12 }]}>
          <View style={styles.handle} />
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{T ? `+${INVITE_POINTS} PUAN · İKİNİZE DE` : `+${INVITE_POINTS} POINTS · FOR BOTH`}</Text>
          </View>
          <Text style={styles.title}>{T ? 'Arkadaşların şu an ne yapıyor?' : 'What are your friends up to?'}</Text>
          <Text style={styles.body}>
            {T
              ? 'Davet bağlantını gönder. Katılan her arkadaşın için ikiniz de 50 puan kazanırsınız, birbirinizin anını da görürsünüz.'
              : 'Send your invite link. For every friend who joins, you both get 50 points and can see each other’s moments.'}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.primary, pressed && { opacity: 0.88 }]}
            onPress={() => answer(true)}
            accessibilityRole="button"
          >
            <Text style={styles.primaryText}>{T ? 'Arkadaşını davet et' : 'Invite a friend'}</Text>
          </Pressable>
          <Pressable style={styles.later} onPress={() => answer(false)} hitSlop={8} accessibilityRole="button">
            <Text style={styles.laterText}>{T ? 'Şimdi değil' : 'Not now'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(10,14,28,0.45)' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 10,
    alignItems: 'center',
  },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: '#D4D4D8', marginBottom: 18 },
  badge: { backgroundColor: '#FDEEE2', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: PEACH },
  badgeText: { fontFamily: F.bold, fontSize: 12, letterSpacing: 0.6, color: '#9A5A2C' },
  title: { fontFamily: F.bold, fontSize: 22, lineHeight: 28, color: INK, textAlign: 'center', marginTop: 14 },
  body: { fontFamily: F.regular, fontSize: 15, lineHeight: 22, color: MUTED, textAlign: 'center', marginTop: 8 },
  primary: {
    alignSelf: 'stretch',
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  primaryText: { fontFamily: F.bold, fontSize: 16, color: '#FFFFFF' },
  later: { paddingVertical: 14 },
  laterText: { fontFamily: F.medium, fontSize: 15, color: MUTED },
});
