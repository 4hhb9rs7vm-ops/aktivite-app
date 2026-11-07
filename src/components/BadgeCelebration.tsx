// Yeni rozet kutlaması (tüm uygulamada tek yerde, _layout.tsx içinde).
// Rozet kazanılınca koyu arka plan + ortada büyük rozet + "Story'de paylaş".
// Birden fazla rozet geldiyse sırayla gösterir.
import { forwardRef, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, PixelRatio, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { Lang, loadLang } from '@/lib/i18n';
import { BADGE_BY_ID, BadgeId, onNewBadges } from '@/lib/badges';
import { track } from '@/lib/analytics';

const NAVY = '#0F2A52';
const AMBER = '#FBBF24';
const AMBER_FG = '#B45309';
const F = { medium: 'DMSans_500Medium', bold: 'DMSans_700Bold' };

const TEXT = {
  tr: { kicker: 'YENİ ROZET', share: "Story'de paylaş", next: 'Devam', storyAsk: 'Sen hangi rozettesin?', series: '30 Gün 30 Soru' },
  en: { kicker: 'NEW BADGE', share: 'Share to Story', next: 'Continue', storyAsk: 'Which badge are you?', series: '30 Days 30 Questions' },
};

// Paylaşım kartı (360×640, 1080×1920 kaydedilir)
const BadgeStory = forwardRef<View, { id: BadgeId; lang: Lang }>(function BadgeStory({ id, lang }, ref) {
  const b = BADGE_BY_ID[id];
  const tr = (lang as string) === 'tr';
  const tx = tr ? TEXT.tr : TEXT.en;
  return (
    <View ref={ref} collapsable={false} style={story.card}>
      <View style={story.top}>
        <Text style={story.brand}>ŞU AN</Text>
        <View style={story.pill}>
          <Text style={story.pillText}>{tx.series}</Text>
        </View>
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <View style={story.halo2}>
          <View style={story.halo1}>
            <View style={story.medal}>
              <Text style={story.emoji}>{b.emoji}</Text>
            </View>
          </View>
        </View>
        <Text style={story.kicker}>{tx.kicker}</Text>
        <Text style={story.name}>{tr ? b.name.tr : b.name.en}</Text>
        <Text style={story.how}>{tr ? b.how.tr : b.how.en}</Text>
      </View>
      <View style={story.bottom}>
        <Text style={story.ask}>{tx.storyAsk}</Text>
        <Text style={story.handle}>@suan.app</Text>
      </View>
    </View>
  );
});

export function BadgeCelebration() {
  const [queue, setQueue] = useState<BadgeId[]>([]);
  const [lang, setLang] = useState<Lang>('tr');
  const [visible, setVisible] = useState(false);
  const shareRef = useRef<View>(null);
  const scale = useRef(new Animated.Value(0.6)).current;
  const spin = useRef(new Animated.Value(0)).current;

  const current = queue[0] ?? null;

  useEffect(() => {
    return onNewBadges((ids) => {
      loadLang()
        .then((l) => setLang((l ?? 'tr') as Lang))
        .catch(() => {});
      setQueue((q) => [...q, ...ids.filter((id) => !q.includes(id))]);
    });
  }, []);

  useEffect(() => {
    if (!current) {
      setVisible(false);
      return;
    }
    // Diğer ekranlar (soru kartı vb.) kapanmış olsun diye kısa bir bekleme
    const t = setTimeout(() => {
      setVisible(true);
      scale.setValue(0.6);
      spin.setValue(0);
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, speed: 10, bounciness: 14, useNativeDriver: true }),
        Animated.timing(spin, { toValue: 1, duration: 700, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true }),
      ]).start();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      track('badge_earned', { id: current });
    }, 500);
    return () => clearTimeout(t);
  }, [current]);

  function next() {
    setVisible(false);
    setTimeout(() => setQueue((q) => q.slice(1)), 250);
  }

  async function share() {
    if (!current) return;
    let uri: string | null = null;
    try {
      const s = Platform.OS === 'ios' ? PixelRatio.get() : 1;
      uri = await captureRef(shareRef, {
        format: 'jpg',
        quality: 0.92,
        result: 'tmpfile',
        width: Math.round(1080 / s),
        height: Math.round(1920 / s),
      });
    } catch {}
    track('badge_shared', { id: current });
    next();
    if (!uri) return;
    const u = uri;
    setTimeout(
      async () => {
        try {
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(u, { mimeType: 'image/jpeg', UTI: 'public.jpeg' });
          }
        } catch {}
      },
      Platform.OS === 'ios' ? 1200 : 450
    );
  }

  if (!current) return null;
  const b = BADGE_BY_ID[current];
  const tr = (lang as string) === 'tr';
  const tx = tr ? TEXT.tr : TEXT.en;
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['-25deg', '0deg'] });

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={next}>
      <View style={styles.root}>
        <View style={styles.offscreen} pointerEvents="none">
          <BadgeStory ref={shareRef} id={current} lang={lang} />
        </View>
        <View style={styles.card}>
          <Text style={styles.kicker}>{tx.kicker}</Text>
          <Animated.View style={[styles.halo2, { transform: [{ scale }, { rotate }] }]}>
            <View style={styles.halo1}>
              <View style={styles.medal}>
                <Text style={styles.emoji}>{b.emoji}</Text>
              </View>
            </View>
          </Animated.View>
          <Text style={styles.name}>{tr ? b.name.tr : b.name.en}</Text>
          <Text style={styles.how}>{tr ? b.done.tr : b.done.en}</Text>
          {b.reward ? <Text style={styles.reward}>{tr ? b.reward.tr : b.reward.en}</Text> : null}
          <Pressable onPress={share} style={styles.shareBtn} accessibilityRole="button">
            <Text style={styles.shareText}>{tx.share}</Text>
          </Pressable>
          <Pressable onPress={next} style={styles.nextBtn} accessibilityRole="button">
            <Text style={styles.nextText}>{tx.next}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'rgba(6,12,26,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  offscreen: { position: 'absolute', left: -2000, top: 0, width: 360, height: 640 },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#ffffff',
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 12,
    alignItems: 'center',
  },
  kicker: { fontFamily: F.bold, fontSize: 13, letterSpacing: 1.4, color: AMBER_FG },
  halo2: {
    marginTop: 18,
    width: 168,
    height: 168,
    borderRadius: 84,
    backgroundColor: 'rgba(251,191,36,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo1: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(251,191,36,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  medal: {
    width: 116,
    height: 116,
    borderRadius: 58,
    backgroundColor: AMBER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 60 },
  name: { marginTop: 18, fontFamily: F.bold, fontSize: 30, letterSpacing: -0.6, color: NAVY, textAlign: 'center' },
  how: { marginTop: 4, fontFamily: F.bold, fontSize: 15, color: AMBER_FG },
  reward: { marginTop: 8, fontFamily: F.medium, fontSize: 15, lineHeight: 21, color: '#5b5b66', textAlign: 'center' },
  shareBtn: {
    marginTop: 20,
    alignSelf: 'stretch',
    height: 54,
    borderRadius: 16,
    backgroundColor: AMBER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareText: { fontFamily: F.bold, fontSize: 18, color: NAVY },
  nextBtn: { paddingVertical: 14, paddingHorizontal: 30 },
  nextText: { fontFamily: F.bold, fontSize: 16, color: NAVY },
});

const story = StyleSheet.create({
  card: { width: 360, height: 640, backgroundColor: NAVY, paddingTop: 38, paddingHorizontal: 24, paddingBottom: 28 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { fontFamily: F.bold, fontSize: 13, letterSpacing: 2, color: '#ffffff' },
  pill: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)' },
  pillText: { fontFamily: F.bold, fontSize: 12, color: '#ffffff' },
  halo2: {
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: 'rgba(251,191,36,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo1: {
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(251,191,36,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  medal: {
    width: 156,
    height: 156,
    borderRadius: 78,
    backgroundColor: AMBER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 80 },
  kicker: { marginTop: 28, fontFamily: F.bold, fontSize: 14, letterSpacing: 1.6, color: AMBER },
  name: { marginTop: 6, fontFamily: F.bold, fontSize: 44, letterSpacing: -1, color: '#ffffff', textAlign: 'center' },
  how: { marginTop: 4, fontFamily: F.bold, fontSize: 16, color: 'rgba(255,255,255,0.75)' },
  bottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  ask: { fontFamily: F.bold, fontSize: 15, color: '#ffffff' },
  handle: { fontFamily: F.bold, fontSize: 13, color: 'rgba(255,255,255,0.75)' },
});
