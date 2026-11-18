// Sonuç ekranında (aktivite seçince) "aynı şeyi yapanlara selam ver" kartı.
// Anonim. Her aktivite için günde bir kez.
// 1.5.9: gelen selam sayısı beklemeden bu kartta görünür; ana ekranda "yeni selam" şeridi (SelamBanner).
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { Lang } from '@/lib/i18n';
import {
  fetchSelamCount,
  fetchSelamLive,
  hasSentSelam,
  markSelamsSeen,
  newSelamsSince,
  onSelamChanged,
  sendSelam,
} from '@/lib/selam';
import { checkBadges } from '@/lib/badges';
import { track } from '@/lib/analytics';

const F = { medium: 'DMSans_500Medium', bold: 'DMSans_700Bold' };

const TEXT = {
  tr: {
    title: (a: string) => `${a} yapanlara selam ver`,
    titlePlain: 'Aynı şeyi yapanlara selam ver',
    sub: 'Anonim · Gelenleri hemen görürsün',
    btn: 'Selam',
    sentTitle: 'Selamın gönderildi',
    sentSub: 'Gelenleri gün içinde burada görürsün',
    gotTitle: (n: string) => `${n} kişi sana selam verdi`,
    gotSub: 'Bugün, aynı şeyi yapanlardan 👋',
    error: 'Gönderilemedi, tekrar dene.',
    newOne: '1 yeni selam geldi',
    newMany: (n: string) => `${n} yeni selam geldi`,
    newSub: 'Son girişinden beri',
    reply: 'Karşılık ver',
    seen: 'Gördüm 👋',
    replied: 'Selamın gitti 👋',
  },
  en: {
    title: (a: string) => `Say hi to everyone ${a.toLowerCase()}`,
    titlePlain: 'Say hi to people doing the same',
    sub: "Anonymous · You'll see replies right away",
    btn: 'Say hi',
    sentTitle: 'Your hello is on its way',
    sentSub: "You'll see hellos here during the day",
    gotTitle: (n: string) => (n === '1' ? '1 person said hi to you' : `${n} people said hi to you`),
    gotSub: 'Today, from people doing the same 👋',
    error: "Couldn't send, try again.",
    newOne: '1 new hello',
    newMany: (n: string) => `${n} new hellos`,
    newSub: 'Since your last visit',
    reply: 'Say hi back',
    seen: 'Got it 👋',
    replied: 'Your hello is on its way 👋',
  },
};

type Props = {
  activityId: string;
  activityLabel?: string | null; // ör. "Kahve içiyorum" (başlıkta kullanılmaz, uzun olabilir)
  fg: string; // aktivitenin ana rengi
  bg: string; // aktivitenin açık rengi
  lang: Lang;
};

