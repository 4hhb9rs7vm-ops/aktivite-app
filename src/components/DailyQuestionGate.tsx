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
  fetchTodayQuestion,
  findPendingReveal,
  gateAllowedToday,
  getMyAnswer,
  getStreak,
  markRevealed,
  optionLabel,
  PendingReveal,
  questionText,
  SERIES_LENGTH,
  skipToday,
  snoozeWeek,
  submitAnswer,
} from '@/lib/dailyQuestion';
import { DailyResultReveal } from '@/components/DailyResultReveal';

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

type Phase = 'question' | 'sending' | 'done' | 'error';

const TEXT = {
  tr: {
    intro: 'Başlamadan önce kısa bir soru',
    label: 'GÜNÜN SORUSU',
    day: (n: number) => `Gün ${n}/${SERIES_LENGTH}`,
    hint: "Herkese aynı soru. Sonuç akşam 21:00'de.",
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
    day: (n: number) => `Day ${n}/${SERIES_LENGTH}`,
    hint: 'Same question for everyone. Results at 9 pm.',
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
  const [question, setQuestion] = useState<DailyQuestion | null>(null);
  const [lang, setLang] = useState<Lang>('tr');
  const [phase, setPhase] = useState<Phase>('question');
  const [picked, setPicked] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [reveal, setReveal] = useState<PendingReveal | null>(null);

  const checking = useRef(false);
  const visibleRef = useRef(false);
  const backdrop = useRef(new Animated.Value(0)).current; // arka plan karartması
  const slide = useRef(new Animated.Value(SCREEN_H)).current; // kartın alttan gelişi
  const doneAnim = useRef(new Animated.Value(0)).current;

  const tx = (lang as string) === 'tr' ? TEXT.tr : TEXT.en;

  // Açılışta / uygulamaya dönünce: önce bekleyen sonuç var mı, yoksa bugünün sorusu
  async function check() {
    if (checking.current || visibleRef.current) return;
    checking.current = true;
    try {
      const l: Lang = (await loadLang()) ?? 'tr';
      const pending = await findPendingReveal(l, TEST_MODE);
      if (pending) {
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

  async function showQuestionIfNeeded(l: Lang) {
    if (!TEST_MODE && !(await gateAllowedToday())) return;
    const q = await fetchTodayQuestion();
    if (!q) return;
    if (!questionText(q, l)) return; // bu dilde soru yok (ör. Korece): hiç gösterme
    if (!TEST_MODE && (await getMyAnswer(q))) return; // bugün zaten cevaplamış
    setStreak(await getStreak());
    setLang(l);
    setQuestion(q);
    setPicked(null);
    setPhase('question');
    open();
  }

  // Sonuç ekranı kapandı. Paylaş denildiyse modal tamamen kapandıktan sonra paylaşma penceresi,
  // ardından (21:00'den önceyse ve cevaplanmadıysa) bugünün sorusu.
  function onRevealClose(shareUri: string | null) {
    const l = lang;
    setReveal(null);
    visibleRef.current = false;
    const next = () => {
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
    if (!shareUri) {
      next();
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
      visibleRef.current = false;
      setVisible(false);
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
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setStreak(await getStreak()); // telefondaki cevap geçmişinden yeniden say (aynı gün iki kez sayılmaz)
    setPhase('done');
    doneAnim.setValue(0);
    Animated.spring(doneAnim, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 8 }).start();
  }

  async function onSkip() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    await skipToday();
    close();
  }

  async function onSnooze() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    await snoozeWeek();
    close();
  }

  // Koyu alana dokunmak: cevap verildiyse kapat, verilmediyse "Bugün geç" say
  function onBackdrop() {
    if (phase === 'sending') return;
    if (phase === 'done') close();
    else onSkip();
  }

  if (reveal) {
    return <DailyResultReveal data={reveal} lang={lang} onClose={onRevealClose} />;
  }

  if (!visible || !question) return null;

  const qText = questionText(question, lang) ?? question.question_tr;
  const pickedOption = question.options.find((o) => o.key === picked) ?? null;
  const club = pickedOption ? clubName(pickedOption, lang) : null;
  const doneScale = doneAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onBackdrop}>
      <View style={[styles.root, { paddingBottom: insets.bottom + 12 }]}>
        <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onBackdrop} accessibilityLabel={tx.skip} />
        </Animated.View>

        <Animated.View style={[styles.card, { transform: [{ translateY: slide }] }]}>
          <View style={styles.topRow}>
            <View style={styles.introIcon}>
              <ChatCircleDots size={23} color={AMBER_FG} weight="duotone" />
            </View>
            <Text style={styles.intro}>{tx.intro}</Text>
            {question.series_day ? (
              <View style={styles.dayPill}>
                <Text style={styles.dayPillText}>{tx.day(question.series_day)}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.head}>
            <View style={styles.labelPill}>
              <Text style={styles.label}>{tx.label}</Text>
            </View>
            <Text style={styles.question}>{qText}</Text>
            <Text style={styles.hint}>{tx.hint}</Text>
          </View>

          {phase === 'done' ? (
            <Animated.View style={[styles.doneCard, { opacity: doneAnim, transform: [{ scale: doneScale }] }]}>
              <CheckCircle size={44} color={AMBER_FG} weight="fill" />
              <Text style={styles.doneTitle}>{tx.doneTitle}</Text>
              {pickedOption ? <Text style={styles.donePicked}>{optionLabel(pickedOption, lang)}</Text> : null}
              <Text style={styles.doneText}>{club ? tx.doneClub(club) : tx.doneGeneric}</Text>
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
                    onPress={() => pick(o.key)}
                    disabled={phase === 'sending'}
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
                    {active && phase === 'sending' ? <ActivityIndicator color="#ffffff" /> : null}
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

          {phase === 'done' ? (
            <Pressable onPress={close} style={styles.continueBtn} accessibilityRole="button">
              <Text style={styles.continueText}>{tx.continue}</Text>
            </Pressable>
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
