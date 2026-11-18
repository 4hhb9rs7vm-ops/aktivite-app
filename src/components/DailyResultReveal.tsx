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
import { PaperPlaneTilt, ShareNetwork, UsersThree, X } from 'phosphor-react-native';
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
  nextHint,
  themeOf,
  fetchGroupLine,
  type GroupLine,
} from '@/lib/dailyQuestion';
import { StoryShareCard, STORY_H, STORY_W } from '@/components/StoryShareCard';
import { track } from '@/lib/analytics';
import { noteResultSeen } from '@/lib/overlay';
import { activityName } from '@/lib/i18n';
import { getTier, TierId } from '@/lib/badges';
import { fetchSelamSummary, SelamSummary } from '@/lib/selam';
import { acceptNotifAsk, canAskNotif, noteNotifAsk } from '@/lib/notifAsk';
import { hasNotificationPermission, scheduleResultNotification } from '@/lib/notifications';
import { registerPushToken } from '@/lib/ask';
import { questionMessage, shareLink } from '@/lib/invite';
import {
  fetchPredictionWeeks,
  getMyPrediction,
  invalidatePredictionCache,
  isHit,
  POINTS_HIT,
  POINTS_MISS,
} from '@/lib/prediction';


const NAVY = '#0F2A52';
const AMBER = '#F4B88A'; // 1.5.6: sarı yerine şeftali (sarı + lacivert birleşimi kullanılmıyor)
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
    // 1.5.9: cevaptan hemen sonra gösterilen "şu ana kadar" sonucu
    titleLive: 'ŞU ANA KADAR',
    titleEarly: 'İLK CEVAPLAYANLARDANSIN 🌅',
    majorityLive: (p: number, o: string) => `Şu ana kadar %${p} senin gibi "${o}" dedi.`,
    minorityLive: (p: number, o: string) => `Şu ana kadar sadece %${p} senin gibi "${o}" dedi.`,
    earlyTitle: 'Sonuç şekilleniyor',
    earlyText: (o: string) => `Cevabın: "${o}". Yeterince kişi cevaplayınca oranlar açılır; gün içinde tekrar bak.`,
    clubPreLive: 'Şimdilik',
    clubPreEarly: 'Kulübün:',
    liveList: 'Şu ana kadar',
    finalAt: "Kesin sonuç 21:00'de",
    predLive: (o: string) => `🎯 Tahminin: "${o}"`,
    predLiveText: (p: number) => `Kesin sonuç 21:00'de açıklanacak. Tutarsa +${p} puan.`,
    noPredText: 'Çoğunluk akşama kadar değişebilir.',
    askYes: "🔔 21:00'de haber ver",
    askNo: 'Şimdi değil',
    askOk: "✓ 21:00'de haber vereceğiz",
    shareStory: 'Hikâyende paylaş',
    shareFriend: 'Arkadaşına gönder',
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
    titleLive: 'SO FAR',
    titleEarly: "YOU'RE AMONG THE FIRST 🌅",
    majorityLive: (p: number, o: string) => `So far ${p}% said "${o}", just like you.`,
    minorityLive: (p: number, o: string) => `So far only ${p}% said "${o}" like you.`,
    earlyTitle: 'The result is taking shape',
    earlyText: (o: string) => `Your answer: "${o}". Percentages open once enough people answer; check back later today.`,
    clubPreLive: "For now you're in the",
    clubPreEarly: 'Your club:',
    liveList: 'So far',
    finalAt: 'Final result at 9 PM',
    predLive: (o: string) => `🎯 Your guess: "${o}"`,
    predLiveText: (p: number) => `The final result is out at 9 PM. +${p} points if you're right.`,
    noPredText: 'The majority can still change by tonight.',
    askYes: '🔔 Notify me at 9 PM',
    askNo: 'Not now',
    askOk: "✓ We'll let you know at 9 PM",
    shareStory: 'Share to Story',
    shareFriend: 'Send to a friend',
  },
};

