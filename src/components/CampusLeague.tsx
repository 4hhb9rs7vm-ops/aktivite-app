// 1.5.2 Kampüs Ligi ekranları.
// CampusLeagueHost (_layout.tsx içinde, her sekmenin üstünde):
//   - 2. girişte bir kez "Üniversite öğrencisi misin?" → okul seçimi + onay → "İTÜ'ye hoş geldin" şeridi
//   - Okul seçildikten sonraki gün bir kez okul kilidi: "5 kişi eksik" / "Son 1 kişi" / "Listede"
//   - Pazartesi–Salı, okul geçen hafta listedeyse bir kez haftanın sonucu
// CampusLeagueCard (Ben sekmesi): okulun bu haftaki durumu ve Pazartesi–Salı geçen haftanın sıraları.
// Ekranlar Günün Sorusu ve rozet kutlamasıyla çakışmasın diye overlay sırası kullanılır.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';

import {
  answerStudent,
  CampusRanks,
  CampusStatus,
  ensureCampusState,
  fetchCampusStatus,
  hasConsent,
  isMondayOrTuesday,
  leagueSchool,
  noteAppOpen,
  patchCampusState,
  saveSchool,
  shareCampusOther,
  shareCampusWhatsApp,
  shareMessage,
  shortSchool,
  shouldAskStudent,
  statusTitle,
  syncLeagueNotification,
  genitive,
  dative,
  accusative,
  isEarly,
  statusSub,
} from '@/lib/campus';
import { istanbulToday } from '@/lib/dailyQuestion';
import { loadLang } from '@/lib/i18n';
import { loadMe, Me, onProfileChanged } from '@/lib/me';
import { setOverlayBusy, whenOverlayFree } from '@/lib/overlay';
import { searchUniversities, UNIVERSITY_OTHER } from '@/lib/universities';
import { track } from '@/lib/analytics';

const F = { regular: 'DMSans_400Regular', medium: 'DMSans_500Medium', bold: 'DMSans_700Bold' };
const NAVY = '#0F2A52';
const NAVY_CARD = '#1B2142';
const INK = '#16161A';
const SOFT = '#4A4E5A';
const MUTED = '#6B6F7B';
const ACCENT = '#3F3BC9';
const ACCENT_BG = '#EEF0FF';
const AMBER = '#FBBF24';
const LAVENDER = '#A5B4FC';
const WA = '#25D366';

type Lang = 'tr' | 'en';
const SHOW_DELAY_MS = 5200; // açılış animasyonu + Günün Sorusu kontrolünden sonra

