// Günün Sorusu — akşam 21:00 sonuç ekranı (lacivert, tam ekran).
// 1. ekran: soru + büyük çizim + "Senin cevabın" + "Sonucu aç".
// 2. ekran (aynı yerde): çizim küçülür; en üstte karar kartı (Çoğunluktasın / Azınlıktasın + kulüp),
//    hemen altında "Story'de paylaş"; tüm şıkların yüzdeleri en altta, sırayla dolarak gelir.
// Paylaşım: kart fotoğrafı ekran açıkken alınır, ekran kapanır, paylaşma penceresini
// DailyQuestionGate açar (iOS'ta modal üstüne paylaşım penceresi açılmadığı için).
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  LayoutAnimation,
  Modal,
  PixelRatio,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { captureRef } from 'react-native-view-shot';
import { SvgXml } from 'react-native-svg';
import { ShareNetwork, UsersThree, X } from 'phosphor-react-native';
import type { Lang } from '@/lib/i18n';
import {
  clubName,
  dayLabel,
  optionLabel,
  PendingReveal,
  questionText,
  SERIES_LENGTH,
  THEMES,
  themeOf,
} from '@/lib/dailyQuestion';
import { StoryShareCard, STORY_H, STORY_W } from '@/components/StoryShareCard';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const NAVY = '#0F2A52';
const AMBER = '#FBBF24';
const AMBER_FG = '#B45309';
const F = { regular: 'DMSans_400Regular', medium: 'DMSans_500Medium', bold: 'DMSans_700Bold' };

const TEXT = {
  tr: {
    day: (n: number) => `Gün ${n}/${SERIES_LENGTH}`,
    titleToday: 'Sonuçlar açıklandı',
    titleYesterday: 'Dünün sonucu',
    open: 'Sonucu aç',
    yours: 'Senin cevabın',
    allAnswers: 'Tüm cevaplar',
    world: (n: string) => `Dünyadan ${n} kişi cevapladı`,
    country: (n: string) => `Ülkenden ${n} kişi cevapladı`,
    majority: 'Çoğunluktasın',
    minority: 'Azınlıktasın',
    middle: 'Tam ortadasın',
    majorityText: (p: number, o: string) => `İnsanların %${p}'i senin gibi "${o}" dedi.`,
    minorityText: (p: number, o: string) => `Sadece %${p} senin gibi "${o}" dedi. Nadir türdensin.`,
    middleText: (p: number, o: string) => `%${p} senin gibi "${o}" dedi.`,
    clubPre: 'Resmen',
    clubPost: 'üyesisin',
    share: "Story'de paylaş",
    close: 'Kapat',
    tomorrow: 'Yarın yeni soru seni bekliyor.',
  },
  en: {
    day: (n: number) => `Day ${n}/${SERIES_LENGTH}`,
    titleToday: 'Results are in',
    titleYesterday: "Yesterday's result",
    open: 'Reveal the result',
    yours: 'Your answer',
    allAnswers: 'All answers',
    world: (n: string) => `${n} people answered worldwide`,
    country: (n: string) => `${n} people answered in your country`,
    majority: "You're with the majority",
    minority: "You're in the minority",
    middle: "You're right in the middle",
    majorityText: (p: number, o: string) => `${p}% of people said "${o}", just like you.`,
    minorityText: (p: number, o: string) => `Only ${p}% said "${o}" like you. A rare kind.`,
    middleText: (p: number, o: string) => `${p}% said "${o}", just like you.`,
    clubPre: "You're officially in the",
    clubPost: '',
    share: 'Share to Story',
    close: 'Close',
    tomorrow: 'A new question is waiting tomorrow.',
  },
};

type Props = {
  data: PendingReveal;
  lang: Lang;
  // shareUri doluysa: kapandıktan sonra bu görseli paylaş
  onClose: (shareUri: string | null) => void;
  autoReveal?: boolean; // Anketler sekmesinden açılınca "Sonucu aç" beklemeden göster
  kicker?: string; // üstteki sarı başlığı değiştirmek için (ör. '4 Kasım')
};

