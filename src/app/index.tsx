import { ReactNode, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Circle, Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import * as Localization from 'expo-localization';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
  useFonts,
} from '@expo-google-fonts/dm-sans';
import { supabase } from '@/lib/supabase';

const SESSION_MS = 60 * 60 * 1000;
const APP_NAME = 'Kim Ne Yapıyor?';
const SPLASH_MS = 3500;

const F = { regular: 'DMSans_400Regular', medium: 'DMSans_500Medium', bold: 'DMSans_700Bold' };
const INK = '#16161a';
const SOFT = '#5b5b66';
const FAINT = '#8d8d98';
const BRAND = '#4F46E5';

type IconName = keyof typeof Ionicons.glyphMap;
type Peak = { hour: number; spread: number };
type Activity = {
  id: string;
  name: string;
  icon: IconName;
  bg: string;
  fg: string;
  world: number;
  country: number;
  peaks: Peak[];
};

const ACTIVITIES: Activity[] = [
  { id: 'lying', name: 'Uzanıyorum', icon: 'bed-outline', bg: '#E9EAFB', fg: '#4F46E5', world: 22, country: 30, peaks: [{ hour: 3, spread: 3.5 }] },
  { id: 'work', name: 'İşteyim', icon: 'briefcase-outline', bg: '#E6F0FE', fg: '#2563EB', world: 18, country: 14, peaks: [{ hour: 11, spread: 4.5 }] },
  { id: 'eat', name: 'Yemek yiyorum', icon: 'restaurant-outline', bg: '#FFF1E0', fg: '#D9730D', world: 7.5, country: 9, peaks: [{ hour: 8, spread: 1.3 }, { hour: 13, spread: 1.3 }, { hour: 19, spread: 1.3 }] },
  { id: 'travel', name: 'Yoldayım', icon: 'car-outline', bg: '#E4F5F5', fg: '#0E8A8A', world: 8, country: 10, peaks: [{ hour: 8, spread: 1.3 }, { hour: 18, spread: 1.3 }] },
  { id: 'study', name: 'Ders çalışıyorum', icon: 'book-outline', bg: '#FDEBF3', fg: '#C2417A', world: 6, country: 7, peaks: [{ hour: 20, spread: 4 }] },
  { id: 'sport', name: 'Spor yapıyorum', icon: 'barbell-outline', bg: '#E7F6EA', fg: '#1F8A3E', world: 4, country: 3, peaks: [{ hour: 19, spread: 3 }] },
  { id: 'tv', name: 'Dizi izliyorum', icon: 'tv-outline', bg: '#E9EDF2', fg: '#475569', world: 7, country: 8, peaks: [{ hour: 21, spread: 3 }] },
  { id: 'coffee', name: 'Kahve içiyorum', icon: 'cafe-outline', bg: '#F5EBE0', fg: '#8A5A2B', world: 5, country: 6, peaks: [{ hour: 9, spread: 2.5 }] },
  { id: 'gaming', name: 'Oyun oynuyorum', icon: 'game-controller-outline', bg: '#F0E6FB', fg: '#9333EA', world: 9, country: 6, peaks: [{ hour: 22, spread: 4 }] },
  { id: 'shop', name: 'Alışveriş yapıyorum', icon: 'cart-outline', bg: '#FFF6D9', fg: '#B7860B', world: 3.5, country: 3, peaks: [{ hour: 15, spread: 4 }] },
  { id: 'chores', name: 'Ev işi yapıyorum', icon: 'home-outline', bg: '#E5F4F9', fg: '#0B7BA3', world: 5, country: 2, peaks: [{ hour: 11, spread: 4 }] },
  { id: 'friends', name: 'Arkadaşlarla', icon: 'people-outline', bg: '#FFE9E4', fg: '#E0552F', world: 4.5, country: 2, peaks: [{ hour: 20, spread: 4 }] },
  { id: 'nothing', name: 'Hiçbir şey yapmıyorum', icon: 'ellipsis-horizontal-outline', bg: '#EFEFF1', fg: '#52525B', world: 6, country: 5, peaks: [{ hour: 16, spread: 5 }] },
  { id: 'bored', name: 'Sıkılıyorum', icon: 'sad-outline', bg: '#F3EFFF', fg: '#6D28D9', world: 7, country: 5, peaks: [{ hour: 15, spread: 5 }] },
  { id: 'scrolling', name: 'Telefonda geziniyorum', icon: 'phone-portrait-outline', bg: '#EAF4FB', fg: '#1D6FA5', world: 10, country: 8, peaks: [{ hour: 22, spread: 3 }] },
  { id: 'procrastinating', name: 'Erteliyorum', icon: 'time-outline', bg: '#FBEFF3', fg: '#9D174D', world: 8, country: 6, peaks: [{ hour: 15, spread: 4 }] },
  { id: 'resting', name: 'Dinleniyorum', icon: 'leaf-outline', bg: '#EFF3E8', fg: '#5B7A3A', world: 8, country: 6, peaks: [{ hour: 14, spread: 5 }] },
  { id: 'money', name: 'Borçlarımı düşünüyorum', icon: 'wallet-outline', bg: '#FEF6E7', fg: '#A66A00', world: 5, country: 4, peaks: [{ hour: 21, spread: 4 }] },
];