// ======================================================================== metinler
const T = {
  tr: {
    kicker: 'BİR SORU DAHA',
    askTitle: 'Üniversite öğrencisi misin?',
    askText: 'Öğrenciysen okulun Kampüs Ligi’nde yarışır. Seçtiğin her an okuluna sayılır.',
    yes: 'Evet, öğrenciyim',
    no: 'Hayır',
    pickTitle: 'Okulunu seç',
    pickSub: 'Okulun Kampüs Ligi’nde senin seçimlerinle yarışır.',
    search: 'Üniversite ara (ör. ODTÜ, Boğaziçi)',
    other: 'Listede yok',
    consentOn: 'Karşılaştırma için okulum (ve girdiğim yaş, şehir gibi bilgiler) anonim ve toplu kullanılsın. Adım hiçbir yerde görünmez.',
    consentOff: 'Onay vermezsen okulun ligde sayılmaz. Okul bilgin sadece telefonunda kalır.',
    join: 'Ligde yerimi al 🏆',
    saveNoConsent: 'Onaysız kaydet',
    pickFirst: 'Önce okulunu seç',
    later: 'Şimdi değil',
    otherTitle: 'Okulun listede yok mu? 🤔',
    otherText: 'Şimdilik ligde sayılamıyor. Okulunu eklememiz için Instagram’da @suan.app’e yaz, ilk fırsatta ekleyelim.',
    ok: 'Tamam',
    welcome: (s: string) => `${dative(s)} hoş geldin!`,
    welcomeSub: 'Bundan sonra seçtiğin anlar okuluna sayılacak.',
    lockMissing: 'Sınıf arkadaşlarını çağır, okulun bu haftaki Kampüs Ligi sıralamasına girsin.',
    lockLast: 'Bir arkadaşın daha gelirse okulun bu haftaki sıralamada.',
    lockListed: 'Sonuçları Pazartesi açıklıyoruz. Ne kadar çok kişi, o kadar güçlü kampüs.',
    btnMissing: 'Sınıf grubuna gönder',
    btnLast: 'Son kişiyi çağır',
    btnListed: 'Daha çok arkadaş çağır',
    other2: 'Başka yolla paylaş',
    resKicker: 'KAMPÜS LİGİ · HAFTANIN SONUCU',
    resTitle: (s: string, cat: string) => `${s} bu hafta\n${cat}`,
    resShare: 'Sınıf grubuna paylaş',
    resMsg: (s: string, cat: string) =>
      `${s} bu hafta Şu An Kampüs Ligi'nde ${cat.toLocaleLowerCase('tr-TR')} kampüs çıktı 🏆 Sen de katıl, okulunu seç 👉 https://4hhb9rs7vm-ops.github.io/aktivite-app/indir/`,
    cats: { friends: 'En sosyal', coffee: 'En çok kahve içen', study: 'En çok ders çalışan', procrastinating: 'En çok erteleyen' },
    catShort: { friends: '👯 En sosyal', coffee: '☕ Kahve', study: '📚 Ders', procrastinating: '🌀 Erteleme' },
    cardKicker: '🏆 KAMPÜS LİGİ · BU HAFTA',
    cardLastKicker: (s: string) => `🏆 GEÇEN HAFTA · ${s}`,
    cardMissingSub: 'Okulun listeye girsin',
    cardLastSub: 'Son kişiyi çağır',
    cardListedSub: 'Sonuçlar Pazartesi',
    cardCall: 'Çağır',
    cardNewWeek: (n: number) =>
      n === 1 ? 'Yeni hafta · son 1 kişi' : n >= 7 ? 'Yeni hafta başladı · okulunu ilk sen taşı 🚀' : `Yeni hafta başladı · ${n} kişi eksik`,
    cardNewWeekListed: 'Bu hafta da listedesiniz ✅',
    cardNotListed: 'Listeye giremedi 😕',
    cardNoConsent: 'Karşılaştırma onayın kapalı, okulun ligde sayılmıyor.',
    cardGiveConsent: 'Onay ver',
    cardLoading: 'Okulunun durumu yükleniyor…',
    cardError: 'Durum şu an yüklenemedi.',
  },
  en: {
    kicker: 'ONE MORE QUESTION',
    askTitle: 'Are you a university student?',
    askText: 'If you are, your school competes in the Campus League. Every moment you pick counts for your school.',
    yes: "Yes, I'm a student",
    no: 'No',
    pickTitle: 'Choose your school',
    pickSub: 'Your school competes in the Campus League with your picks.',
    search: 'Search university (e.g. METU, Boğaziçi)',
    other: 'Not on the list',
    consentOn: 'Use my school (and info like age or city, if I added it) anonymously and in aggregate for comparisons. My name is never shown.',
    consentOff: "Without consent your school won't be counted. Your school stays only on your phone.",
    join: 'Take my place 🏆',
    saveNoConsent: 'Save without consent',
    pickFirst: 'Pick your school first',
    later: 'Not now',
    otherTitle: 'School not on the list? 🤔',
    otherText: "It can't be counted yet. Message @suan.app on Instagram and we'll add your school.",
    ok: 'OK',
    welcome: (s: string) => `Welcome, ${s}!`,
    welcomeSub: 'From now on, the moments you pick count for your school.',
    lockMissing: "Invite your classmates so your school makes this week's Campus League ranking.",
    lockLast: "One more friend and your school is in this week's ranking.",
    lockListed: 'Results come out on Monday. The more people, the stronger your campus.',
    btnMissing: 'Send to class group',
    btnLast: 'Invite the last one',
    btnListed: 'Invite more friends',
    other2: 'Share another way',
    resKicker: "CAMPUS LEAGUE · THIS WEEK'S RESULT",
    resTitle: (s: string, cat: string) => `${s} this week:\n${cat}`,
    resShare: 'Share with class group',
    resMsg: (s: string, cat: string) =>
      `${s} came out as "${cat}" in this week's Şu An Campus League 🏆 Join and pick your school 👉 https://4hhb9rs7vm-ops.github.io/aktivite-app/indir/`,
    cats: { friends: 'Most social', coffee: 'Most coffee', study: 'Most studying', procrastinating: 'Most procrastinating' },
    catShort: { friends: '👯 Most social', coffee: '☕ Coffee', study: '📚 Study', procrastinating: '🌀 Procrastinating' },
    cardKicker: '🏆 CAMPUS LEAGUE · THIS WEEK',
    cardLastKicker: (s: string) => `🏆 LAST WEEK · ${s}`,
    cardMissingSub: 'Get your school on the list',
    cardLastSub: 'Invite the last one',
    cardListedSub: 'Results on Monday',
    cardCall: 'Invite',
    cardNewWeek: (n: number) =>
      n === 1 ? 'New week · last 1 person' : n >= 7 ? 'New week · be the first from your school 🚀' : `New week · ${n} more needed`,
    cardNewWeekListed: "You're on the list this week too ✅",
    cardNotListed: "Didn't make the list 😕",
    cardNoConsent: "Comparison consent is off, so your school isn't counted.",
    cardGiveConsent: 'Give consent',
    cardLoading: "Loading your school's status…",
    cardError: "Couldn't load the status right now.",
  },
};
type Tx = (typeof T)['tr'];
type CatKey = 'friends' | 'coffee' | 'study' | 'procrastinating';
const CAT_ORDER: CatKey[] = ['friends', 'coffee', 'study', 'procrastinating'];

