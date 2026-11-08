// Sonuç ekranında (aktivite seçince) "aynı şeyi yapanlara selam ver" kartı.
// Anonim. Her aktivite için günde bir kez. Gelen selamlar akşam 21:00'de toplu görünür.
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { Lang } from '@/lib/i18n';
import { hasSentSelam, sendSelam } from '@/lib/selam';
import { checkBadges } from '@/lib/badges';
import { track } from '@/lib/analytics';

const F = { medium: 'DMSans_500Medium', bold: 'DMSans_700Bold' };

const TEXT = {
  tr: {
    title: (a: string) => `${a} yapanlara selam ver`,
    titlePlain: 'Aynı şeyi yapanlara selam ver',
    sub: 'Anonim · Gelenler akşam 21:00’de',
    btn: 'Selam',
    sentTitle: 'Selamın gönderildi',
    sentSub: 'Sana gelenler akşam 21:00’de',
    error: 'Gönderilemedi, tekrar dene.',
  },
  en: {
    title: (a: string) => `Say hi to everyone ${a.toLowerCase()}`,
    titlePlain: 'Say hi to people doing the same',
    sub: 'Anonymous · Yours arrive at 9 pm',
    btn: 'Say hi',
    sentTitle: 'Your hello is on its way',
    sentSub: 'Yours arrive at 9 pm',
    error: "Couldn't send, try again.",
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

  useEffect(() => {
    let alive = true;
    hasSentSelam(activityId).then((s) => alive && setState(s ? 'sent' : 'idle'));
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

  return (
    <Animated.View style={[styles.card, { transform: [{ scale: pop }] }]}>
      <View style={[styles.iconWrap, { backgroundColor: bg }]}>
        <Animated.Text style={[styles.icon, { transform: [{ rotate }] }]}>{sent ? '✅' : '👥'}</Animated.Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
          {sent ? tx.sentTitle : tx.titlePlain}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {state === 'error' ? tx.error : sent ? tx.sentSub : tx.sub}
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

const styles = StyleSheet.create({
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