const FILTERS = [
  { id: 'world', label: 'Dünya' },
  { id: 'country', label: 'Ülkem' },
  { id: 'age', label: 'Yaşıtlarım' },
  { id: 'city', label: 'Şehrim' },
  { id: 'gender', label: 'Cinsiyetim' },
] as const;

const COUNTRIES = [
  'Türkiye', 'Almanya', 'Amerika Birleşik Devletleri', 'Azerbaycan', 'Birleşik Krallık',
  'Fransa', 'Hollanda', 'İtalya', 'İspanya', 'Kanada', 'Kuzey Kıbrıs', 'Diğer',
];
const REGION_TO_COUNTRY: Record<string, string> = {
  TR: 'Türkiye', DE: 'Almanya', US: 'Amerika Birleşik Devletleri', AZ: 'Azerbaycan',
  GB: 'Birleşik Krallık', FR: 'Fransa', NL: 'Hollanda', IT: 'İtalya', ES: 'İspanya',
  CA: 'Kanada', CY: 'Kuzey Kıbrıs',
};
const AGE_RANGES = ['18-24', '25-34', '35-44', '45-54', '55+'];
const GENDERS = ['Kadın', 'Erkek', 'Belirtmek istemiyorum'];
const NO_ANSWER = 'Belirtmek istemiyorum';

const CITIES = [
  'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Aksaray', 'Amasya', 'Ankara', 'Antalya',
  'Ardahan', 'Artvin', 'Aydın', 'Balıkesir', 'Bartın', 'Batman', 'Bayburt', 'Bilecik',
  'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa', 'Çanakkale', 'Çankırı', 'Çorum',
  'Denizli', 'Diyarbakır', 'Düzce', 'Edirne', 'Elazığ', 'Erzincan', 'Erzurum', 'Eskişehir',
  'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkâri', 'Hatay', 'Iğdır', 'Isparta', 'İstanbul',
  'İzmir', 'Kahramanmaraş', 'Karabük', 'Karaman', 'Kars', 'Kastamonu', 'Kayseri', 'Kilis',
  'Kırıkkale', 'Kırklareli', 'Kırşehir', 'Kocaeli', 'Konya', 'Kütahya', 'Malatya', 'Manisa',
  'Mardin', 'Mersin', 'Muğla', 'Muş', 'Nevşehir', 'Niğde', 'Ordu', 'Osmaniye', 'Rize',
  'Sakarya', 'Samsun', 'Siirt', 'Sinop', 'Sivas', 'Şanlıurfa', 'Şırnak', 'Tekirdağ',
  'Tokat', 'Trabzon', 'Tunceli', 'Uşak', 'Van', 'Yalova', 'Yozgat', 'Zonguldak',
];

type FilterId = (typeof FILTERS)[number]['id'];
type Profile = { country?: string; age?: string; city?: string; gender?: string };
type Ratio = { enough: boolean; pct?: number } | null;

let sessionPromise: Promise<boolean> | null = null;
function ensureSession() {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) return true;
      const { error } = await supabase.auth.signInAnonymously();
      return !error;
    })().then((ok) => {
      if (!ok) sessionPromise = null;
      return ok;
    });
  }
  return sessionPromise;
}