function tap(light = false) {
  Haptics.impactAsync(light ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

// Okulun en iyi olduğu kategori (en küçük sıra; eşitlikte listedeki sıra)
function bestCategory(r: CampusRanks): CatKey {
  let best: CatKey = 'friends';
  for (const k of CAT_ORDER) if (r[k] < r[best]) best = k;
  return best;
}

function progressWidth(st: CampusStatus): number {
  if (st.listed) return 100;
  return Math.max(8, Math.min(92, ((10 - st.missing) / 10) * 100));
}

// ======================================================================== Host
type Screen =
  | { kind: 'ask' }
  | { kind: 'pick' }
  | { kind: 'other' }
  | { kind: 'lock'; school: string; status: CampusStatus }
  | { kind: 'result'; school: string; ranks: CampusRanks }
  | null;

export function CampusLeagueHost() {
  const insets = useSafeAreaInsets();
  const [lang, setLang] = useState<Lang>('tr');
  const [screen, setScreen] = useState<Screen>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const busyRef = useRef(false);
  const t = T[lang];

  useEffect(() => {
    setOverlayBusy('campus', screen !== null);
    busyRef.current = screen !== null;
    return () => setOverlayBusy('campus', false);
  }, [screen]);

  const check = useCallback(async () => {
    if (busyRef.current) return;
    const l = ((await loadLang().catch(() => 'tr')) as string) === 'en' ? 'en' : 'tr';
    setLang(l);
    const opens = await noteAppOpen();
    syncLeagueNotification().catch(() => {});

    // 1) 2. girişte öğrenci sorusu
    if (await shouldAskStudent(opens)) {
      whenOverlayFree(() => {
        if (!busyRef.current) {
          track('student_prompt', { answer: 'shown' });
          setScreen({ kind: 'ask' });
        }
      }, 'campus');
      return;
    }

    const me = await loadMe();
    const school = leagueSchool(me);
    if (!school) return;
    if (!(await hasConsent())) return; // onay yoksa okul ligde sayılmıyor; Ben kartı uyarır
    const st0 = await ensureCampusState(school);
    const today = istanbulToday();

    // 2) Pazartesi–Salı: okul geçen hafta listedeyse bir kez sonuç
    // 3) Okul seçildikten sonraki gün bir kez okul kilidi
    const wantResult = isMondayOrTuesday();
    const wantLock = !st0.lockShown && st0.day < today;
    if (!wantResult && !wantLock) return;

    const status = await fetchCampusStatus(school);
    if (!status) return;

    if (wantResult && status.lastListed && status.lastRanks && st0.resultWeek !== status.week) {
      whenOverlayFree(() => {
        if (busyRef.current) return;
        patchCampusState({ resultWeek: status.week }).catch(() => {});
        setScreen({ kind: 'result', school, ranks: status.lastRanks! });
      }, 'campus');
      return;
    }
    if (wantLock) {
      whenOverlayFree(() => {
        if (busyRef.current) return;
        patchCampusState({ lockShown: true }).catch(() => {});
        track('campus_lock', { missing: status.missing, listed: status.listed });
        setScreen({ kind: 'lock', school, status });
      }, 'campus');
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(() => check().catch(() => {}), SHOW_DELAY_MS);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setTimeout(() => check().catch(() => {}), 1500);
    });
    return () => {
      clearTimeout(first);
      sub.remove();
    };
  }, [check]);

  function showToast(msg: string) {
    setToast(msg);
    toastAnim.setValue(0);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.delay(3200),
      Animated.timing(toastAnim, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start(() => setToast(null));
  }

  async function onPicked(university: string, consent: boolean) {
    await saveSchool(university, consent);
    setScreen(null);
    if (university === UNIVERSITY_OTHER) {
      setTimeout(() => setScreen({ kind: 'other' }), 450);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (consent) setTimeout(() => showToast(shortSchool(university)), 500);
  }

  return (
    <>
      {screen?.kind === 'ask' ? (
        <AskStudent
          t={t}
          onYes={() => {
            tap();
            answerStudent('yes').catch(() => {});
            setScreen(null);
            // iOS: bir pencere kapanırken diğeri açılırsa görünmüyor; kapanmasını bekle
            setTimeout(() => setScreen({ kind: 'pick' }), 450);
          }}
          onNo={() => {
            tap(true);
            answerStudent('no').catch(() => {});
            setScreen(null);
          }}
        />
      ) : null}

      {screen?.kind === 'pick' ? (
        <SchoolPicker t={t} lang={lang} onDone={onPicked} onClose={() => setScreen(null)} />
      ) : null}

      {screen?.kind === 'other' ? (
        <InfoSheet title={t.otherTitle} text={t.otherText} ok={t.ok} onClose={() => setScreen(null)} />
      ) : null}

      {screen?.kind === 'lock' ? (
        <LockSheet t={t} lang={lang} school={screen.school} status={screen.status} onClose={() => setScreen(null)} />
      ) : null}

      {screen?.kind === 'result' ? (
        <ResultScreen t={t} lang={lang} school={screen.school} ranks={screen.ranks} onClose={() => setScreen(null)} />
      ) : null}

      {toast ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toast,
            {
              bottom: insets.bottom + 92,
              opacity: toastAnim,
              transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
            },
          ]}
        >
          <Text style={styles.toastText}>
            🎓 <Text style={styles.toastBold}>{t.welcome(toast)}</Text> {t.welcomeSub}
          </Text>
        </Animated.View>
      ) : null}
    </>
  );
}

