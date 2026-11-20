// Günün Sorusu — giriş kartı.
// Uygulama açılınca önce ana ekran görünür, ardından arka plan koyulaşır ve
// alttan beyaz, yüzen bir kart gelir: "Başlamadan önce kısa bir soru".
// Kart ana ekranın lacivert üst bandından bilerek farklı (beyaz) tutuldu; böylece
// uygulamanın bir parçası değil, üstüne açılan ayrı bir anket gibi görünür.
// "Bugün geç" ve "1 hafta sorma" seçenekleri var. Cevap verilince akşam 21:00'i hatırlatır.
// Sonuç akışı da buradan yönetilir:
//  - 21:00'den sonra açılışta: bugünkü soruya cevap verildiyse önce sonuç ekranı (DailyResultReveal).
//  - Ertesi gün 21:00'den önce: dünün sonucuna bakılmadıysa önce o, ardından bugünün sorusu.
//  - "Story'de paylaş" seçilirse sonuç ekranı kapanır, sonra paylaşma penceresi açılır.
// _layout.tsx içine tek satırla eklenir; index.tsx'e dokunmaz.
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState,
  Dimensions,
  Easing,
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { ChatCircleDots, CheckCircle, Fire } from 'phosphor-react-native';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
  useFonts,
} from '@expo-google-fonts/dm-sans';
import { Lang, loadLang } from '@/lib/i18n';
import {
  clubName,
  DailyQuestion,
  fetchLiveResult,
  fetchResults,
  fetchTodayQuestion,
  findPendingReveal,
  inEveningWindow,
  isBeforeResults,
  gateAllowedToday,
  getAnsweredDayCount,
  getMyAnswer,
  getStreak,
  markRevealed,
  optionLabel,
  PendingReveal,
  questionText,
  SERIES_LENGTH,
  skipToday,
  noteGateShown,
  snoozeWeek,
  submitAnswer,
} from '@/lib/dailyQuestion';
import { DailyResultReveal } from '@/components/DailyResultReveal';
import { scheduleResultNotification } from '@/lib/notifications';
import { acceptNotifAsk, canAskNotif, noteNotifAsk } from '@/lib/notifAsk';
import { registerPushToken } from '@/lib/ask';
import { track } from '@/lib/analytics';
import { isOverlayBusy, setOverlayBusy, whenOverlayFree } from '@/lib/overlay';
import { isFirstDay } from '@/lib/firstRun';
import { checkBadges } from '@/lib/badges';
import { claimShareBonus, POINTS_HIT, pointsChanged, submitPrediction } from '@/lib/prediction';
import { maybeAskReview } from '@/lib/review';

// index.tsx'teki açılış ekranı 3,5 sn sürüyor. Kart, ana ekran kısa bir an göründükten sonra gelsin.
const SHOW_DELAY_MS = 4300;

// Deneme modu: Expo Go'da (geliştirme) kart her açılışta çıkar; cevaplanmış olsa bile.
// Sonuç ekranı da: bugünün sonucu hesaplanmışsa (Supabase'te elle çalıştırınca) saat beklemeden çıkar.
// Mağazaya giden sürümde __DEV__ otomatik olarak false olur, normal kurallar geçerli.
// Geliştirirken kartın her seferinde çıkmasını istemezsen: const TEST_MODE = false;
const TEST_MODE = __DEV__;

// Uygulamanın kendi renkleri (index.tsx ile aynı)
const NAVY = '#0F2A52';
const INK = '#16161a';
const SOFT = '#5b5b66';
const AMBER_BG = '#FFF3E4';
const AMBER_FG = '#B45309';
const OPTION_BG = '#F3F4F8';
const F = { regular: 'DMSans_400Regular', medium: 'DMSans_500Medium', bold: 'DMSans_700Bold' };
const SCREEN_H = Dimensions.get('window').height;

type Phase = 'question' | 'sending' | 'predict' | 'predicting' | 'done' | 'error';

