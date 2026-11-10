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
  Modal,
  PixelRatio,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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
  crowdShown,
  istanbulToday,
  istanbulYesterday,
  dayLabel,
  optionLabel,
  PendingReveal,
  questionText,
  SERIES_LENGTH,
  THEMES,
  themeOf,
} from '@/lib/dailyQuestion';
import { StoryShareCard, STORY_H, STORY_W } from '@/components/StoryShareCard';
import { track } from '@/lib/analytics';
import { activityName } from '@/lib/i18n';
import { getTier, TierId } from '@/lib/badges';
import { fetchSelamSummary, SelamSummary } from '@/lib/selam';


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
    world: (n: string) => `Dünyadan ${n} kişi`,
    country: (n: string) => `Ülkenden ${n} kişi`,
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
    selamKicker: 'BUGÜN SANA',
    selamKickerY: 'DÜN SANA',
    selamTitle: (n: string) => `${n} kişi selam verdi 👋`,
  },
  en: {
    day: (n: number) => `Day ${n}/${SERIES_LENGTH}`,
    titleToday: 'Results are in',
    titleYesterday: "Yesterday's result",
    open: 'Reveal the result',
    yours: 'Your answer',
    allAnswers: 'All answers',
    world: (n: string) => `${n} people worldwide`,
    country: (n: string) => `${n} people in your country`,
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
    selamKicker: 'TODAY',
    selamKickerY: 'YESTERDAY',
    selamTitle: (n: string) => `${n} people said hi to you 👋`,
  },
};

type Props = {
  data: PendingReveal;
  lang: Lang;
  // shareUri doluysa: kapandıktan sonra bu görseli paylaş
  onClose: (shareUri: string | null) => void;
  autoReveal?: boolean; // Anketler sekmesinden açılınca "Sonucu aç" beklemeden göster
  kicker?: string; // üstteki sarı başlığı değiştirmek için (ör. '4 Kasım')
  source?: 'gate' | 'polls'; // ölçüm için: girişte mi, Anketler sekmesinden mi açıldı
};