type Props = {
  data: PendingReveal;
  lang: Lang;
  // shareUri doluysa: kapandıktan sonra bu görseli paylaş.
  // 1.5.9: shareMessage doluysa görsel yerine bu yazılı mesaj paylaşılır ("Arkadaşına gönder")
  onClose: (shareUri: string | null, shareMessage?: string) => void;
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
  // 1.5.9: 'live' = cevaptan hemen sonra "şu ana kadar" sonucu · 'early' = henüz oran yok
  const mode = data.mode ?? 'final';
  const live = mode !== 'final';
  const early = mode === 'early';
  const hint = nextHint(question, lang);
  // 1.5.8: "senin grubun ne dedi" satırı (grupta en az 10 cevap varsa)
  const [group, setGroup] = useState<GroupLine | null>(null);
  useEffect(() => {
    let alive = true;
    fetchGroupLine(question)
      .then((g) => {
        if (alive) setGroup(g);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [question]);
  const groupOption = group ? question.options.find((o) => o.key === group.optionKey) : null;
  const groupKicker = !group
    ? ''
    : (lang as string) === 'tr'
      ? group.segment === 'student'
        ? 'ÖĞRENCİLER NE DEDİ?'
        : group.segment === 'worker'
          ? 'ÇALIŞANLAR NE DEDİ?'
          : 'EVDE OLANLAR NE DEDİ?'
      : group.segment === 'student'
        ? 'WHAT DID STUDENTS SAY?'
        : group.segment === 'worker'
          ? 'WHAT DID WORKERS SAY?'
          : 'WHAT DID PEOPLE AT HOME SAY?';
  const theme = themeOf(question);
  const t = THEMES[theme];

  const [visible, setVisible] = useState(true);
  // Anketler sekmesinden açılınca ara ekran olmadan doğrudan sonuç düzeniyle başlar
  // 1.5.2: soruyu cevaplamamış (akşam izleyicisi) ise kendi cevabı yok; doğrudan sonuç
  const watcher = !myKey;
  const [revealed, setRevealed] = useState(autoReveal || watcher || live);
  const [sharing, setSharing] = useState(false);
  // 1.5.9: canlı sonuçta bildirim izni ('ask': soruluyor · 'ok': izin var · 'no': gösterme)
  const [askNotif, setAskNotif] = useState<'no' | 'ask' | 'ok'>('no');
  const [tier, setTier] = useState<TierId | null>(null);
  const [selam, setSelam] = useState<SelamSummary | null>(null);
  // 1.5.4: Tahmin Oyunu sonucu
  const [prediction, setPrediction] = useState<string | null>(null);
  const [weekPoints, setWeekPoints] = useState<number | null>(null);
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

  const predOption = prediction ? question.options.find((o) => o.key === prediction) ?? null : null;
  const predHit = !!prediction && isHit(question, result, prediction);

  let verdict: 'majority' | 'minority' | 'middle' = 'middle';
  if (myPct === maxPct && myPct > 0) verdict = 'majority';
  else if (myPct === minPct || myPct < 20) verdict = 'minority';
  const verdictText = live
    ? verdict === 'minority'
      ? tx.minorityLive(myPct, myLabel)
      : tx.majorityLive(myPct, myLabel)
    : verdict === 'majority'
      ? tx.majorityText(myPct, myLabel)
      : verdict === 'minority'
        ? tx.minorityText(myPct, myLabel)
        : tx.middleText(myPct, myLabel);
  const headKicker = kicker ?? (early ? tx.titleEarly : live ? tx.titleLive : isYesterday ? tx.titleYesterday : tx.titleToday);

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    track('result_shown', { day: question.day_date, source: live ? mode : watcher ? 'evening' : source });
    getTier().then(setTier).catch(() => {});
    if (live) {
      // Kesin sonuç 21:00'de: izin varsa onay satırı, yoksa (ve sorulabiliyorsa) izin düğmesi
      hasNotificationPermission()
        .then(async (has) => {
          if (has) {
            setAskNotif('ok');
            return;
          }
          if (await canAskNotif()) {
            setAskNotif('ask');
            noteNotifAsk().catch(() => {});
            track('notif_ask_shown', { source: 'live' });
          }
        })
        .catch(() => {});
    }
    // Selam şeridi sadece bugünün ya da dünün sonucunda (canlı sonuçta yok; selamlar ana ekranda)
    const selamDay = !live && (question.day_date === istanbulToday() || question.day_date === istanbulYesterday());
    (selamDay ? fetchSelamSummary(question.day_date) : Promise.resolve(null))
      .then((s) => {
        setSelam(s);
        if (s) track('selam_seen', { day: question.day_date, total: s.total });
      })
      .catch(() => {});
    if (!watcher) {
      getMyPrediction(question)
        .then((p) => {
          setPrediction(p);
          if (p && !live) {
            invalidatePredictionCache();
            fetchPredictionWeeks(true)
              .then((w) => setWeekPoints(w ? w.current.points : null))
              .catch(() => {});
          }
        })
        .catch(() => {});
    }
    if (autoReveal || watcher || live) {
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

  function finish(uri: string | null, message?: string) {
    setVisible(false);
    noteResultSeen(live ? 'answer' : undefined); // ana ekran "peki şu an ne yapıyorsun?" satırını göstersin
    onClose(uri, message);
  }

  // 1.5.9 "Arkadaşına gönder": soruyu soran yazılı mesaj, bağlantı içinde
  async function shareToFriend() {
    if (sharing) return;
    setSharing(true);
    Haptics.selectionAsync().catch(() => {});
    try {
      const link = await shareLink();
      const msg = questionMessage({
        question: qText,
        answer: myLabel,
        club,
        pct: early ? null : myPct,
        live,
        url: link.url,
        lang,
      });
      track('app_share', { from: 'question_message', invite: link.invite });
      finish(null, msg);
    } catch {
      setSharing(false);
    }
  }

  async function onNotifYes() {
    Haptics.selectionAsync().catch(() => {});
    const r = await acceptNotifAsk();
    track('notif_ask_answer', { answer: r });
    if (r === 'granted') {
      setAskNotif('ok');
      registerPushToken(true).catch(() => {});
      scheduleResultNotification(question.day_date, club);
    } else setAskNotif('no');
  }

  function onNotifNo() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    track('notif_ask_answer', { answer: 'later' });
    setAskNotif('no');
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
            pct={early ? null : myPct}
            live={live}
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
              {/* 1.5.4: "Gün 12/30" yerine tarih (herkesin kendi günü var, kimse geç kalmış hissetmesin) */}
              <View style={styles.dayPill}>
                <Text style={styles.dayPillText}>{dayLabel(question.day_date, lang)}</Text>
              </View>
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
                    <Text style={styles.kickerSmall}>{headKicker}</Text>
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
                      {early
                        ? tx.earlyTitle
                        : watcher
                          ? (lang as string) === 'tr'
                            ? 'Şu An’ın cevabı'
                            : "Everyone's answer"
                          : tx[verdict]}
                    </Text>
                    {early ? null : (
                      <View style={styles.pctBadge}>
                        <Text style={styles.pctBadgeText}>%{myPct}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.verdictText}>
                    {early
                      ? tx.earlyText(myLabel)
                      : watcher
                      ? (lang as string) === 'tr'
                        ? `Çoğunluk "${myLabel}" dedi.`
                        : `Most people said "${myLabel}".`
                      : verdictText}
                  </Text>
                  {club ? (
                    <View style={styles.clubBox}>
                      <Text style={styles.clubLine} numberOfLines={2}>
                        <Text style={styles.clubPre}>
                          {early
                            ? tx.clubPreEarly
                            : live
                              ? tx.clubPreLive
                              : watcher
                                ? (lang as string) === 'tr'
                                  ? 'Kazanan kulüp:'
                                  : 'Winning club:'
                                : tx.clubPre}{' '}
                        </Text>
                        <Text style={styles.clubName}>{club}</Text>
                        {tx.clubPost && !watcher && !early ? <Text style={styles.clubPre}> {tx.clubPost}</Text> : null}
                      </Text>
                    </View>
                  ) : null}
                </Animated.View>

                {/* 1.5.9: canlı sonuçta tahmin henüz sonuçlanmadı; kesin sonuç 21:00'de, izin burada sorulur */}
                {live ? (
                  <Animated.View style={[styles.predCard, styles.predCardHit, { opacity: verdictAnim }]}>
                    <Text style={styles.predTitle} numberOfLines={2}>
                      {predOption ? tx.predLive(optionLabel(predOption, lang)) : tx.finalAt}
                    </Text>
                    <Text style={styles.predText}>{predOption ? tx.predLiveText(POINTS_HIT) : tx.noPredText}</Text>
                    {askNotif === 'ask' ? (
                      <View style={styles.askRow}>
                        <Pressable onPress={onNotifYes} style={styles.askYes} accessibilityRole="button">
                          <Text style={styles.askYesText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                            {tx.askYes}
                          </Text>
                        </Pressable>
                        <Pressable onPress={onNotifNo} style={styles.askNo} accessibilityRole="button" hitSlop={8}>
                          <Text style={styles.askNoText}>{tx.askNo}</Text>
                        </Pressable>
                      </View>
                    ) : askNotif === 'ok' ? (
                      <Text style={styles.askOk}>{tx.askOk}</Text>
                    ) : null}
                  </Animated.View>
                ) : null}

                {/* 1.5.4: Tahmin sonucu */}
                {!live && !watcher && predOption ? (
                  <Animated.View style={[styles.predCard, predHit && styles.predCardHit, { opacity: verdictAnim }]}>
                    <Text style={styles.predTitle}>
                      {predHit
                        ? (lang as string) === 'tr'
                          ? `🎯 Tahminin tuttu! +${POINTS_HIT} puan`
                          : `🎯 You guessed it! +${POINTS_HIT} points`
                        : (lang as string) === 'tr'
                          ? `Tahminin tutmadı · +${POINTS_MISS} puan`
                          : `Not this time · +${POINTS_MISS} point`}
                    </Text>
                    <Text style={styles.predText} numberOfLines={2}>
                      {(lang as string) === 'tr'
                        ? `Tahminin: "${optionLabel(predOption, lang)}"${weekPoints !== null ? ` · Bu hafta ${weekPoints} puan` : ''}`
                        : `Your guess: "${optionLabel(predOption, lang)}"${weekPoints !== null ? ` · ${weekPoints} points this week` : ''}`}
                    </Text>
                  </Animated.View>
                ) : null}

                {group && groupOption ? (
                  <Animated.View style={[styles.hintCard, { opacity: verdictAnim }]}>
                    <Text style={styles.groupPct}>%{group.pct}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.hintKicker}>{groupKicker}</Text>
                      <Text style={styles.hintText}>“{optionLabel(groupOption, lang)}”</Text>
                    </View>
                  </Animated.View>
                ) : null}

                {/* 1.5.6: yarının sorusundan ipucu (yalnızca bugünün sonucunda; soru açık edilmez) */}
                {hint && !isYesterday && !live ? (
                  <Animated.View style={[styles.hintCard, { opacity: verdictAnim }]}>
                    <Text style={styles.hintEmoji}>👀</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.hintKicker}>{(lang as string) === 'tr' ? 'YARININ SORUSU' : "TOMORROW'S QUESTION"}</Text>
                      <Text style={styles.hintText}>{hint}</Text>
                    </View>
                  </Animated.View>
                ) : null}

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
                      <Text style={styles.shareText}>{live ? tx.shareStory : tx.share}</Text>
                    </Pressable>
                    {/* 1.5.9: yazılı mesajla gönderme (soruyu arkadaşına sorar, bağlantı içinde) */}
                    <Pressable onPress={shareToFriend} style={styles.friendBtn} accessibilityRole="button" disabled={sharing}>
                      <PaperPlaneTilt size={19} color="#ffffff" weight="bold" />
                      <Text style={styles.friendText}>{tx.shareFriend}</Text>
                    </Pressable>
                  </Animated.View>
                )}

                {/* 3) Tüm cevaplar en altta (oran henüz yoksa hiç gösterilmez) */}
                {early ? null : (
                <Animated.View style={[styles.listBox, { opacity: listAnim }]}>
                  <View style={styles.listHead}>
                    <Text style={styles.listTitle}>{live ? tx.liveList : tx.allAnswers}</Text>
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
                )}
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
  askRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  askYes: { flex: 1, backgroundColor: AMBER, borderRadius: 14, paddingVertical: 11, paddingHorizontal: 10, alignItems: 'center' },
  askYesText: { fontFamily: F.bold, fontSize: 15, color: NAVY },
  askNo: { paddingVertical: 11, paddingHorizontal: 10 },
  askNoText: { fontFamily: F.bold, fontSize: 13.5, color: 'rgba(255,255,255,0.75)' },
  askOk: { fontFamily: F.bold, fontSize: 13.5, color: '#ffffff', marginTop: 8 },
  friendBtn: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  friendText: { fontFamily: F.bold, fontSize: 15.5, color: '#ffffff' },
  predCard: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    gap: 4,
  },
  hintCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  hintEmoji: { fontSize: 26 },
  groupPct: { fontFamily: F.bold, fontSize: 22, color: AMBER },
  hintKicker: { fontFamily: F.bold, fontSize: 10.5, letterSpacing: 1, color: '#A5B4FC' },
  hintText: { fontFamily: F.bold, fontSize: 15.5, lineHeight: 21, color: '#ffffff', marginTop: 2 },
  predCardHit: { backgroundColor: 'rgba(79,70,229,0.55)', borderColor: '#A5B4FC' },
  predTitle: { fontFamily: F.bold, fontSize: 17, color: '#ffffff' },
  predText: { fontFamily: F.medium, fontSize: 13.5, color: 'rgba(255,255,255,0.82)' },
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