const TEXT = {
  tr: {
    intro: 'Başlamadan önce kısa bir soru',
    label: 'GÜNÜN SORUSU',
    day: (n: number) => (n === 1 ? 'İlk günün' : `${n}. günün`),
    hint: "Herkese aynı soru. Sonuç akşam 21:00'de.",
    hintLate: 'Sonuç açıklandı. Cevapla, herkesin ne dediğini hemen gör.',
    introLate: 'Günün sorusu seni bekliyor',
    doneLate: 'Sonuca Anketler sekmesinden bakabilirsin.',
    askTitle: "Sonuç 21:00'de açıklanacak",
    askText: 'Çoğunluk ne dedi, tahminin tuttu mu? Açıklanınca sana haber verelim.',
    askYes: 'Haber ver',
    askNo: 'Şimdi değil',
    askNote: 'Gereksiz bildirim göndermeyiz.',
    askDone: "✓ Tamam, 21:00'de haber vereceğiz.",
    predictIntro: 'Cevabın alındı ✓ Şimdi bonus tur',
    predictAbout: 'Soru',
    predictLabel: 'BONUS · TAHMİN ET 🎯',
    predictQ: "Sence Şu An'daki çoğunluk ne dedi?",
    predictHint: (p: number) => `Bilirsen +${p} puan. Sonuç 21:00'de.`,
    yourAnswer: 'Senin cevabın',
    predictSkip: 'Tahmin etmeden geç',
    yourPrediction: (o: string) => `🎯 Tahminin: ${o}`,
    earned: '+5 puan · Günün Sorusu',
    skip: 'Bugün geç',
    snooze: '1 hafta sorma',
    doneTitle: 'Cevabın kaydedildi',
    doneClub: (club: string) => `Akşam 21:00'de sonuç açıklanıyor. Bakalım ${club} ne kadar kalabalık?`,
    doneGeneric: "Akşam 21:00'de kaç kişinin senin gibi cevap verdiğini göreceksin.",
    streak: (n: number) => `${n} günlük seri`,
    continue: 'Uygulamaya geç',
    shareTitle: 'Günün Sorusu',
    error: 'Bağlantı kurulamadı. Tekrar dener misin?',
    retry: 'Tekrar dene',
  },
  en: {
    intro: 'A quick question before you start',
    label: 'QUESTION OF THE DAY',
    day: (n: number) => (n === 1 ? 'Your first day' : `Your day ${n}`),
    hint: 'Same question for everyone. Results at 9 pm.',
    hintLate: 'The result is out. Answer and see what everyone said.',
    introLate: "Today's question is waiting",
    doneLate: 'You can see the result in the Polls tab.',
    askTitle: 'Results are out at 9 PM',
    askText: "What did most people say, and did your guess hit? We'll let you know when it's out.",
    askYes: 'Notify me',
    askNo: 'Not now',
    askNote: "We won't send unnecessary notifications.",
    askDone: "✓ Done. We'll let you know at 9 PM.",
    predictIntro: 'Answer saved ✓ Now a bonus round',
    predictAbout: 'Question',
    predictLabel: 'BONUS · MAKE A GUESS 🎯',
    predictQ: 'What do you think most people said?',
    predictHint: (p: number) => `Guess right for +${p} points. Results at 9 pm.`,
    yourAnswer: 'Your answer',
    predictSkip: 'Skip the guess',
    yourPrediction: (o: string) => `🎯 Your guess: ${o}`,
    earned: '+5 points · Question of the Day',
    skip: 'Skip today',
    snooze: "Don't ask for a week",
    doneTitle: 'Your answer is in',
    doneClub: (club: string) => `Results drop at 9 pm. Let's see how big the ${club} is.`,
    doneGeneric: 'At 9 pm you will see how many people answered like you.',
    streak: (n: number) => `${n}-day streak`,
    continue: 'Go to the app',
    shareTitle: 'Question of the Day',
    error: "Couldn't connect. Try again?",
    retry: 'Try again',
  },
};