export function DailyResultReveal({ data, lang, onClose, autoReveal = false, kicker, source = 'gate' }: Props) {
  const insets = useSafeAreaInsets();
  // Modal içinde bazı cihazlarda insets 0 gelebiliyor; açılıştaki değerle tamamla
  const topInset = Math.max(insets.top, initialWindowMetrics?.insets.top ?? 0, Platform.OS === 'ios' ? 44 : 24);
  const bottomInset = Math.max(insets.bottom, initialWindowMetrics?.insets.bottom ?? 0);

  const tx = (lang as string) === 'tr' ? TEXT.tr : TEXT.en;
  const { question, myKey, result, isYesterday } = data;
  const theme = themeOf(question);
  const t = THEMES[theme];

  const [visible, setVisible] = useState(true);
  // Anketler sekmesinden açılınca ara ekran olmadan doğrudan sonuç düzeniyle başlar
  // 1.5.2: soruyu cevaplamamış (akşam izleyicisi) ise kendi cevabı yok; doğrudan sonuç
  const watcher = !myKey;
  const [revealed, setRevealed] = useState(autoReveal || watcher);
  const [sharing, setSharing] = useState(false);
  const [tier, setTier] = useState<TierId | null>(null);
  const [selam, setSelam] = useState<SelamSummary | null>(null);
  const shareRef = useRef<View>(null);

  const bars = useRef(question.options.map(() => new Animated.Value(0))).current;
  const verdictAnim = useRef(new Animated.Value(0)).current;
  const listAnim = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  const pctOf = (key: string | null) => (key ? Math.round(result.pct[key] ?? 0) : 0);
  const pcts = question.options.map((o) => pctOf(o.key));
  const maxPct = Math.max(...pcts);
  const minPct = Math.min(...pcts);
  // İzleyici için en çok seçilen cevap öne çıkar
  const topKey = question.options[pcts.indexOf(maxPct)]?.key ?? question.options[0].key;
  const shownKey = myKey ?? topKey;
  const myPct = pctOf(shownKey);
  const myOption = question.options.find((o) => o.key === shownKey) ?? question.options[0];
  const myLabel = optionLabel(myOption, lang);
  const club = clubName(myOption, lang);
  const qText = questionText(question, lang) ?? question.question_tr;
  // Kişi sayısı sadece 3.000'i geçtiyse (net adet) gösterilir; altında hiç yazılmaz
  const totalShown = crowdShown(result.total);
  const totalText = totalShown ? totalShown.toLocaleString((lang as string) === 'tr' ? 'tr-TR' : 'en-US') : null;

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
    track('result_shown', { day: question.day_date, source: watcher ? 'evening' : source });
    getTier().then(setTier).catch(() => {});
    // Selam şeridi sadece bugünün ya da dünün sonucunda
    const selamDay = question.day_date === istanbulToday() || question.day_date === istanbulYesterday();
    (selamDay ? fetchSelamSummary(question.day_date) : Promise.resolve(null))
      .then((s) => {
        setSelam(s);
        if (s) track('selam_seen', { day: question.day_date, total: s.total });
      })
      .catch(() => {});
    if (autoReveal || watcher) {
      const timer = setTimeout(playResult, 150);
      return () => clearTimeout(timer);
    }
  }, []);

  // "Sonucu aç" (sadece girişteki akışta)
  function reveal() {
    if (revealed) return;
    track('result_opened', { day: question.day_date, verdict });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setRevealed(true);
    playResult();
  }

  // Sonuç animasyonu: önce karar kartı, sonra yüzdeler
  function playResult() {
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
      track('story_shared', { day: question.day_date, source, pct: myPct });
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
            tier={tier}
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

            {selam ? (
              <View style={styles.selamBanner}>
                <Text style={styles.selamKicker}>{question.day_date === istanbulToday() ? tx.selamKicker : tx.selamKickerY}</Text>
                <Text style={styles.selamTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                  {tx.selamTitle(selam.total.toLocaleString((lang as string) === 'tr' ? 'tr-TR' : 'en-US'))}
                </Text>
                <Text style={styles.selamBy} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                  {selam.byActivity
                    .slice(0, 3)
                    .map((r) => `${activityName(r.id, lang)} ${r.count.toLocaleString((lang as string) === 'tr' ? 'tr-TR' : 'en-US')}`)
                    .join(' · ')}
                </Text>
              </View>
            ) : null}

            {!revealed ? (
              <>
                <Text style={styles.kicker}>{kicker ?? (isYesterday ? tx.titleYesterday : tx.titleToday)}</Text>
                <Text style={styles.question}>{qText}</Text>

                <View style={[styles.artCard, { backgroundColor: t.bg }]}>
                  {question.art_svg ? <SvgXml xml={question.art_svg} width="100%" height="100%" /> : null}
                </View>

                <View style={{ gap: 14, marginTop: 22 }}>
                  <View style={styles.yoursBox}>
                    <Text style={styles.yoursLabel}>{tx.yours}</Text>
                    <Text style={styles.yoursText}>{myLabel}</Text>
                  </View>
                  <Pressable onPress={reveal} style={styles.openBtn} accessibilityRole="button">
                    <Text style={styles.openText}>{tx.open}</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                {/* Sonuç açıldıktan sonra: kompakt düzen, tek ekrana sığsın */}
                <View style={styles.qRow}>
                  <View style={[styles.thumb, { backgroundColor: t.bg }]}>
                    {question.art_svg ? <SvgXml xml={question.art_svg} width="100%" height="100%" /> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.kickerSmall}>
                      {kicker ?? (isYesterday ? tx.titleYesterday : tx.titleToday)}
                    </Text>
                    <Text style={styles.questionSmall} numberOfLines={3}>
                      {qText}
                    </Text>
                  </View>
                </View>

                {/* 1) Karar + kulüp */}
                <Animated.View
                  style={[styles.verdictCard, { opacity: verdictAnim, transform: [{ scale: verdictScale }] }]}
                >
                  <View style={styles.verdictHead}>
                    <Text style={styles.verdictTitle}>
                      {watcher ? ((lang as string) === 'tr' ? 'Türkiye’nin cevabı' : "Everyone's answer") : tx[verdict]}
                    </Text>
                    <View style={styles.pctBadge}>
                      <Text style={styles.pctBadgeText}>%{myPct}</Text>
                    </View>
                  </View>
                  <Text style={styles.verdictText}>
                    {watcher
                      ? (lang as string) === 'tr'
                        ? `Çoğunluk "${myLabel}" dedi.`
                        : `Most people said "${myLabel}".`
                      : verdictText}
                  </Text>
                  {club ? (
                    <View style={styles.clubBox}>
                      <Text style={styles.clubLine} numberOfLines={2}>
                        <Text style={styles.clubPre}>
                          {watcher ? ((lang as string) === 'tr' ? 'Kazanan kulüp:' : 'Winning club:') : tx.clubPre}{' '}
                        </Text>
                        <Text style={styles.clubName}>{club}</Text>
                        {tx.clubPost && !watcher ? <Text style={styles.clubPre}> {tx.clubPost}</Text> : null}
                      </Text>
                    </View>
                  ) : null}
                </Animated.View>

                {/* 2) Paylaş (kapatmak için üstteki çarpı) */}
                {watcher ? (
                  <Animated.View style={[styles.watchBox, { opacity: verdictAnim }]}>
                    <Text style={styles.watchText}>
                      {(lang as string) === 'tr'
                        ? 'Bugün cevaplamadın. Yarın sen de cevapla, hangi kulüpte olduğunu gör 👀'
                        : "You didn't answer today. Answer tomorrow and see which club you're in 👀"}
                    </Text>
                  </Animated.View>
                ) : (
                  <Animated.View style={{ opacity: verdictAnim, marginTop: 12 }}>
                    <Pressable onPress={share} style={styles.shareBtn} accessibilityRole="button" disabled={sharing}>
                      <ShareNetwork size={22} color={NAVY} weight="bold" />
                      <Text style={styles.shareText}>{tx.share}</Text>
                    </Pressable>
                  </Animated.View>
                )}

                {/* 3) Tüm cevaplar en altta */}
                <Animated.View style={[styles.listBox, { opacity: listAnim }]}>
                  <View style={styles.listHead}>
                    <Text style={styles.listTitle}>{tx.allAnswers}</Text>
                    {totalText ? (
                      <View style={styles.totalRow}>
                        <UsersThree size={15} color="rgba(255,255,255,0.7)" weight="bold" />
                        <Text style={styles.totalText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                          {result.scope === 'country' ? tx.country(totalText) : tx.world(totalText)}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={{ gap: 6, marginTop: 10 }}>
                    {question.options.map((o, i) => {
                      const mine = o.key === shownKey;
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
              </>
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
  watchBox: {
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  watchText: { fontFamily: F.medium, fontSize: 14.5, lineHeight: 20, color: '#ffffff', textAlign: 'center' },
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
  selamBanner: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: AMBER,
  },
  selamKicker: {
    fontFamily: F.bold,
    fontSize: 12,
    letterSpacing: 1.1,
    color: NAVY,
    opacity: 0.8,
  },
  selamTitle: {
    fontFamily: F.bold,
    fontSize: 22,
    lineHeight: 27,
    color: NAVY,
  },
  selamBy: {
    marginTop: 2,
    fontFamily: F.bold,
    fontSize: 13,
    color: NAVY,
    opacity: 0.85,
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
  artCard: {
    marginTop: 18,
    width: '100%',
    aspectRatio: 300 / 240,
    borderRadius: 24,
    overflow: 'hidden',
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
    marginTop: 16,
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    gap: 4,
  },
  verdictHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  verdictTitle: {
    flex: 1,
    fontFamily: F.bold,
    fontSize: 23,
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
    fontSize: 15,
    lineHeight: 21,
    color: '#16161a',
  },
  clubBox: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#FFF3E4',
  },
  clubPre: {
    fontFamily: F.bold,
    fontSize: 15,
    color: AMBER_FG,
  },
  clubName: {
    fontFamily: F.bold,
    fontSize: 19,
    color: NAVY,
  },
  shareBtn: {
    height: 54,
    borderRadius: 16,
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
  listBox: {
    marginTop: 18,
  },
  listHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  listTitle: {
    fontFamily: F.bold,
    fontSize: 16,
    color: '#ffffff',
  },
  totalRow: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  totalText: {
    flexShrink: 1,
    fontFamily: F.medium,
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
  bar: {
    minHeight: 44,
    borderRadius: 12,
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
    fontSize: 15,
    color: '#ffffff',
  },
  barTextMine: {
    color: NAVY,
  },
  barPct: {
    fontFamily: F.bold,
    fontSize: 15,
    color: '#ffffff',
  },
  qRow: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  thumb: {
    width: 84,
    height: 68,
    borderRadius: 16,
    overflow: 'hidden',
  },
  kickerSmall: {
    fontFamily: F.bold,
    fontSize: 13,
    color: AMBER,
  },
  questionSmall: {
    marginTop: 2,
    fontFamily: F.bold,
    fontSize: 21,
    lineHeight: 26,
    letterSpacing: -0.3,
    color: '#ffffff',
  },
  clubLine: {
    fontFamily: F.bold,
    fontSize: 15,
    color: AMBER_FG,
  },
});