async function pushPresence(activityId: string, profile: Profile, consent: boolean) {
  if (!(await ensureSession())) return false;
  const p: Profile = consent ? profile : {};
  const { error } = await supabase.rpc('set_presence', {
    p_activity: activityId,
    p_country: p.country ?? null,
    p_age: p.age ?? null,
    p_city: p.city ?? null,
    p_gender: p.gender && p.gender !== NO_ANSWER ? p.gender : null,
  });
  return !error;
}

async function clearPresence() {
  if (await ensureSession()) await supabase.rpc('clear_presence');
}

async function fetchRatio(activityId: string, scope: string, value: string | null): Promise<Ratio> {
  if (!(await ensureSession())) return null;
  const { data, error } = await supabase.rpc('get_ratio', {
    p_activity: activityId,
    p_scope: scope,
    p_value: value,
  });
  if (error || !data) return null;
  return data as Ratio;
}

function formatPct(p: number) {
  return '%' + p.toFixed(1).replace('.', ',');
}

function circularDist(a: number, b: number) {
  const d = Math.abs(a - b) % 24;
  return d > 12 ? 24 - d : d;
}

function timeFactor(peaks: Peak[], hour: number) {
  let best = 0;
  for (const p of peaks) {
    const d = circularDist(hour, p.hour);
    const g = Math.exp(-(d * d) / (2 * p.spread * p.spread));
    if (g > best) best = g;
  }
  return 0.5 + 1.5 * best;
}

function clampPct(n: number) {
  return Math.max(0.5, Math.min(95, Math.round(n * 10) / 10));
}

function demoPct(base: number, seed: string) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const factor = 0.5 + ((h % 1000) / 1000) * 1.1;
  return base * factor;
}

function demoFor(a: Activity, filter: FilterId, value: string | null | undefined, hour: number) {
  const tf = timeFactor(a.peaks, hour);
  if (filter === 'world') return clampPct(a.world * tf);
  if (filter === 'country' && value === 'Türkiye') return clampPct(a.country * tf);
  return clampPct(demoPct(a.world, a.id + filter + (value ?? '')) * tf);
}

function lineFor(filter: FilterId, value?: string | null) {
  switch (filter) {
    case 'world':
      return 'Şu an dünyada seninle aynı şeyi yapanların oranı';
    case 'country':
      return `Şu an ülkende (${value}) seninle aynı şeyi yapanların oranı`;
    case 'age':
      return `Şu an ${value} yaş aralığında seninle aynı şeyi yapanların oranı`;
    case 'city':
      return `Şu an ${value} ilinde seninle aynı şeyi yapanların oranı`;
    case 'gender':
      return `Şu an ${value?.toLocaleLowerCase('tr-TR')} kullanıcılar arasında seninle aynı şeyi yapanların oranı`;
  }
}

function tap(select = false) {
  const p = select
    ? Haptics.selectionAsync()
    : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  p.catch(() => {});
}

function FadeIn({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const o = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(o, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, []);
  return <Animated.View style={[{ opacity: o }, style]}>{children}</Animated.View>;
}

function PressableScale({
  onPress,
  wrapStyle,
  style,
  children,
}: {
  onPress: () => void;
  wrapStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) =>
    Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => to(0.96)}
      onPressOut={() => to(1)}
      style={wrapStyle}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

function Buddy({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="11" fill={color} />
      <Circle cx="9.5" cy="10.5" r="1.3" fill="#ffffff" />
      <Circle cx="14.5" cy="10.5" r="1.3" fill="#ffffff" />
      <Path
        d="M9 14 Q12 16.5 15 14"
        stroke="#ffffff"
        strokeWidth={1.4}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

function Splash() {
  const rot = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(rot, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true })
    ).start();
    Animated.timing(fade, { toValue: 1, duration: 500, delay: 200, useNativeDriver: true }).start();
  }, []);
  const spin = rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <SafeAreaView style={styles.splashSafe}>
      <View style={styles.splashCenter}>
        <View style={styles.splashRingWrap}>
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Svg width={72} height={72} viewBox="0 0 72 72">
              <Circle cx={36} cy={36} r={30} stroke="#ffffff" strokeWidth={4.5} strokeOpacity={0.25} fill="none" />
              <Path d="M36 6 A30 30 0 0 1 66 36" stroke="#ffffff" strokeWidth={4.5} strokeLinecap="round" fill="none" />
            </Svg>
          </Animated.View>
          <View style={styles.splashIconCenter}>
            <Ionicons name="earth-outline" size={28} color="#ffffff" />
          </View>
        </View>
        <Animated.View style={{ opacity: fade, marginTop: 26 }}>
          <Text style={styles.splashQuestion}>Şu an dünyada{'\n'}kim ne yapıyor?</Text>
          <Text style={styles.splashHint}>Merak ediyorsan hemen öğren</Text>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const BIG = 88;