export function SelamCard({ activityId, fg, bg, lang }: Props) {
  const tx = (lang as string) === 'tr' ? TEXT.tr : TEXT.en;
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error' | 'loading'>('loading');
  const wave = useRef(new Animated.Value(0)).current;
  const idleWave = useRef(new Animated.Value(0)).current; // butondaki el: ara ara sallansın
  const pop = useRef(new Animated.Value(1)).current;
  // 1.5.9: bugün bu aktivitede bana gelen selam sayısı (gönderdikten sonra gösterilir)
  const [got, setGot] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    setGot(null);
    hasSentSelam(activityId).then((s) => {
      if (!alive) return;
      setState(s ? 'sent' : 'idle');
      if (s) fetchSelamCount(activityId).then((n) => alive && setGot(n)).catch(() => {});
    });
    return () => {
      alive = false;
    };
  }, [activityId]);

  async function onPress() {
    if (state === 'sending' || state === 'sent') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setState('sending');
    const ok = await sendSelam(activityId);
    if (!ok) {
      setState('error');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    track('selam_sent', { id: activityId });
    setState('sent');
    fetchSelamCount(activityId).then(setGot).catch(() => {});
    // el sallama + kart küçük bir zıplama
    wave.setValue(0);
    Animated.sequence([
      Animated.timing(wave, { toValue: 1, duration: 140, useNativeDriver: true }),
      Animated.timing(wave, { toValue: -1, duration: 140, useNativeDriver: true }),
      Animated.timing(wave, { toValue: 1, duration: 140, useNativeDriver: true }),
      Animated.timing(wave, { toValue: 0, duration: 140, useNativeDriver: true }),
    ]).start();
    pop.setValue(0.96);
    Animated.spring(pop, { toValue: 1, speed: 16, bounciness: 10, useNativeDriver: true }).start();
    setTimeout(() => checkBadges().catch(() => {}), 900); // "İlk selam" rozeti
  }

  // Gönderilmemişken butondaki el 2,5 sn'de bir sallanır (dikkat çeksin ama rahatsız etmesin)
  useEffect(() => {
    if (state !== 'idle') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(idleWave, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.timing(idleWave, { toValue: -1, duration: 120, useNativeDriver: true }),
        Animated.timing(idleWave, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.timing(idleWave, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.delay(2000),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [state]);

  if (state === 'loading') return null;
  const idleRotate = idleWave.interpolate({ inputRange: [-1, 1], outputRange: ['-22deg', '22deg'] });
  const rotate = wave.interpolate({ inputRange: [-1, 1], outputRange: ['-18deg', '18deg'] });
  const sent = state === 'sent';
  const hasGot = sent && typeof got === 'number' && got > 0;
  const gotText = hasGot ? (got as number).toLocaleString((lang as string) === 'tr' ? 'tr-TR' : 'en-US') : '';

  return (
    <Animated.View style={[styles.card, { transform: [{ scale: pop }] }]}>
      <View style={[styles.iconWrap, { backgroundColor: bg }]}>
        {hasGot ? (
          <Text style={[styles.gotNum, { color: fg }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            {gotText}
          </Text>
        ) : (
          <Animated.Text style={[styles.icon, { transform: [{ rotate }] }]}>{sent ? '✅' : '👥'}</Animated.Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
          {hasGot ? tx.gotTitle(gotText) : sent ? tx.sentTitle : tx.titlePlain}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {state === 'error' ? tx.error : hasGot ? tx.gotSub : sent ? tx.sentSub : tx.sub}
        </Text>
      </View>
      {!sent ? (
        <Pressable
          onPress={onPress}
          disabled={state === 'sending'}
          style={({ pressed }) => [styles.btn, { backgroundColor: fg }, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
        >
          {state === 'sending' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.btnRow}>
              <Text style={styles.btnText}>{tx.btn}</Text>
              <Animated.Text style={[styles.btnHand, { transform: [{ rotate: idleRotate }] }]}>👋</Animated.Text>
            </View>
          )}
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

// 1.5.9: Ana ekranda "N yeni selam geldi · Karşılık ver" şeridi.
// Son girişten beri yeni selam varsa çıkar. "Karşılık ver": bugün selam gelen ama benim henüz selam vermediğim
// aktivitelere selam gönderir; hepsine zaten verdiysem düğme "Gördüm" olur. Dokununca şerit kapanır.
export function SelamBanner({ lang, active, style }: { lang: Lang; active: boolean; style?: StyleProp<ViewStyle> }) {
  const tx = (lang as string) === 'tr' ? TEXT.tr : TEXT.en;
  const [info, setInfo] = useState<{ total: number; fresh: number; pending: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const alive = useRef(true);

  const load = useCallback(async () => {
    try {
      const s = await fetchSelamLive();
      if (!alive.current) return;
      if (!s || s.total < 1) {
        setInfo(null);
        return;
      }
      const fresh = await newSelamsSince(s.total);
      const pending: string[] = [];
      for (const r of s.byActivity) {
        if (pending.length >= 3) break;
        if (!(await hasSentSelam(r.id))) pending.push(r.id);
      }
      if (alive.current) setInfo({ total: s.total, fresh, pending });
    } catch {}
  }, []);

  useEffect(() => {
    alive.current = true;
    load();
    const off = onSelamChanged(() => {
      load();
    });
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') load();
    });
    return () => {
      alive.current = false;
      off();
      sub.remove();
    };
  }, [load]);

  async function onPress() {
    if (!info || busy) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setBusy(true);
    let sentAny = false;
    for (const id of info.pending) {
      if (await sendSelam(id)) {
        sentAny = true;
        track('selam_sent', { id, reply: true });
      }
    }
    track('selam_seen', { total: info.total, fresh: info.fresh, source: 'home' });
    if (!alive.current) return;
    setBusy(false);
    if (sentAny) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setDone(true);
      setTimeout(() => {
        markSelamsSeen(info.total).catch(() => {});
        if (alive.current) setDone(false);
        checkBadges().catch(() => {});
      }, 1600);
    } else {
      await markSelamsSeen(info.total);
    }
  }

  if (!active || !info || info.fresh < 1) return null;
  const n = info.fresh.toLocaleString((lang as string) === 'tr' ? 'tr-TR' : 'en-US');
  return (
    <View style={[styles.banner, style]}>
      <Text style={styles.bannerHand}>👋</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.bannerTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
          {done ? tx.replied : info.fresh === 1 ? tx.newOne : tx.newMany(n)}
        </Text>
        {done ? null : (
          <Text style={styles.bannerSub} numberOfLines={1}>
            {tx.newSub}
          </Text>
        )}
      </View>
      {done ? null : (
        <Pressable
          onPress={onPress}
          disabled={busy}
          style={({ pressed }) => [styles.bannerBtn, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
        >
          {busy ? (
            <ActivityIndicator color="#0F2A52" />
          ) : (
            <Text style={styles.bannerBtnText}>{info.pending.length > 0 ? tx.reply : tx.seen}</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  gotNum: { fontFamily: F.bold, fontSize: 15, paddingHorizontal: 2 },
  banner: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#F4B88A',
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bannerHand: { fontSize: 22 },
  bannerTitle: { fontFamily: F.bold, fontSize: 14.5, color: '#16161a' },
  bannerSub: { fontFamily: F.medium, fontSize: 12, color: '#6B7080', marginTop: 1 },
  bannerBtn: {
    backgroundColor: '#F4B88A',
    borderRadius: 13,
    paddingVertical: 9,
    paddingHorizontal: 13,
    minWidth: 76,
    alignItems: 'center',
  },
  bannerBtnText: { fontFamily: F.bold, fontSize: 13, color: '#0F2A52' },
  // Kompakt tek satır: küçük ekranlarda da sonuç kartının altına sığsın
  card: {
    marginTop: 10,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 17,
  },
  title: {
    fontFamily: F.bold,
    fontSize: 14,
    color: '#16161a',
  },
  sub: {
    marginTop: 1,
    fontFamily: F.medium,
    fontSize: 12,
    color: '#5b5b66',
  },
  btn: {
    minWidth: 92,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  btnHand: {
    fontSize: 17,
  },
  btnText: {
    fontFamily: F.bold,
    fontSize: 14,
    color: '#ffffff',
  },
});