export function DailyQuestionGate() {
  useFonts({ DMSans_400Regular, DMSans_500Medium, DMSans_700Bold });
  const insets = useSafeAreaInsets();

  const [visible, setVisible] = useState(false);
  // Açıkken rozet kutlaması beklesin (iPhone'da iki pencere çakışıp ekranı kilitliyordu)
  const [reveal, setReveal] = useState<PendingReveal | null>(null);
  // 1.5.2: sonuç ekranı açıkken de başka pencereler (Kampüs Ligi, rozet) beklesin
  // 1.5.9: soru kartı kapanıp sonuç ekranı açılırken araya başka pencere (rozet) girmesin
  const [handoff, setHandoff] = useState(false);
  const nextReveal = useRef<PendingReveal | null>(null);
  // 1.5.9: 21:00'den sonra sorulan soru (tahmin adımı yok, cevaptan sonra kesin sonuç)
  const [late, setLate] = useState(false);
  useEffect(() => {
    setOverlayBusy('gate', visible || !!reveal || handoff);
    return () => setOverlayBusy('gate', false);
  }, [visible, reveal, handoff]);
  const [question, setQuestion] = useState<DailyQuestion | null>(null);
  const [lang, setLang] = useState<Lang>('tr');
  const [phase, setPhase] = useState<Phase>('question');
  // 1.5.6: cevap verilince bildirim izni sorusu ('ask': soruluyor · 'ok': izin alındı · 'no': gösterme)
  const [askNotif, setAskNotif] = useState<'no' | 'ask' | 'ok'>('no');
  const [picked, setPicked] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [answer, setAnswer] = useState<string | null>(null); // 1.5.4: verilen cevap (tahmin adımında gösterilir)
  const [prediction, setPrediction] = useState<string | null>(null);
  const [personalDay, setPersonalDay] = useState(0);

  const checking = useRef(false);
  const answeredNow = useRef(false); // bu kartta cevap verildi mi (kapanınca rozet kontrolü için)
  const visibleRef = useRef(false);
  const backdrop = useRef(new Animated.Value(0)).current; // arka plan karartması
  const slide = useRef(new Animated.Value(SCREEN_H)).current; // kartın alttan gelişi
  const doneAnim = useRef(new Animated.Value(0)).current;

  const tx = (lang as string) === 'tr' ? TEXT.tr : TEXT.en;
  const compact = phase === 'done' && askNotif === 'ask';

  // Açılışta / uygulamaya dönünce: önce bekleyen sonuç var mı, yoksa bugünün sorusu
  async function check() {
    if (checking.current || visibleRef.current) return;
    checking.current = true;
    try {
      const l: Lang = (await loadLang()) ?? 'tr';
      // 1.5.9: 21:00'den sonra bugünün sorusu cevaplanmadıysa önce soru sorulur (geç cevap).
      // Sorulamıyorsa ("Bugün geç" denmiş, bugün yeterince gösterilmiş) eski akış: sonuç izleyici olarak görünür.
      if (!TEST_MODE && !isBeforeResults() && inEveningWindow()) {
        if (await showQuestionIfNeeded(l, true)) return;
      }
      let pending = await findPendingReveal(l, TEST_MODE);
      // 1.5.4 (26): İlk gün, cevap vermediği bir sorunun sonucunu gösterme (yeni kullanıcıya fazla pencere)
      if (pending && !pending.myKey && !TEST_MODE && (await isFirstDay())) pending = null;
      if (pending) {
        // Başka bir pencere (Kampüs Ligi, rozet) açıksa kapanmasını bekle
        if (isOverlayBusy('gate')) {
          whenOverlayFree(() => {
            checking.current = false;
            check().catch(() => {});
          }, 'gate');
          return;
        }
        visibleRef.current = true;
        setLang(l);
        setReveal(pending);
        await markRevealed(pending.question.day_date);
        return;
      }
      await showQuestionIfNeeded(l);
    } catch {
      // sessizce geç: soru gösterilemezse uygulama normal açılır
    } finally {
      checking.current = false;
    }
  }

  // Dönen değer: soru gösterilecekse true
  async function showQuestionIfNeeded(l: Lang, isLate = false): Promise<boolean> {
    if (!TEST_MODE && !(await gateAllowedToday(isLate))) return false;
    const q = await fetchTodayQuestion();
    if (!q) return false;
    if (!questionText(q, l)) return false; // bu dilde soru yok (ör. Korece): hiç gösterme
    if (!TEST_MODE && (await getMyAnswer(q))) return false; // bugün zaten cevaplamış
    setLate(isLate);
    setStreak(await getStreak());
    setPersonalDay((await getAnsweredDayCount()) + 1);
    setLang(l);
    setQuestion(q);
    setPicked(null);
    setAnswer(null);
    setPrediction(null);
    setPhase('question');
    // Başka bir pencere (Kampüs Ligi, rozet) açıksa kapanınca aç
    whenOverlayFree(() => {
      if (visibleRef.current) return;
      open();
      noteGateShown().catch(() => {});
      track('question_shown', { day: q.day_date, source: isLate ? 'gate_late' : 'gate' });
    }, 'gate');
    return true;
  }

  // Sonuç ekranı kapandı. Paylaş denildiyse modal tamamen kapandıktan sonra paylaşma penceresi,
  // ardından (21:00'den önceyse ve cevaplanmadıysa) bugünün sorusu.
  function onRevealClose(shareUri: string | null, shareMessage?: string) {
    const l = lang;
    setReveal(null);
    visibleRef.current = false;
    // 1.6.0: sonucu gördükten sonra, paylaşmıyorsa ve en az 3 gündür geliyorsa mağaza puanı (kişi başına bir kez)
    if (!shareUri && !shareMessage) maybeAskReview(2500);

    const next = () => {
      // 1.5.9: cevap bu oturumda verildiyse rozet kontrolü sonuç ekranı (ve varsa paylaşım) bittikten sonra
      if (answeredNow.current) {
        answeredNow.current = false;
        setTimeout(() => checkBadges().catch(() => {}), 400);
      }
      setTimeout(() => {
        if (checking.current || visibleRef.current) return;
        checking.current = true;
        showQuestionIfNeeded(l)
          .catch(() => {})
          .finally(() => {
            checking.current = false;
          });
      }, 700);
    };
    if (shareMessage) {
      // "Arkadaşına gönder": yazılı mesaj (bağlantı içinde). Pencere tamamen kapandıktan sonra açılır.
      setTimeout(
        () => {
          Share.share({ message: shareMessage })
            .then((r) => {
              if (r.action !== Share.dismissedAction) claimShareBonus().catch(() => {});
            })
            .catch(() => {})
            .finally(next);
        },
        Platform.OS === 'ios' ? 1200 : 450
      );
      return;
    }
    if (!shareUri) {
      // Sonuç penceresi tamamen kapansın (iPhone'da kapanırken açılan pencere görünmüyor)
      setTimeout(next, Platform.OS === 'ios' ? 500 : 150);
      return;
    }
    setTimeout(
      async () => {
        try {
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(shareUri, {
              mimeType: 'image/jpeg',
              UTI: 'public.jpeg',
              dialogTitle: tx.shareTitle,
            });
          }
        } catch {}
        next();
      },
      Platform.OS === 'ios' ? 1200 : 450
    );
  }

  function open() {
    visibleRef.current = true;
    setVisible(true);
    backdrop.setValue(0);
    slide.setValue(SCREEN_H);
    Animated.sequence([
      // önce arka plan koyulaşsın, sonra kart gelsin
      Animated.timing(backdrop, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(slide, {
        toValue: 0,
        useNativeDriver: true,
        speed: 12,
        bounciness: 5,
      }),
    ]).start();
  }

  function close() {
    Animated.parallel([
      Animated.timing(slide, {
        toValue: SCREEN_H,
        duration: 260,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(backdrop, {
        toValue: 0,
        duration: 300,
        delay: 80,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      const next = nextReveal.current;
      nextReveal.current = null;
      visibleRef.current = !!next;
      setVisible(false);
      if (next) {
        // 1.5.9: soru kartı kapandı, sonuç ekranı açılır. iPhone'da iki pencere üst üste açılamadığı için kısa bekleme.
        setTimeout(
          () => {
            setReveal(next);
            setHandoff(false);
          },
          Platform.OS === 'ios' ? 450 : 120
        );
        return;
      }
      // Cevap verildiyse kart kapandıktan sonra rozet kontrolü (ör. 7 gün → Daimi Üye kutlaması)
      if (answeredNow.current) {
        answeredNow.current = false;
        setTimeout(() => checkBadges().catch(() => {}), 300);
      }
    });
  }

  useEffect(() => {
    const t = setTimeout(check, SHOW_DELAY_MS);
    // Uygulama arka plandan dönünce (ör. ertesi sabah) tekrar bak
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setTimeout(check, 800);
    });
    return () => {
      clearTimeout(t);
      sub.remove();
    };
  }, []);

  async function pick(key: string) {
    if (!question || phase === 'sending' || phase === 'done') return;
    Haptics.selectionAsync().catch(() => {});
    setPicked(key);
    setPhase('sending');
    const saved = await submitAnswer(question, key, lang);
    if (!saved) {
      setPhase('error');
      return;
    }
    setPicked(saved); // daha önce başka şık seçildiyse ekranda o görünsün
    track('question_answered', { day: question.day_date, option: saved, source: late ? 'gate_late' : 'gate' });
    answeredNow.current = true;
    const savedOption = question.options.find((o) => o.key === saved);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setStreak(await getStreak()); // telefondaki cevap geçmişinden yeniden say (aynı gün iki kez sayılmaz)
    if (late) {
      // 1.5.9: 21:00'den sonra cevaplandı. Tahmin yok; kesin sonuç hemen gösterilir.
      setAnswer(saved);
      pointsChanged();
      const result = await fetchResults(question).catch(() => null);
      if (result) {
        await markRevealed(question.day_date);
        openReveal({ question, myKey: saved, result, isYesterday: false, mode: 'final' });
      } else {
        setPicked(saved);
        showDone();
      }
      return;
    }
    scheduleResultNotification(question.day_date, savedOption ? clubName(savedOption, lang) : null); // 21:00 bildirimi
    // 1.5.4: önce tahmin adımı ("Sence çoğunluk ne dedi?"), sonra tamam kartı
    setAnswer(saved);
    setPicked(null);
    setPhase('predict');
    pointsChanged(); // ana ekrandaki 🎯 puan hapı yenilensin
  }

  // 1.5.9: soru kartını kapat, ardından sonuç ekranını aç
  function openReveal(data: PendingReveal) {
    nextReveal.current = data;
    setHandoff(true);
    close();
  }

  // 1.5.9: cevap (ve tahmin) tamam. "Şu ana kadar" sonucu alınabiliyorsa sonuç ekranı açılır;
  // alınamıyorsa (sunucu fonksiyonu yok, bağlantı yok) eski "cevabın kaydedildi" kartı gösterilir.
  async function finishAnswer(myKey: string | null) {
    if (!question || !myKey) {
      showDone();
      return;
    }
    const live = await fetchLiveResult(question).catch(() => null);
    if (!live) {
      setPicked(myKey);
      showDone();
      return;
    }
    openReveal({ question, myKey, result: live.result, isYesterday: false, mode: live.enough ? 'live' : 'early' });
  }

  function showDone() {
    // 1.5.6: bildirim izni yoksa tam bu anda sorulur ("Sonuç 21:00'de açıklanacak")
    if (answeredNow.current && !late) {
      canAskNotif()
        .then((ok) => {
          if (!ok) return;
          setAskNotif('ask');
          noteNotifAsk().catch(() => {});
          track('notif_ask_shown', { source: 'gate' });
        })
        .catch(() => {});
    }
    setPhase('done');
    doneAnim.setValue(0);
    Animated.spring(doneAnim, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 8 }).start();
  }

  async function predict(key: string) {
    if (!question || phase !== 'predict') return;
    Haptics.selectionAsync().catch(() => {});
    setPicked(key);
    setPhase('predicting');
    const saved = await submitPrediction(question, key);
    // Tahmin gönderilemese de akış durmasın; tamam kartında tahmin satırı görünmez
    setPrediction(saved);
    await finishAnswer(answer);
  }

  async function skipPrediction() {
    if (phase !== 'predict') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setPicked(null);
    setPhase('predicting');
    await finishAnswer(answer);
  }

  async function onNotifYes() {
    Haptics.selectionAsync().catch(() => {});
    const r = await acceptNotifAsk();
    track('notif_ask_answer', { answer: r });
    if (r === 'granted') {
      setAskNotif('ok');
      registerPushToken(true).catch(() => {});
      if (question) {
        const o = question.options.find((x) => x.key === answer);
        scheduleResultNotification(question.day_date, o ? clubName(o, lang) : null);
      }
    } else setAskNotif('no');
  }

  function onNotifNo() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    track('notif_ask_answer', { answer: 'later' });
    setAskNotif('no');
  }

  async function onSkip() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    await skipToday();
    if (question) track('question_skipped', { day: question.day_date });
    close();
  }

  async function onSnooze() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    await snoozeWeek();
    if (question) track('question_snoozed', { day: question.day_date });
    close();
  }

  // Koyu alana dokunmak / geri tuşu: cevap verildiyse kapat.
  // 1.5.8: verilmediyse artık "Bugün geç" sayılmaz; yalnızca kapanır ve sonraki açılışta tekrar sorulur
  // (günde en fazla 3 gösterim, arada en az 45 dk: bkz. gateAllowedToday).
  function onBackdrop() {
    if (phase === 'sending' || phase === 'predicting') return;
    if (phase !== 'done' && phase !== 'predict' && question) {
      track('question_skipped', { day: question.day_date, how: 'dismiss' });
    }
    close();
  }

  if (reveal) {
    return (
      <DailyResultReveal
        data={reveal}
        lang={lang}
        onClose={onRevealClose}
        source="gate"
        autoReveal={reveal.mode === 'final' && answeredNow.current}
      />
    );
  }

  if (!visible || !question) return null;

  const qText = questionText(question, lang) ?? question.question_tr;
  const pickedOption = question.options.find((o) => o.key === picked) ?? null;
  const answerOption = question.options.find((o) => o.key === answer) ?? null;
  const predictionOption = question.options.find((o) => o.key === prediction) ?? null;
  const predicting = phase === 'predict' || phase === 'predicting';
  const club = pickedOption ? clubName(pickedOption, lang) : null;
  const doneScale = doneAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onBackdrop}>
      <View style={[styles.root, { paddingBottom: insets.bottom + 12 }]}>
        <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onBackdrop} accessibilityLabel={tx.skip} />
        </Animated.View>

        <Animated.View style={[styles.card, predicting && styles.cardPredict, { transform: [{ translateY: slide }] }]}>
          {/* 1.5.8: izin sorusu çıkınca kart küçük ekrana sığsın diye üst satır gizlenir */}
          {compact ? null : (
            <View style={styles.topRow}>
              {/* 1.5.5: tahmin adımı sorunun tekrarı sanılmasın: üst satır, renk ve başlık değişir */}
              <View style={[styles.introIcon, predicting && styles.introIconPredict]}>
                {predicting ? <Text style={{ fontSize: 20 }}>🎯</Text> : <ChatCircleDots size={23} color={AMBER_FG} weight="duotone" />}
              </View>
              <Text style={styles.intro}>{predicting ? tx.predictIntro : late ? tx.introLate : tx.intro}</Text>
              {personalDay > 0 && !predicting ? (
                <View style={styles.dayPill}>
                  <Text style={styles.dayPillText}>{tx.day(personalDay)}</Text>
                </View>
              ) : null}
            </View>
          )}

          {predicting ? (
            <View style={styles.head}>
              <View style={[styles.labelPill, styles.predictPill]}>
                <Text style={[styles.label, styles.predictLabel]}>{tx.predictLabel}</Text>
              </View>
              <Text style={styles.predictAbout} numberOfLines={2}>
                {tx.predictAbout}: {qText}
              </Text>
              <Text style={[styles.question, styles.questionPredict]}>{tx.predictQ}</Text>
              <Text style={styles.hint}>{tx.predictHint(POINTS_HIT)}</Text>
              {answerOption ? (
                <View style={styles.answerChip}>
                  <Text style={styles.answerChipText} numberOfLines={1}>
                    {tx.yourAnswer}: <Text style={{ fontFamily: F.bold }}>{optionLabel(answerOption, lang)}</Text>
                  </Text>
                </View>
              ) : null}
            </View>
          ) : (
            <View style={styles.head}>
              <View style={styles.labelPill}>
                <Text style={styles.label}>{tx.label}</Text>
              </View>
              <Text style={styles.question}>{qText}</Text>
              <Text style={styles.hint}>{late ? tx.hintLate : tx.hint}</Text>
            </View>
          )}

          {phase === 'done' ? (
            <Animated.View style={[styles.doneCard, compact && styles.doneCardCompact, { opacity: doneAnim, transform: [{ scale: doneScale }] }]}>
              <CheckCircle size={compact ? 34 : 44} color={AMBER_FG} weight="fill" />
              <Text style={styles.doneTitle}>{tx.doneTitle}</Text>
              {pickedOption ? <Text style={styles.donePicked}>{optionLabel(pickedOption, lang)}</Text> : null}
              <Text style={styles.doneText}>{late ? tx.doneLate : club ? tx.doneClub(club) : tx.doneGeneric}</Text>
              {answeredNow.current ? <Text style={styles.earned}>{tx.earned}</Text> : null}
              {predictionOption ? (
                <View style={styles.predictionRow}>
                  <Text style={styles.predictionText} numberOfLines={2}>
                    {tx.yourPrediction(optionLabel(predictionOption, lang))}
                  </Text>
                </View>
              ) : null}
              {streak > 1 ? (
                <View style={styles.streakRow}>
                  <Fire size={18} color={AMBER_FG} weight="fill" />
                  <Text style={styles.streakText}>{tx.streak(streak)}</Text>
                </View>
              ) : null}
            </Animated.View>
          ) : (
            <View style={styles.options}>
              {question.options.map((o, i) => {
                const active = picked === o.key;
                const letter = String.fromCharCode(65 + i); // A, B, C, D
                return (
                  <Pressable
                    key={o.key}
                    onPress={() => (predicting ? predict(o.key) : pick(o.key))}
                    disabled={phase === 'sending' || phase === 'predicting'}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={({ pressed }) => [
                      styles.option,
                      active && styles.optionActive,
                      pressed && !active && styles.optionPressed,
                    ]}
                  >
                    <View style={[styles.letter, active && styles.letterActive]}>
                      <Text style={[styles.letterText, active && styles.letterTextActive]}>{letter}</Text>
                    </View>
                    <Text style={[styles.optionText, active && styles.optionTextActive]}>
                      {optionLabel(o, lang)}
                    </Text>
                    {active && (phase === 'sending' || phase === 'predicting') ? <ActivityIndicator color="#ffffff" /> : null}
                  </Pressable>
                );
              })}
              {phase === 'error' ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{tx.error}</Text>
                  <Pressable onPress={() => picked && pick(picked)} style={styles.retryBtn}>
                    <Text style={styles.retryText}>{tx.retry}</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          )}

          {phase === 'done' && askNotif === 'ask' ? (
            <View style={styles.askBox}>
              <Text style={styles.askTitle}>{tx.askTitle}</Text>
              <Text style={styles.askText}>{tx.askText}</Text>
              <Pressable onPress={onNotifYes} style={styles.continueBtn} accessibilityRole="button">
                <Text style={styles.continueText}>{tx.askYes}</Text>
              </Pressable>
              <Pressable onPress={onNotifNo} style={styles.askLater} accessibilityRole="button" hitSlop={8}>
                <Text style={styles.askLaterText}>{tx.askNo}</Text>
              </Pressable>
              <Text style={styles.askNote}>{tx.askNote}</Text>
            </View>
          ) : phase === 'done' ? (
            <>
              {askNotif === 'ok' ? <Text style={styles.askDone}>{tx.askDone}</Text> : null}
              <Pressable onPress={close} style={styles.continueBtn} accessibilityRole="button">
                <Text style={styles.continueText}>{tx.continue}</Text>
              </Pressable>
            </>
          ) : predicting ? (
            <View style={styles.footer}>
              <Pressable onPress={skipPrediction} style={styles.footerBtn} accessibilityRole="button" disabled={phase === 'predicting'}>
                <Text style={styles.footerText}>{tx.predictSkip}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.footer}>
              <Pressable onPress={onSkip} style={styles.footerBtn} accessibilityRole="button">
                <Text style={styles.footerText}>{tx.skip}</Text>
              </Pressable>
              <View style={styles.footerDivider} />
              <Pressable onPress={onSnooze} style={styles.footerBtn} accessibilityRole="button">
                <Text style={styles.footerText}>{tx.snooze}</Text>
              </Pressable>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  askBox: { marginTop: 12, alignItems: 'stretch' },
  askTitle: { fontFamily: F.bold, fontSize: 19, color: INK, textAlign: 'center' },
  askText: { fontFamily: F.medium, fontSize: 14.5, lineHeight: 20, color: '#4A4F66', textAlign: 'center', marginTop: 6, marginBottom: 2 },
  askLater: { alignSelf: 'center', paddingVertical: 12 },
  askLaterText: { fontFamily: F.bold, fontSize: 15, color: '#6B7085' },
  askNote: { fontFamily: F.medium, fontSize: 12, color: '#8A8FA3', textAlign: 'center' },
  askDone: { fontFamily: F.bold, fontSize: 14, color: '#3F3BC9', textAlign: 'center', marginTop: 14 },
  earned: { fontFamily: 'DMSans_500Medium', fontSize: 12.5, color: '#3F3BC9', marginTop: 8, textAlign: 'center' },
  root: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(6, 12, 26, 0.78)',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  introIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: AMBER_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  intro: {
    flex: 1,
    fontFamily: F.bold,
    fontSize: 16,
    color: INK,
  },
  dayPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: NAVY,
  },
  dayPillText: {
    fontFamily: F.bold,
    fontSize: 13,
    color: '#ffffff',
  },
  head: {
    marginTop: 20,
    gap: 10,
    alignItems: 'flex-start',
  },
  labelPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: AMBER_BG,
  },
  label: {
    fontFamily: F.bold,
    fontSize: 13,
    letterSpacing: 1.2,
    color: AMBER_FG,
  },
  question: {
    fontFamily: F.bold,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.5,
    color: INK,
  },
  hint: {
    fontFamily: F.medium,
    fontSize: 15,
    color: SOFT,
  },
  options: {
    marginTop: 20,
    gap: 10,
  },
  option: {
    minHeight: 62,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#E6E8F0',
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  optionPressed: {
    backgroundColor: OPTION_BG,
  },
  optionActive: {
    backgroundColor: NAVY,
    borderColor: NAVY,
  },
  letter: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: OPTION_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterActive: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  letterText: {
    fontFamily: F.bold,
    fontSize: 15,
    color: NAVY,
  },
  letterTextActive: {
    color: '#ffffff',
  },
  optionText: {
    flex: 1,
    fontFamily: F.bold,
    fontSize: 19,
    color: INK,
  },
  optionTextActive: {
    color: '#ffffff',
  },
  errorBox: {
    marginTop: 4,
    padding: 14,
    borderRadius: 14,
    backgroundColor: AMBER_BG,
    gap: 10,
  },
  errorText: {
    fontFamily: F.bold,
    fontSize: 15,
    color: INK,
  },
  retryBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: NAVY,
  },
  retryText: {
    fontFamily: F.bold,
    fontSize: 15,
    color: '#ffffff',
  },
  predictPill: { backgroundColor: '#EEEDFB' },
  cardPredict: { borderTopWidth: 5, borderTopColor: '#4F46E5' },
  introIconPredict: { backgroundColor: '#EEEDFB' },
  predictAbout: { fontFamily: F.medium, fontSize: 14, color: '#6B7085' },
  questionPredict: { fontSize: 26, lineHeight: 32, color: '#2F2BA8' },
  predictLabel: { color: '#3F3BC9' },
  answerChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: OPTION_BG,
    maxWidth: '100%',
  },
  answerChipText: { fontFamily: F.medium, fontSize: 14, color: INK },
  predictionRow: {
    marginTop: 2,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#EEEDFB',
  },
  predictionText: { fontFamily: F.bold, fontSize: 15, color: '#3F3BC9', textAlign: 'center' },
  doneCardCompact: { marginTop: 14, padding: 16, gap: 6 },
  doneCard: {
    marginTop: 20,
    padding: 22,
    borderRadius: 20,
    backgroundColor: OPTION_BG,
    alignItems: 'center',
    gap: 10,
  },
  doneTitle: {
    fontFamily: F.bold,
    fontSize: 24,
    color: INK,
  },
  donePicked: {
    fontFamily: F.bold,
    fontSize: 20,
    color: AMBER_FG,
  },
  doneText: {
    fontFamily: F.medium,
    fontSize: 16,
    lineHeight: 23,
    color: INK,
    textAlign: 'center',
  },
  streakRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  streakText: {
    fontFamily: F.bold,
    fontSize: 16,
    color: INK,
  },
  continueBtn: {
    marginTop: 16,
    marginBottom: 10,
    height: 58,
    borderRadius: 18,
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueText: {
    fontFamily: F.bold,
    fontSize: 18,
    color: '#ffffff',
  },
  footer: {
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerBtn: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  footerText: {
    fontFamily: F.bold,
    fontSize: 15,
    color: INK,
  },
  footerDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#DDDFE6',
  },
});