export function DailyResultReveal({ data, lang, onClose, autoReveal = false, kicker }: Props) {
  const insets = useSafeAreaInsets();
  // Modal içinde bazı cihazlarda insets 0 gelebiliyor; açılıştaki değerle tamamla
  const topInset = Math.max(insets.top, initialWindowMetrics?.insets.top ?? 0, Platform.OS === 'ios' ? 44 : 24);
  const bottomInset = Math.max(insets.bottom, initialWindowMetrics?.insets.bottom ?? 0);

  const tx = (lang as string) === 'tr' ? TEXT.tr : TEXT.en;
  const { question, myKey, result, isYesterday } = data;
  const theme = themeOf(question);
  const t = THEMES[theme];

  const [visible, setVisible] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [sharing, setSharing] = useState(false);
  const shareRef = useRef<View>(null);

  const bars = useRef(question.options.map(() => new Animated.Value(0))).current;
  const verdictAnim = useRef(new Animated.Value(0)).current;
  const listAnim = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  const pctOf = (key: string) => Math.round(result.pct[key] ?? 0);
  const myPct = pctOf(myKey);
  const pcts = question.options.map((o) => pctOf(o.key));
  const maxPct = Math.max(...pcts);
  const minPct = Math.min(...pcts);
  const myOption = question.options.find((o) => o.key === myKey) ?? question.options[0];
  const myLabel = optionLabel(myOption, lang);
  const club = clubName(myOption, lang);
  const qText = questionText(question, lang) ?? question.question_tr;
  const totalText = result.total.toLocaleString((lang as string) === 'tr' ? 'tr-TR' : 'en-US');

  let verdict: 'majority' | 'minority' | 'middle' = 'middle';
  if (myPct === maxPct && myPct > 0) verdict = 'majority';
  else if (myPct === minPct || myPct < 20) verdict = 'minority';
  const verdictText =
    verdict === 'majority'
      ? tx.majorityText(myPct, myLabel)
      : verdict === 'minority'
        ? tx.minorityText(myPct, myLabel)
        : tx.middleText(myPct, myLabel);

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    if (autoReveal) {
      const timer = setTimeout(reveal, 250);
      return () => clearTimeout(timer);
    }
  }, []);

  function reveal() {
    if (revealed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    LayoutAnimation.configureNext(LayoutAnimation.create(320, 'easeInEaseOut', 'opacity'));
    setRevealed(true);

    // önce karar kartı, sonra alttaki yüzdeler sırayla dolar
    Animated.spring(verdictAnim, { toValue: 1, speed: 12, bounciness: 9, useNativeDriver: true }).start();
    setTimeout(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }, 180);
    Animated.sequence([
      Animated.delay(350),
      Animated.timing(listAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
      Animated.stagger(
        200,
        question.options.map((o, i) =>
          Animated.timing(bars[i], {
            toValue: pctOf(o.key),
            duration: 600,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          })
        )
      ),
    ]).start();
  }

  function finish(uri: string | null) {
    setVisible(false);
    onClose(uri);
  }

  async function share() {
    if (sharing) return;
    setSharing(true);
    Haptics.selectionAsync().catch(() => {});
    try {
      const scale = Platform.OS === 'ios' ? PixelRatio.get() : 1;
      const uri = await captureRef(shareRef, {
        format: 'jpg',
        quality: 0.92,
        result: 'tmpfile',
        width: Math.round(1080 / scale),
        height: Math.round(1920 / scale),
      });
      finish(uri);
    } catch {
      setSharing(false);
    }
  }

  const verdictScale = verdictAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent onRequestClose={() => finish(null)}>
      <View style={styles.root}>
        {/* Paylaşım kartı: ekran dışında çizilir, sadece fotoğrafı alınır */}
        <View style={styles.offscreen} pointerEvents="none">
          <StoryShareCard
            ref={shareRef}
            theme={theme}
            artSvg={question.art_svg ?? null}
            question={qText}
            dateLabel={dayLabel(question.day_date, lang)}
            club={club}
            option={myLabel}
            pct={myPct}
            lang={lang}
          />
        </View>

        <Animated.View style={{ flex: 1, opacity: fadeIn }}>
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingTop: topInset + 8, paddingBottom: bottomInset + 24 }]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.topRow}>
              <Text style={styles.brand}>ŞU AN</Text>
              <View style={{ flex: 1 }} />
              {question.series_day ? (
                <View style={styles.dayPill}>
                  <Text style={styles.dayPillText}>{tx.day(question.series_day)}</Text>
                </View>
              ) : null}
              <Pressable onPress={() => finish(null)} hitSlop={12} style={styles.closeBtn} accessibilityLabel={tx.close}>
                <X size={20} color="#ffffff" weight="bold" />
              </Pressable>
            </View>

            <Text style={styles.kicker}>{kicker ?? (isYesterday ? tx.titleYesterday : tx.titleToday)}</Text>
            <Text style={[styles.question, revealed && styles.questionSmall]}>{qText}</Text>

            <View style={[styles.artCard, revealed ? styles.artCardSmall : styles.artCardBig, { backgroundColor: t.bg }]}>
              {question.art_svg ? <SvgXml xml={question.art_svg} width="100%" height="100%" /> : null}
            </View>

            {!revealed ? (
              <View style={{ gap: 14, marginTop: 22 }}>
                <View style={styles.yoursBox}>
                  <Text style={styles.yoursLabel}>{tx.yours}</Text>
                  <Text style={styles.yoursText}>{myLabel}</Text>
                </View>
                <Pressable onPress={reveal} style={styles.openBtn} accessibilityRole="button">
                  <Text style={styles.openText}>{tx.open}</Text>
                </Pressable>
              </View>
            ) : (
              <View style={{ marginTop: 16 }}>
                {/* 1) Karar + kulüp */}
                <Animated.View
                  style={[styles.verdictCard, { opacity: verdictAnim, transform: [{ scale: verdictScale }] }]}
                >
                  <View style={styles.verdictHead}>
                    <Text style={styles.verdictTitle}>{tx[verdict]}</Text>
                    <View style={styles.pctBadge}>
                      <Text style={styles.pctBadgeText}>%{myPct}</Text>
                    </View>
                  </View>
                  <Text style={styles.verdictText}>{verdictText}</Text>
                  {club ? (
                    <View style={styles.clubBox}>
                      <Text style={styles.clubPre}>{tx.clubPre}</Text>
                      <Text style={styles.clubName}>{club}</Text>
                      {tx.clubPost ? <Text style={styles.clubPre}>{tx.clubPost}</Text> : null}
                    </View>
                  ) : null}
                </Animated.View>

                {/* 2) Paylaş / kapat */}
                <Animated.View style={{ opacity: verdictAnim, marginTop: 14 }}>
                  <Pressable onPress={share} style={styles.shareBtn} accessibilityRole="button" disabled={sharing}>
                    <ShareNetwork size={22} color={NAVY} weight="bold" />
                    <Text style={styles.shareText}>{tx.share}</Text>
                  </Pressable>
                  <Pressable onPress={() => finish(null)} style={styles.closeTextBtn} accessibilityRole="button">
                    <Text style={styles.closeText}>{tx.close}</Text>
                  </Pressable>
                </Animated.View>

                {/* 3) Tüm cevaplar en altta */}
                <Animated.View style={[styles.listBox, { opacity: listAnim }]}>
                  <View style={styles.listHead}>
                    <Text style={styles.listTitle}>{tx.allAnswers}</Text>
                    <View style={styles.totalRow}>
                      <UsersThree size={16} color="rgba(255,255,255,0.7)" weight="bold" />
                      <Text style={styles.totalText}>
                        {result.scope === 'country' ? tx.country(totalText) : tx.world(totalText)}
                      </Text>
                    </View>
                  </View>
                  <View style={{ gap: 8, marginTop: 12 }}>
                    {question.options.map((o, i) => {
                      const mine = o.key === myKey;
                      const width = bars[i].interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });
                      return (
                        <View key={o.key} style={[styles.bar, mine && styles.barMine]}>
                          <Animated.View
                            style={[styles.barFill, { width, backgroundColor: mine ? AMBER : 'rgba(255,255,255,0.16)' }]}
                          />
                          <Text style={[styles.barLabel, mine && styles.barTextMine]} numberOfLines={1}>
                            {optionLabel(o, lang)}
                          </Text>
                          <Text style={[styles.barPct, mine && styles.barTextMine]}>%{pctOf(o.key)}</Text>
                        </View>
                      );
                    })}
                  </View>
                </Animated.View>

                <Text style={styles.tomorrow}>{tx.tomorrow}</Text>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: NAVY,
  },
  offscreen: {
    position: 'absolute',
    left: -STORY_W * 3,
    top: 0,
    width: STORY_W,
    height: STORY_H,
  },
  scroll: {
    paddingHorizontal: 20,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brand: {
    fontFamily: F.bold,
    fontSize: 14,
    letterSpacing: 2.2,
    color: '#ffffff',
  },
  dayPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  dayPillText: {
    fontFamily: F.bold,
    fontSize: 13,
    color: '#ffffff',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    marginTop: 22,
    fontFamily: F.bold,
    fontSize: 15,
    color: AMBER,
  },
  question: {
    marginTop: 6,
    fontFamily: F.bold,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.5,
    color: '#ffffff',
  },
  questionSmall: {
    fontSize: 24,
    lineHeight: 30,
  },
  artCard: {
    width: '100%',
    overflow: 'hidden',
  },
  artCardBig: {
    marginTop: 18,
    aspectRatio: 300 / 240,
    borderRadius: 24,
  },
  artCardSmall: {
    marginTop: 14,
    height: 150,
    borderRadius: 20,
  },
  yoursBox: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    gap: 4,
  },
  yoursLabel: {
    fontFamily: F.medium,
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  yoursText: {
    fontFamily: F.bold,
    fontSize: 20,
    color: '#ffffff',
  },
  openBtn: {
    height: 60,
    borderRadius: 18,
    backgroundColor: AMBER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openText: {
    fontFamily: F.bold,
    fontSize: 19,
    color: NAVY,
  },
  verdictCard: {
    padding: 18,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    gap: 6,
  },
  verdictHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  verdictTitle: {
    flex: 1,
    fontFamily: F.bold,
    fontSize: 25,
    letterSpacing: -0.4,
    color: NAVY,
  },
  pctBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: AMBER,
  },
  pctBadgeText: {
    fontFamily: F.bold,
    fontSize: 18,
    color: NAVY,
  },
  verdictText: {
    fontFamily: F.medium,
    fontSize: 16,
    lineHeight: 22,
    color: '#16161a',
  },
  clubBox: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#FFF3E4',
  },
  clubPre: {
    fontFamily: F.bold,
    fontSize: 14,
    color: AMBER_FG,
  },
  clubName: {
    fontFamily: F.bold,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.6,
    color: NAVY,
  },
  shareBtn: {
    height: 58,
    borderRadius: 18,
    backgroundColor: AMBER,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  shareText: {
    fontFamily: F.bold,
    fontSize: 19,
    color: NAVY,
  },
  closeTextBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeText: {
    fontFamily: F.bold,
    fontSize: 16,
    color: '#ffffff',
  },
  listBox: {
    marginTop: 10,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  listHead: {
    gap: 6,
  },
  listTitle: {
    fontFamily: F.bold,
    fontSize: 17,
    color: '#ffffff',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  totalText: {
    fontFamily: F.medium,
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  bar: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
  },
  barMine: {
    backgroundColor: '#FFF3E4',
    borderWidth: 2,
    borderColor: AMBER,
  },
  barFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  barLabel: {
    flex: 1,
    fontFamily: F.bold,
    fontSize: 16,
    color: '#ffffff',
  },
  barTextMine: {
    color: NAVY,
  },
  barPct: {
    fontFamily: F.bold,
    fontSize: 16,
    color: '#ffffff',
  },
  tomorrow: {
    marginTop: 18,
    textAlign: 'center',
    fontFamily: F.medium,
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
});