// ======================================================================== A1 · Öğrenci misin?
function AskStudent({ t, onYes, onNo }: { t: Tx; onYes: () => void; onNo: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible transparent={false} animationType="fade" statusBarTranslucent onRequestClose={onNo}>
      <View style={[styles.askRoot, { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.askBody}>
          <Text style={styles.askKicker}>{t.kicker}</Text>
          <Text style={styles.askEmoji}>🎓</Text>
          <Text style={styles.askTitle}>{t.askTitle}</Text>
          <Text style={styles.askText}>{t.askText}</Text>
        </View>
        <View style={{ gap: 12 }}>
          <Pressable style={({ pressed }) => [styles.askYes, pressed && { opacity: 0.85 }]} onPress={onYes} accessibilityRole="button">
            <Text style={styles.askYesText}>{t.yes}</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.askNo, pressed && { opacity: 0.85 }]} onPress={onNo} accessibilityRole="button">
            <Text style={styles.askNoText}>{t.no}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ======================================================================== A2/A3 · Okul seçimi + onay
export function SchoolPicker({
  t,
  lang,
  onDone,
  onClose,
}: {
  t: Tx;
  lang: Lang;
  onDone: (university: string, consent: boolean) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [consent, setConsent] = useState(true);
  const [busy, setBusy] = useState(false);
  const options = [...searchUniversities(q), UNIVERSITY_OTHER];

  async function submit() {
    if (!picked || busy) return;
    tap();
    setBusy(true);
    await onDone(picked, picked === UNIVERSITY_OTHER ? false : consent);
    setBusy(false);
  }

  const btnLabel = !picked ? t.pickFirst : picked === UNIVERSITY_OTHER || consent ? t.join : t.saveNoConsent;

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t.later} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.pickWrap}>
          <View style={[styles.sheet, styles.pickSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.grab} />
            <Text style={styles.sheetTitle}>{t.pickTitle}</Text>
            <Text style={styles.sheetSub}>{t.pickSub}</Text>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={17} color={MUTED} />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder={t.search}
                placeholderTextColor={MUTED}
                style={styles.searchInput}
                autoCorrect={false}
                returnKeyType="search"
              />
            </View>
            <FlatList
              data={options}
              keyExtractor={(u) => u}
              keyboardShouldPersistTaps="handled"
              style={{ flexGrow: 0, maxHeight: 300 }}
              renderItem={({ item }) => {
                const on = picked === item;
                const label = item === UNIVERSITY_OTHER ? t.other : item;
                return (
                  <Pressable
                    style={styles.item}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setPicked(item);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                  >
                    <Text style={[styles.itemText, on && styles.itemOn, item === UNIVERSITY_OTHER && !on && { color: MUTED }]} numberOfLines={2}>
                      {label}
                    </Text>
                    {on ? (
                      <View style={styles.check}>
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      </View>
                    ) : null}
                  </Pressable>
                );
              }}
            />
            {picked !== UNIVERSITY_OTHER ? (
              <Pressable
                style={[styles.consent, !consent && styles.consentOff]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setConsent((c) => !c);
                }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: consent }}
              >
                <View style={[styles.box, !consent && styles.boxOff]}>
                  {consent ? <Ionicons name="checkmark" size={13} color="#fff" /> : null}
                </View>
                <Text style={[styles.consentText, !consent && { color: '#7A4B00' }]}>{consent ? t.consentOn : t.consentOff}</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={[styles.primary, !picked && styles.primaryDis, picked && picked !== UNIVERSITY_OTHER && !consent && { backgroundColor: '#6B6F7B' }]}
              onPress={submit}
              disabled={!picked || busy}
              accessibilityRole="button"
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{btnLabel}</Text>}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ======================================================================== A4 · bilgi
function InfoSheet({ title, text, ok, onClose }: { title: string; text: string; ok: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.grab} />
          <Text style={styles.sheetTitle}>{title}</Text>
          <Text style={[styles.sheetSub, { fontSize: 14, lineHeight: 20, marginTop: 8 }]}>{text}</Text>
          <Pressable style={[styles.primary, { marginTop: 22 }]} onPress={onClose} accessibilityRole="button">
            <Text style={styles.primaryText}>{ok}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ======================================================================== B · Okul kilidi
function LockSheet({
  t,
  lang,
  school,
  status,
  onClose,
}: {
  t: Tx;
  lang: Lang;
  school: string;
  status: CampusStatus;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const early = isEarly(status);
  const emoji = status.listed ? '🏆' : status.missing === 1 ? '🔥' : early ? '🚀' : '🎓';
  const text = status.listed
    ? t.lockListed
    : status.missing === 1
      ? t.lockLast
      : early
        ? statusSub(status, lang) ?? t.lockMissing
        : t.lockMissing;
  const btn = status.listed ? t.btnListed : status.missing === 1 ? t.btnLast : t.btnMissing;
  const msg = shareMessage(status, school, lang);
  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16, alignItems: 'center' }]}>
          <View style={styles.grab} />
          <View style={styles.badge}>
            <Text style={{ fontSize: 34 }}>{emoji}</Text>
          </View>
          <LockTitle status={status} school={school} lang={lang} />
          <Text style={[styles.sheetSub, { textAlign: 'center', marginTop: 8, fontSize: 14, lineHeight: 20 }]}>{text}</Text>
          <View style={styles.lbar}>
            <View style={[styles.lbarFill, { width: `${progressWidth(status)}%` }]} />
          </View>
          <Pressable
            style={({ pressed }) => [styles.wa, pressed && { opacity: 0.85 }]}
            onPress={() => {
              tap();
              onClose();
              setTimeout(() => shareCampusWhatsApp(msg, 'campus_lock').catch(() => {}), 450);
            }}
            accessibilityRole="button"
          >
            <Ionicons name="logo-whatsapp" size={19} color="#fff" />
            <Text style={styles.waText}>{btn}</Text>
          </Pressable>
          <Pressable
            style={styles.linkBtn}
            onPress={() => {
              tap(true);
              if (status.listed) {
                onClose();
                return;
              }
              onClose();
              setTimeout(() => shareCampusOther(msg, 'campus_lock').catch(() => {}), 450);
            }}
            accessibilityRole="button"
          >
            <Text style={styles.linkText}>{status.listed ? t.ok : t.other2}</Text>
          </Pressable>
          {!status.listed ? (
            <Pressable style={styles.linkBtn} onPress={onClose} accessibilityRole="button">
              <Text style={[styles.linkText, { color: MUTED, fontFamily: F.medium }]}>{t.later}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

// "İTÜ'nün listeye girmesi için 5 kişi eksik" — sayı kısmı vurgulu
function LockTitle({ status, school, lang }: { status: CampusStatus; school: string; lang: Lang }) {
  const s = shortSchool(school);
  if (lang === 'tr') {
    if (status.listed)
      return (
        <Text style={styles.lockTitle}>
          <Text style={styles.lockAccent}>{s} listede!</Text>
        </Text>
      );
    if (status.missing === 1)
      return (
        <Text style={styles.lockTitle}>
          {s} için <Text style={styles.lockAccent}>son 1 kişi!</Text>
        </Text>
      );
    if (isEarly(status))
      return (
        <Text style={styles.lockTitle}>
          {accusative(s)} lige <Text style={styles.lockAccent}>ilk sen taşı 🚀</Text>
        </Text>
      );
    return (
      <Text style={styles.lockTitle}>
        {genitive(s)} listeye girmesi için <Text style={styles.lockAccent}>{status.missing} kişi eksik</Text>
      </Text>
    );
  }
  return <Text style={styles.lockTitle}>{statusTitle(status, school, lang)}</Text>;
}

// ======================================================================== B6 · Pazartesi sonucu
function ResultScreen({
  t,
  lang,
  school,
  ranks,
  onClose,
}: {
  t: Tx;
  lang: Lang;
  school: string;
  ranks: CampusRanks;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const s = shortSchool(school);
  const best = bestCategory(ranks);
  const cat = t.cats[best];
  return (
    <Modal visible transparent={false} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={[styles.resRoot, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}>
        <Pressable onPress={onClose} hitSlop={12} style={styles.close} accessibilityRole="button" accessibilityLabel={t.ok}>
          <Ionicons name="close" size={26} color={LAVENDER} />
        </Pressable>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Text style={styles.resKicker}>{t.resKicker}</Text>
          <Text style={{ fontSize: 64, textAlign: 'center', marginTop: 14 }}>🏆</Text>
          <Text style={styles.resTitle}>
            {s} {lang === 'tr' ? 'bu hafta' : 'this week'}
            {'\n'}
            <Text style={styles.resAccent}>{cat}</Text>
          </Text>
          <View style={{ marginTop: 26, gap: 8 }}>
            {CAT_ORDER.map((k) => (
              <View key={k} style={styles.rankRow}>
                <Text style={styles.rankLabel}>{t.catShort[k]}</Text>
                <Text style={styles.rankVal}>{ranks[k]}.</Text>
              </View>
            ))}
          </View>
        </View>
        <Pressable
          style={({ pressed }) => [styles.wa, pressed && { opacity: 0.85 }]}
          onPress={() => {
            tap();
            onClose();
            setTimeout(() => shareCampusWhatsApp(t.resMsg(s, cat), 'campus_result').catch(() => {}), 450);
          }}
          accessibilityRole="button"
        >
          <Ionicons name="logo-whatsapp" size={19} color="#fff" />
          <Text style={styles.waText}>{t.resShare}</Text>
        </Pressable>
        <Pressable style={[styles.askNo, { marginTop: 10 }]} onPress={onClose} accessibilityRole="button">
          <Text style={styles.askNoText}>{t.ok}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

// ======================================================================== Ben sekmesi kartı
export function CampusLeagueCard({ me, lang }: { me: Me; lang: Lang }) {
  const t = T[lang];
  const school = leagueSchool(me);
  const [consent, setConsent] = useState<boolean | null>(null);
  const [status, setStatus] = useState<CampusStatus | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!school) return;
    const c = await hasConsent();
    setConsent(c);
    if (!c) return;
    setLoading(true);
    const st = await fetchCampusStatus(school);
    setLoading(false);
    setFailed(!st);
    setStatus(st);
  }, [school]);

  useEffect(() => {
    load().catch(() => {});
    const off = onProfileChanged(() => load().catch(() => {}));
    return off;
  }, [load]);

  if (!school) return null;
  const s = shortSchool(school);

  if (consent === false) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardKicker}>{t.cardKicker}</Text>
        <Text style={styles.cardTitle}>{s}</Text>
        <Text style={styles.cardSub}>{t.cardNoConsent}</Text>
        <Pressable
          style={[styles.callBtn, { alignSelf: 'flex-start', marginTop: 12, backgroundColor: ACCENT }]}
          onPress={async () => {
            tap(true);
            await saveSchool(school, true);
            load().catch(() => {});
          }}
          accessibilityRole="button"
        >
          <Text style={styles.callText}>{t.cardGiveConsent}</Text>
        </Pressable>
      </View>
    );
  }

  if (!status) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardKicker}>{t.cardKicker}</Text>
        <Text style={styles.cardTitle}>{s}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
          {loading ? <ActivityIndicator color={LAVENDER} size="small" /> : null}
          <Text style={styles.cardSub}>{loading ? t.cardLoading : failed ? t.cardError : t.cardLoading}</Text>
        </View>
      </View>
    );
  }

  const msg = shareMessage(status, school, lang);
  const call = (
    <Pressable
      style={({ pressed }) => [styles.callBtn, pressed && { opacity: 0.85 }]}
      onPress={() => {
        tap(true);
        shareCampusWhatsApp(msg, 'me_card').catch(() => {});
      }}
      accessibilityRole="button"
    >
      <Ionicons name="logo-whatsapp" size={14} color="#fff" />
      <Text style={styles.callText}>{t.cardCall}</Text>
    </Pressable>
  );

  // Pazartesi–Salı: geçen haftanın sonucu + yeni haftanın durumu
  if (isMondayOrTuesday()) {
    const newWeek = status.listed ? t.cardNewWeekListed : t.cardNewWeek(status.missing);
    if (status.lastListed && status.lastRanks) {
      const r = status.lastRanks;
      return (
        <View style={styles.card}>
          <Text style={styles.cardKicker}>{t.cardLastKicker(s.toLocaleUpperCase(lang === 'tr' ? 'tr-TR' : 'en-US'))}</Text>
          <View style={{ marginTop: 6, gap: 6 }}>
            {CAT_ORDER.map((k) => (
              <View key={k} style={styles.rankRowSm}>
                <Text style={styles.rankLabelSm}>{t.catShort[k]}</Text>
                <Text style={styles.rankValSm}>{r[k]}.</Text>
              </View>
            ))}
          </View>
          <View style={styles.cardRow}>
            <Text style={styles.cardSub}>{newWeek}</Text>
            {call}
          </View>
        </View>
      );
    }
    // Geçen hafta okuldan hiç kimse oynamadıysa "listeye giremedi" demeyiz; normal kart gösterilir
    if (!status.lastListed && status.lastPlayed && status.week) {
      return (
        <View style={[styles.card, { backgroundColor: '#2A1F3D' }]}>
          <Text style={styles.cardKicker}>{t.cardLastKicker(s.toLocaleUpperCase(lang === 'tr' ? 'tr-TR' : 'en-US'))}</Text>
          <Text style={[styles.cardTitle, { fontSize: 17 }]}>{t.cardNotListed}</Text>
          <View style={styles.cardRow}>
            <Text style={styles.cardSub}>{newWeek}</Text>
            {call}
          </View>
        </View>
      );
    }
  }

  const early = isEarly(status);
  const title = status.listed
    ? `✅ ${lang === 'tr' ? `${s} listede` : `${s} is on the list`}`
    : status.missing === 1
      ? `${s} · ${lang === 'tr' ? 'Son 1 kişi! 🔥' : 'Last 1 person! 🔥'}`
      : early
        ? statusTitle(status, school, lang)
        : `${s} · ${lang === 'tr' ? `${status.missing} kişi eksik` : `${status.missing} more needed`}`;
  const sub = status.listed
    ? t.cardListedSub
    : status.missing === 1
      ? t.cardLastSub
      : early
        ? statusSub(status, lang) ?? t.cardMissingSub
        : t.cardMissingSub;
  return (
    <View style={styles.card}>
      <Text style={styles.cardKicker}>{t.cardKicker}</Text>
      <Text style={styles.cardTitle}>{title}</Text>
      {!status.listed ? (
        <View style={[styles.lbar, styles.lbarDark]}>
          <View style={[styles.lbarFill, { width: `${progressWidth(status)}%`, backgroundColor: LAVENDER }]} />
        </View>
      ) : null}
      <View style={styles.cardRow}>
        <Text style={styles.cardSub}>{sub}</Text>
        {call}
      </View>
    </View>
  );
}