const BIG_H = 108;

function charWidth(ch: string) {
  if (ch >= '0' && ch <= '9') return BIG * 0.66;
  if (ch === ',') return BIG * 0.32;
  if (ch === '%') return BIG * 0.98;
  return BIG * 0.8;
}

function CountUp({ value, color }: { value: number; color: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setShown(v));
    return () => anim.removeListener(id);
  }, [anim]);
  useEffect(() => {
    anim.stopAnimation();
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: value,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [value]);

  const finalText = formatPct(value);
  const totalWidth = finalText.split('').reduce((sum, ch) => sum + charWidth(ch), 0);
  const text = formatPct(shown);

  return (
    <View style={{ width: totalWidth, height: BIG_H, flexDirection: 'row', overflow: 'visible' }}>
      {text.split('').map((ch, i) => (
        <Text
          key={i}
          numberOfLines={1}
          allowFontScaling={false}
          style={{
            width: charWidth(ch),
            height: BIG_H,
            textAlign: 'center',
            fontFamily: F.bold,
            fontSize: BIG,
            lineHeight: BIG_H,
            color,
          }}
        >
          {ch}
        </Text>
      ))}
    </View>
  );
}

function OptionPicker({
  title,
  options,
  onPick,
}: {
  title: string;
  options: string[];
  onPick: (v: string) => void;
}) {
  return (
    <View style={[styles.picker, { flex: 1 }]}>
      <Text style={styles.pickerTitle}>{title}</Text>
      <ScrollView>
        {options.map((o) => (
          <Pressable
            key={o}
            style={styles.row}
            onPress={() => {
              tap(true);
              onPick(o);
            }}
          >
            <Text style={styles.rowText}>{o}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function CityPicker({ onPick }: { onPick: (c: string) => void }) {
  const [q, setQ] = useState('');
  const query = q.toLocaleLowerCase('tr-TR');
  const list = CITIES.filter((c) => c.toLocaleLowerCase('tr-TR').includes(query));
  return (
    <View style={[styles.picker, { flex: 1 }]}>
      <Text style={styles.pickerTitle}>Hangi ilde yaşıyorsun?</Text>
      <TextInput style={styles.input} placeholder="İl ara" value={q} onChangeText={setQ} />
      <ScrollView keyboardShouldPersistTaps="handled">
        {list.map((c) => (
          <Pressable
            key={c}
            style={styles.row}
            onPress={() => {
              tap(true);
              onPick(c);
            }}
          >
            <Text style={styles.rowText}>{c}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function ConsentCard({
  fg,
  onAccept,
  onDecline,
}: {
  fg: string;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <View style={styles.consent}>
      <Text style={styles.pickerTitle}>Karşılaştırma için bilgi paylaşımı</Text>
      <Text style={styles.consentText}>
        Ülke, yaş aralığı, şehir ve cinsiyet bilgilerin, seçtiğin aktivite ile birlikte anonim
        olarak sunucuya gönderilir. Adın, e-postan ya da telefon numaran istenmez.
      </Text>
      <Text style={styles.consentText}>
        Bilgilerin yalnızca oranları hesaplamak için kullanılır ve aktivitenin geçerli olduğu 60
        dakika boyunca hesaba katılır. İstediğin zaman ana ekrandan silebilirsin.
      </Text>
      <Pressable style={[styles.primaryBtn, { backgroundColor: fg }]} onPress={onAccept}>
        <Text style={styles.primaryBtnText}>Kabul ediyorum</Text>
      </Pressable>
      <Pressable style={styles.ghostBtn} onPress={onDecline}>
        <Text style={styles.ghostBtnText}>Şimdi değil</Text>
      </Pressable>
    </View>
  );
}

function ShareCard({
  innerRef,
  activity,
  pct,
  line,
  isReal,
}: {
  innerRef: React.RefObject<View>;
  activity: Activity;
  pct: number;
  line: string;
  isReal: boolean;
}) {
  return (
    <View style={styles.shareCardWrap} pointerEvents="none">
      <View
        ref={innerRef}
        collapsable={false}
        style={[styles.shareCard, { backgroundColor: activity.fg }]}
      >
        <Text style={styles.shareBrandTop}>{APP_NAME}</Text>

        <View style={styles.shareMiddle}>
          <View style={styles.shareIconWrap}>
            <Ionicons name={activity.icon} size={30} color={activity.fg} />
          </View>
          <Text style={styles.sharePct}>{formatPct(pct)}</Text>
          <Text style={styles.shareLine}>{line}</Text>
          {!isReal ? <Text style={styles.shareNote}>Tahmini değer</Text> : null}
        </View>

        <View style={styles.shareCta}>
          <Text style={[styles.shareCtaText, { color: activity.fg }]}>
            Uygulamayı indir → Sen de dene
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const [fontsLoaded] = useFonts({ DMSans_400Regular, DMSans_500Medium, DMSans_700Bold });
  const [ready, setReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const [selected, setSelected] = useState<Activity | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [filter, setFilter] = useState<FilterId>('world');
  const [profile, setProfile] = useState<Profile>({});
  const [consent, setConsent] = useState(false);
  const [editing, setEditing] = useState(false);
  const [ratio, setRatio] = useState<Ratio>(null);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const reqId = useRef(0);
  const shareRef = useRef<View>(null);

  useEffect(() => {
    ensureSession();
    (async () => {
      const [p, c, s] = await Promise.all([
        AsyncStorage.getItem('profile'),
        AsyncStorage.getItem('consent'),
        AsyncStorage.getItem('session'),
      ]);
      let loadedProfile: Profile = p ? JSON.parse(p) : {};
      if (c === 'yes') setConsent(true);

      if (!loadedProfile.country) {
        try {
          const region = Localization.getLocales()[0]?.regionCode ?? '';
          const guessed = REGION_TO_COUNTRY[region] ?? 'Diğer';
          loadedProfile = { ...loadedProfile, country: guessed };
          AsyncStorage.setItem('profile', JSON.stringify(loadedProfile));
        } catch {}
      }
      setProfile(loadedProfile);

      if (s) {
        const saved = JSON.parse(s);
        const a = ACTIVITIES.find((x) => x.id === saved.activityId);
        if (a && Date.now() - saved.startedAt < SESSION_MS) {
          setSelected(a);
          setStartedAt(saved.startedAt);
        } else {
          AsyncStorage.removeItem('session');
        }
      }
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (ready && fontsLoaded) {
      const t = setTimeout(() => setSplashDone(true), SPLASH_MS);
      return () => clearTimeout(t);
    }
  }, [ready, fontsLoaded]);

  useEffect(() => {
    if (!selected) return;
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, [selected]);

  useEffect(() => {
    if (selected && startedAt && now - startedAt >= SESSION_MS) changeActivity();
  }, [now]);

  useEffect(() => {
    if (!selected) return;
    const value = filter === 'world' ? null : profile[filter as keyof Profile] ?? null;
    if (filter !== 'world' && (!consent || !value || value === NO_ANSWER)) {
      setRatio(null);
      setLoading(false);
      return;
    }
    const id = ++reqId.current;
    setLoading(true);
    fetchRatio(selected.id, filter, value).then((r) => {
      if (id === reqId.current) {
        setRatio(r);
        setLoading(false);
      }
    });
  }, [selected, filter, profile, consent, refreshKey]);

  function selectActivity(a: Activity) {
    tap();
    const t = Date.now();
    setSelected(a);
    setStartedAt(t);
    setNow(t);
    setFilter('world');
    setEditing(false);
    setRatio(null);
    AsyncStorage.setItem('session', JSON.stringify({ activityId: a.id, startedAt: t }));
    pushPresence(a.id, profile, consent).then(() => setRefreshKey((k) => k + 1));
  }

  function changeActivity() {
    AsyncStorage.removeItem('session');
    clearPresence();
    setSelected(null);
    setStartedAt(null);
    setEditing(false);
    setFilter('world');
    setRatio(null);
  }

  function saveProfile(next: Profile) {
    setProfile(next);
    AsyncStorage.setItem('profile', JSON.stringify(next));
    setEditing(false);
    if (selected) {
      const t = Date.now();
      setStartedAt(t);
      setNow(t);
      AsyncStorage.setItem('session', JSON.stringify({ activityId: selected.id, startedAt: t }));
      pushPresence(selected.id, next, consent).then(() => setRefreshKey((k) => k + 1));
    }
  }

  function acceptConsent() {
    tap();
    setConsent(true);
    AsyncStorage.setItem('consent', 'yes');
    if (selected) pushPresence(selected.id, profile, true).then(() => setRefreshKey((k) => k + 1));
  }

  function chooseFilter(id: FilterId) {
    tap(true);
    setFilter(id);
    setEditing(false);
  }

  function resetAll() {
    Alert.alert(
      'Bilgilerin silinsin mi?',
      'Ülke, yaş, şehir ve cinsiyet seçimlerin ile sunucudaki aktif kaydın silinir.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.multiRemove(['profile', 'consent', 'session']);
            await clearPresence();
            setProfile({});
            setConsent(false);
            setSelected(null);
            setStartedAt(null);
            setEditing(false);
            setFilter('world');
            setRatio(null);
          },
        },
      ]
    );
  }

  async function shareResult() {
    if (!selected || !shareRef.current) return;
    tap();
    try {
      const uri = await captureRef(shareRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
        width: 1080,
        height: 1080,
      });
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Sonucunu paylaş' });
      } else {
        Alert.alert('Paylaşım kullanılamıyor', 'Bu cihazda paylaşım penceresi açılamadı.');
      }
    } catch {
      Alert.alert('Bir sorun oluştu', 'Görsel oluşturulamadı, tekrar dener misin?');
    }
  }

  if (!ready || !fontsLoaded) return <SafeAreaView style={styles.safe} />;
  if (!splashDone) return <Splash />;

  if (selected) {
    const { bg, fg } = selected;
    const needsProfile = filter !== 'world';
    const value = needsProfile ? profile[filter as keyof Profile] : undefined;
    const picking = needsProfile && (!value || editing);
    const declined = filter === 'gender' && value === NO_ANSWER && !editing;

    const isReal = !!ratio?.enough && typeof ratio.pct === 'number';
    const hour = new Date(now).getHours();
    const pct = isReal ? (ratio!.pct as number) : demoFor(selected, filter, value, hour);
    const shareLine = lineFor(filter, value);

    const elapsed = startedAt ? now - startedAt : 0;
    const remainingMin = Math.max(0, Math.ceil((SESSION_MS - elapsed) / 60000));
    const remainingPct = Math.max(0, Math.min(100, 100 - (elapsed / SESSION_MS) * 100));

    let resultShown = false;
    let body;
    if (needsProfile && !consent) {
      body = (
        <ConsentCard fg={fg} onAccept={acceptConsent} onDecline={() => setFilter('world')} />
      );
    } else if (picking && filter === 'country') {
      body = (
        <OptionPicker
          title="Hangi ülkede yaşıyorsun?"
          options={COUNTRIES}
          onPick={(v) => saveProfile({ ...profile, country: v })}
        />
      );
    } else if (picking && filter === 'age') {
      body = (
        <OptionPicker
          title="Yaş aralığını seç"
          options={AGE_RANGES}
          onPick={(v) => saveProfile({ ...profile, age: v })}
        />
      );
    } else if (picking && filter === 'city') {
      body = <CityPicker onPick={(v) => saveProfile({ ...profile, city: v })} />;
    } else if (picking && filter === 'gender') {
      body = (
        <OptionPicker
          title="Cinsiyetini seç"
          options={GENDERS}
          onPick={(v) => saveProfile({ ...profile, gender: v })}
        />
      );
    } else if (declined) {
      body = (
        <View style={styles.center}>
          <Text style={styles.line}>Cinsiyetini belirtmediğin için bu filtre kapalı.</Text>
          <Pressable
            style={[styles.primaryBtn, { backgroundColor: fg }]}
            onPress={() => setEditing(true)}
          >
            <Text style={styles.primaryBtnText}>Cinsiyetimi seç</Text>
          </Pressable>
        </View>
      );
    } else if (loading) {
      body = (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={fg} />
        </View>
      );
    } else {
      resultShown = true;
      body = (
        <View style={styles.center}>
          <View style={[styles.badge, isReal ? styles.badgeLive : styles.badgeEst]}>
            <Text style={[styles.badgeText, isReal ? styles.badgeTextLive : styles.badgeTextEst]}>
              {isReal ? 'Canlı' : 'Tahmini'}
            </Text>
          </View>
          <CountUp value={pct} color={fg} />
          <Text style={styles.line}>{lineFor(filter, value)}</Text>
          <Text style={styles.note}>
            {isReal
              ? 'Oran, uygulamayı kullananlar arasındadır.'
              : 'Bu bölgede henüz yeterli aktif kullanıcı yok. Gösterilen değer, geçmiş kullanım eğilimlerine dayanan bir tahmindir.'}
          </Text>
        </View>
      );
    }

    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: bg }]}>
        <FadeIn style={styles.resultContainer}>
          <View style={styles.topRow}>
            <View style={styles.chip}>
              <Ionicons name={selected.icon} size={18} color={fg} />
              <Text style={[styles.chipText, { color: fg }]}>{selected.name}</Text>
            </View>
          </View>

          <View style={styles.filterRow}>
            {FILTERS.map((f) => (
              <Pressable
                key={f.id}
                style={[styles.filterBtn, filter === f.id && { backgroundColor: fg }]}
                onPress={() => chooseFilter(f.id)}
              >
                <Text style={[styles.filterText, filter === f.id && styles.filterTextActive]}>
                  {f.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {needsProfile && consent && value && !editing && !declined ? (
            <Pressable onPress={() => setEditing(true)}>
              <Text style={[styles.editLink, { color: fg }]}>{value} · Değiştir</Text>
            </Pressable>
          ) : null}

          {body}

          <View style={styles.timerBox}>
            <View style={styles.timerLabels}>
              <Text style={styles.timerText}>{remainingMin} dk sonra otomatik biter</Text>
              <Text style={styles.timerText}>60 dk</Text>
            </View>
            <View style={styles.timerTrack}>
              <View
                style={[styles.timerFill, { width: `${remainingPct}%`, backgroundColor: fg }]}
              />
            </View>
          </View>

          <View style={styles.buttonsRow}>
            {resultShown ? (
              <Pressable
                style={[styles.button, styles.shareBtn, { backgroundColor: fg }]}
                onPress={shareResult}
              >
                <Ionicons name="share-outline" size={17} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={[styles.buttonText, { color: '#ffffff' }]}>Paylaş</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={[styles.button, resultShown && { flex: 1 }]}
              onPress={() => {
                tap();
                changeActivity();
              }}
            >
              <Text style={styles.buttonText}>← Değiştir</Text>
            </Pressable>
          </View>
        </FadeIn>

        <ShareCard innerRef={shareRef} activity={selected} pct={pct} line={shareLine} isReal={isReal} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <FadeIn style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.title}>
            Şu an <Text style={styles.titleAccent}>SEN</Text> ne yapıyorsun?
          </Text>
          <Text style={styles.subtitle}>Birine dokun, dünyayla karşılaştır.</Text>

          <View style={styles.grid}>
            {ACTIVITIES.map((a) => (
              <PressableScale
                key={a.id}
                wrapStyle={styles.cardWrap}
                style={styles.card}
                onPress={() => selectActivity(a)}
              >
                <View style={styles.iconStack}>
                  <View style={[styles.iconWrap, { backgroundColor: a.bg }]}>
                    <Ionicons name={a.icon} size={18} color={a.fg} />
                  </View>
                  <View style={styles.miniBuddy}>
                    <Buddy color={a.fg} size={13} />
                  </View>
                </View>
                <Text style={styles.name} numberOfLines={2}>
                  {a.name}
                </Text>
              </PressableScale>
            ))}
          </View>

          {consent || Object.values(profile).some(Boolean) ? (
            <Pressable onPress={resetAll}>
              <Text style={styles.resetLink}>Kayıtlı bilgilerimi sıfırla</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </FadeIn>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#ffffff' },
  container: { padding: 18, paddingBottom: 28 },
  title: { fontFamily: F.bold, fontSize: 28, color: INK, marginTop: 8, letterSpacing: -0.5 },
  titleAccent: { color: BRAND },
  subtitle: { fontFamily: F.regular, fontSize: 14, color: SOFT, marginTop: 4, marginBottom: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cardWrap: { width: '31.5%' },
  card: {
    height: 104,
    borderRadius: 16,
    padding: 10,
    justifyContent: 'space-between',
    backgroundColor: '#F5F6F8',
  },
  iconStack: { position: 'relative', width: 34, height: 34 },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniBuddy: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#F5F6F8',
    overflow: 'hidden',
  },
  name: {
    fontFamily: F.bold,
    fontSize: 12.5,
    color: INK,
    lineHeight: 17,
    minHeight: 36,
  },
  resetLink: {
    fontFamily: F.regular,
    fontSize: 13,
    color: FAINT,
    textAlign: 'center',
    marginTop: 24,
    textDecorationLine: 'underline',
  },

  splashSafe: { flex: 1, backgroundColor: BRAND },
  splashCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  splashRingWrap: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  splashIconCenter: { position: 'absolute' },
  splashQuestion: {
    fontFamily: F.bold,
    fontSize: 24,
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 32,
  },
  splashHint: {
    fontFamily: F.regular,
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    marginTop: 10,
  },

  resultContainer: { flex: 1, padding: 20, paddingBottom: 16 },
  topRow: { flexDirection: 'row' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: { fontFamily: F.medium, fontSize: 14 },

  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 },
  filterBtn: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  filterText: { fontFamily: F.medium, fontSize: 14, color: SOFT },
  filterTextActive: { color: '#ffffff' },
  editLink: {
    fontFamily: F.medium,
    fontSize: 14,
    marginTop: 12,
    textDecorationLine: 'underline',
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  badge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 10 },
  badgeLive: { backgroundColor: '#E3F6E8' },
  badgeEst: { backgroundColor: '#F0F1F3' },
  badgeText: { fontFamily: F.bold, fontSize: 12 },
  badgeTextLive: { color: '#1f7a3d' },
  badgeTextEst: { color: '#44464C' },
  line: {
    fontFamily: F.regular,
    fontSize: 17,
    color: SOFT,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 20,
    lineHeight: 24,
  },
  note: {
    fontFamily: F.regular,
    fontSize: 12,
    color: FAINT,
    marginTop: 12,
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 17,
  },
  primaryBtn: {
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 22,
    marginTop: 18,
    alignItems: 'center',
  },
  primaryBtnText: { fontFamily: F.medium, color: '#ffffff', fontSize: 15 },
  ghostBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  ghostBtnText: { fontFamily: F.regular, color: SOFT, fontSize: 15 },

  consent: { flex: 1, paddingTop: 16 },
  consentText: { fontFamily: F.regular, fontSize: 15, color: '#333', lineHeight: 22, marginBottom: 10 },

  picker: { paddingTop: 16, paddingBottom: 8 },
  pickerTitle: { fontFamily: F.bold, fontSize: 20, color: INK, marginBottom: 12 },
  row: {
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    marginBottom: 8,
  },
  rowText: { fontFamily: F.regular, fontSize: 16, color: INK },
  input: {
    fontFamily: F.regular,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 16,
    marginBottom: 10,
  },

  timerBox: { marginBottom: 14, marginTop: 8 },
  timerLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  timerText: { fontFamily: F.regular, fontSize: 12, color: SOFT },
  timerTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 3 },
  timerFill: { height: 6, borderRadius: 3 },

  buttonsRow: { flexDirection: 'row', gap: 10 },
  button: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  shareBtn: { flexDirection: 'row', justifyContent: 'center' },
  buttonText: { fontFamily: F.medium, fontSize: 16, color: INK },

  shareCardWrap: { position: 'absolute', top: 0, left: 0, opacity: 0 },
  shareCard: {
    width: 320,
    height: 320,
    borderRadius: 28,
    padding: 24,
    justifyContent: 'space-between',
  },
  shareBrandTop: {
    fontFamily: F.bold,
    fontSize: 15,
    color: '#ffffff',
    textAlign: 'center',
  },
  shareMiddle: { alignItems: 'center' },
  shareIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  sharePct: { fontFamily: F.bold, fontSize: 56, color: '#ffffff', letterSpacing: -2 },
  shareLine: {
    fontFamily: F.medium,
    fontSize: 14,
    color: '#ffffff',
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 8,
  },
  shareNote: { fontFamily: F.regular, fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 6 },
  shareCta: {
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  shareCtaText: { fontFamily: F.bold, fontSize: 14 },
});