// ======================================================================== stiller
const styles = StyleSheet.create({
  // A1
  askRoot: { flex: 1, backgroundColor: NAVY, paddingHorizontal: 24 },
  askBody: { flex: 1, alignItems: 'center' },
  askKicker: { fontFamily: F.bold, fontSize: 12, letterSpacing: 2, color: AMBER },
  askEmoji: { fontSize: 72, marginTop: 44 },
  askTitle: { fontFamily: F.bold, fontSize: 28, lineHeight: 34, color: '#fff', textAlign: 'center', marginTop: 18 },
  askText: { fontFamily: F.regular, fontSize: 15, lineHeight: 22, color: '#C9D3EE', textAlign: 'center', marginTop: 14 },
  askYes: { height: 56, borderRadius: 18, backgroundColor: AMBER, alignItems: 'center', justifyContent: 'center' },
  askYesText: { fontFamily: F.bold, fontSize: 17, color: '#1B1B1B' },
  askNo: {
    height: 54,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  askNoText: { fontFamily: F.bold, fontSize: 16, color: '#fff' },

  // ortak alt panel
  backdrop: { flex: 1, backgroundColor: 'rgba(10,12,30,0.45)', justifyContent: 'flex-end' },
  pickWrap: { width: '100%' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 12 },
  pickSheet: { maxHeight: '92%' },
  grab: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: '#D9DBE1', marginBottom: 14 },
  sheetTitle: { fontFamily: F.bold, fontSize: 21, color: INK },
  sheetSub: { fontFamily: F.regular, fontSize: 13, color: MUTED, marginTop: 4 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0F1F4',
    borderRadius: 14,
    paddingHorizontal: 12,
    marginTop: 14,
    marginBottom: 4,
    height: 46,
  },
  searchInput: { flex: 1, fontFamily: F.regular, fontSize: 15, color: INK, paddingVertical: 0 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF0F3',
    gap: 10,
  },
  itemText: { flex: 1, fontFamily: F.regular, fontSize: 15, color: INK },
  itemOn: { fontFamily: F.bold, color: ACCENT },
  check: { width: 22, height: 22, borderRadius: 11, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' },
  consent: { flexDirection: 'row', gap: 10, backgroundColor: ACCENT_BG, borderRadius: 14, padding: 12, marginTop: 14 },
  consentOff: { backgroundColor: '#FFF4E5' },
  box: { width: 20, height: 20, borderRadius: 6, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  boxOff: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#C9A46A' },
  consentText: { flex: 1, fontFamily: F.regular, fontSize: 12.5, lineHeight: 17, color: '#2A2E5A' },
  primary: { height: 54, borderRadius: 16, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  primaryDis: { backgroundColor: '#C7CBE8' },
  primaryText: { fontFamily: F.bold, fontSize: 16, color: '#fff' },

  // B · okul kilidi
  badge: { width: 76, height: 76, borderRadius: 38, backgroundColor: ACCENT_BG, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  lockTitle: { fontFamily: F.bold, fontSize: 22, lineHeight: 28, color: INK, textAlign: 'center', marginTop: 14 },
  lockAccent: { color: ACCENT },
  lbar: { alignSelf: 'stretch', height: 10, borderRadius: 5, backgroundColor: '#EEF0F3', marginTop: 18, overflow: 'hidden' },
  lbarDark: { backgroundColor: 'rgba(255,255,255,0.15)', marginTop: 12 },
  lbarFill: { height: '100%', borderRadius: 5, backgroundColor: ACCENT },
  wa: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 8,
    height: 54,
    borderRadius: 16,
    backgroundColor: WA,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  waText: { fontFamily: F.bold, fontSize: 16, color: '#fff' },
  linkBtn: { paddingVertical: 10, paddingHorizontal: 16 },
  linkText: { fontFamily: F.bold, fontSize: 15, color: SOFT },

  // B6 · sonuç
  resRoot: { flex: 1, backgroundColor: NAVY, paddingHorizontal: 24 },
  close: { width: 40, height: 40, justifyContent: 'center' },
  resKicker: { fontFamily: F.bold, fontSize: 12, letterSpacing: 1.6, color: LAVENDER, textAlign: 'center' },
  resTitle: { fontFamily: F.bold, fontSize: 28, lineHeight: 36, color: '#fff', textAlign: 'center', marginTop: 10 },
  resAccent: { color: AMBER },
  rankRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  rankLabel: { fontFamily: F.medium, fontSize: 15, color: '#fff' },
  rankVal: { fontFamily: F.bold, fontSize: 15, color: AMBER },

  // Ben kartı
  card: { backgroundColor: NAVY_CARD, borderRadius: 22, padding: 16, marginBottom: 14 },
  cardKicker: { fontFamily: F.bold, fontSize: 11, letterSpacing: 1.4, color: LAVENDER },
  cardTitle: { fontFamily: F.bold, fontSize: 19, color: '#fff', marginTop: 4 },
  cardSub: { flexShrink: 1, fontFamily: F.regular, fontSize: 12.5, lineHeight: 17, color: '#C9D3EE' },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12 },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: WA,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 13,
  },
  callText: { fontFamily: F.bold, fontSize: 13, color: '#fff' },
  rankRowSm: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  rankLabelSm: { fontFamily: F.medium, fontSize: 13, color: '#fff' },
  rankValSm: { fontFamily: F.bold, fontSize: 13, color: AMBER },

  // A5 · hoş geldin şeridi
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#16161A',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  toastText: { fontFamily: F.regular, fontSize: 13.5, lineHeight: 19, color: '#fff' },
  toastBold: { fontFamily: F.bold },
});
