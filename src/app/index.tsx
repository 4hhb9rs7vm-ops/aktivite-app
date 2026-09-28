import { ComponentType, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Defs, LinearGradient, RadialGradient, Rect, Stop, Svg } from 'react-native-svg';
import {
  Armchair,
  Barbell,
  Bed,
  BookOpen,
  BellRinging,
  Briefcase,
  Broom,
  Cake,
  Car,
  Coffee,
  CookingPot,
  DeviceMobile,
  FlowerLotus,
  Flag,
  ForkKnife,
  GameController,
  GenderIntersex,
  GlobeHemisphereEast,
  HeartBreak,
  Hourglass,
  Leaf,
  MapPin,
  ShoppingCart,
  Smiley,
  SmileyAngry,
  SmileySad,
  Television,
  UsersThree,
  Wallet,
} from 'phosphor-react-native';
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
import {
  activityName,
  COUNTRY_TR,
  countryFromRegion,
  countryLabel,
  countryOptions,
  dayPart,
  formatCount,
  formatPct,
  GENDER_VALUES,
  genderLabel,
  Lang,
  loadLang,
  momentLabel,
  ratioLine,
  saveLang,
  STRINGS,
  Strings,
} from '@/lib/i18n';
import { buildStory, Story } from '@/lib/shareCard';
import {
  getTodayMoment,
  hasNotificationPermission,
  requestNotificationPermission,
  scheduleDailyMoments,
} from '@/lib/notifications';

const SESSION_MS = 60 * 60 * 1000;
const INSTA_HANDLE = '@suan.app';
const SPLASH_MS = 3500;
const PRIVACY_URLS: Record<Lang, string> = {
  tr: 'https://4hhb9rs7vm-ops.github.io/aktivite-app/gizlilik/',
  en: 'https://4hhb9rs7vm-ops.github.io/aktivite-app/privacy/',
};
const DASHBOARD_THRESHOLD = 5000;
const ACTIVE_COUNT_POLL_MS = 45 * 1000;
const HERO_COUNT_THRESHOLD = 1000; // Bu sayının üstünde aktif kişi sayısı gösterilir
const RATIO_POLL_MS = 40 * 1000; // Veri yokken oran bu aralıkla yeniden kontrol edilir
const NOTIF_ASKED_KEY = 'notif_asked_v2';
const NOTIF_ASK_DELAY_MS = 2500;

const F = { regular: 'DMSans_400Regular', medium: 'DMSans_500Medium', bold: 'DMSans_700Bold' };
const INK = '#16161a';
const SOFT = '#5b5b66';
const FAINT = '#8d8d98';
const BRAND = '#4F46E5';
const LOGO_NAVY = '#0F2A52';

const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };
const FS = { xs: 12, sm: 13, base: 14, md: 15, lg: 17, xl: 20, xxl: 28 };

const DUR = 220;
const EASE = Easing.out(Easing.cubic);

const CARD_SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.06,
  shadowRadius: 10,
  elevation: 3,
};
// Ekranı tamamen kaplayan katman (StyleSheet.absoluteFillObject yerine, her sürümde çalışır)
const ABS_FILL = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};
const SOFT_SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.04,
  shadowRadius: 6,
  elevation: 2,
};

const PALETTE = {
  indigo: { bg: '#EEF0FF', fg: '#4F46E5', grad: ['#8B7CF6', '#4338CA'] as [string, string] },
  teal: { bg: '#E6F7F7', fg: '#0E8A8A', grad: ['#2DD4C7', '#0F766E'] as [string, string] },
  amber: { bg: '#FFF3E4', fg: '#B45309', grad: ['#FBBF24', '#B45309'] as [string, string] },
  rose: { bg: '#FFF1F2', fg: '#E11D48', grad: ['#FB7185', '#BE123C'] as [string, string] },
};

type PhIcon = ComponentType<{
  size?: number;
  color?: string;
  weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
}>;
type Peak = { hour: number; spread: number };
type Activity = {
  id: string;
  name: string;
  icon: PhIcon;
  bg: string;
  fg: string;
  grad: [string, string];
  world: number;
  country: number;
  peaks: Peak[];
  mood?: boolean;
};

const ACTIVITIES: Activity[] = [
  { id: 'lying', name: 'Uzanıyorum', icon: Bed, ...PALETTE.indigo, world: 22, country: 30, peaks: [{ hour: 3, spread: 3.5 }] },
  { id: 'work', name: 'İşteyim', icon: Briefcase, ...PALETTE.indigo, world: 18, country: 14, peaks: [{ hour: 11, spread: 4.5 }] },
  { id: 'eat', name: 'Yemek yiyorum', icon: ForkKnife, ...PALETTE.amber, world: 7.5, country: 9, peaks: [{ hour: 8, spread: 1.3 }, { hour: 13, spread: 1.3 }, { hour: 19, spread: 1.3 }] },
  { id: 'cook', name: 'Yemek yapıyorum', icon: CookingPot, ...PALETTE.amber, world: 5, country: 7, peaks: [{ hour: 12, spread: 1.3 }, { hour: 18.5, spread: 1.5 }] },
  { id: 'travel', name: 'Yoldayım', icon: Car, ...PALETTE.teal, world: 8, country: 10, peaks: [{ hour: 8, spread: 1.3 }, { hour: 18, spread: 1.3 }] },
  { id: 'study', name: 'Ders çalışıyorum', icon: BookOpen, ...PALETTE.indigo, world: 6, country: 7, peaks: [{ hour: 20, spread: 4 }] },
  { id: 'sport', name: 'Spor yapıyorum', icon: Barbell, ...PALETTE.teal, world: 4, country: 3, peaks: [{ hour: 19, spread: 3 }] },
  { id: 'tv', name: 'Dizi/film izliyorum', icon: Television, ...PALETTE.rose, world: 7, country: 8, peaks: [{ hour: 21, spread: 3 }] },
  { id: 'coffee', name: 'Kahve içiyorum', icon: Coffee, ...PALETTE.amber, world: 5, country: 6, peaks: [{ hour: 9, spread: 2.5 }] },
  { id: 'gaming', name: 'Oyun oynuyorum', icon: GameController, ...PALETTE.rose, world: 9, country: 6, peaks: [{ hour: 22, spread: 4 }] },
  { id: 'shop', name: 'Alışveriş yapıyorum', icon: ShoppingCart, ...PALETTE.amber, world: 3.5, country: 3, peaks: [{ hour: 15, spread: 4 }] },
  { id: 'chores', name: 'Ev işi yapıyorum', icon: Broom, ...PALETTE.teal, world: 5, country: 2, peaks: [{ hour: 11, spread: 4 }] },
  { id: 'friends', name: 'Arkadaşlarımla birlikteyim', icon: UsersThree, ...PALETTE.rose, world: 4.5, country: 2, peaks: [{ hour: 20, spread: 4 }] },
  { id: 'scrolling', name: 'Telefonda geziniyorum', icon: DeviceMobile, ...PALETTE.rose, world: 10, country: 8, peaks: [{ hour: 22, spread: 3 }] },
  { id: 'resting', name: 'Dinleniyorum', icon: Leaf, ...PALETTE.teal, world: 8, country: 6, peaks: [{ hour: 14, spread: 5 }] },
  { id: 'happy', name: 'Neşeliyim', icon: Smiley, ...PALETTE.indigo, world: 8, country: 7, peaks: [{ hour: 20, spread: 5 }], mood: true },
  { id: 'calm', name: 'Huzurluyum', icon: FlowerLotus, ...PALETTE.indigo, world: 6, country: 5, peaks: [{ hour: 10, spread: 5 }], mood: true },
  { id: 'hurt', name: 'Kırgınım', icon: HeartBreak, ...PALETTE.indigo, world: 4, country: 4, peaks: [{ hour: 22, spread: 4 }], mood: true },
  { id: 'angry', name: 'Öfkeliyim', icon: SmileyAngry, ...PALETTE.indigo, world: 4, country: 4, peaks: [{ hour: 18, spread: 4 }], mood: true },
  { id: 'bored', name: 'Sıkılıyorum', icon: SmileySad, ...PALETTE.indigo, world: 7, country: 5, peaks: [{ hour: 15, spread: 5 }], mood: true },
  { id: 'procrastinating', name: 'Erteliyorum', icon: Hourglass, ...PALETTE.indigo, world: 8, country: 6, peaks: [{ hour: 15, spread: 4 }], mood: true },
  { id: 'nothing', name: 'Boş boş oturuyorum', icon: Armchair, ...PALETTE.indigo, world: 6, country: 5, peaks: [{ hour: 16, spread: 5 }], mood: true },
  { id: 'money', name: 'Borçları düşünüyorum', icon: Wallet, ...PALETTE.indigo, world: 5, country: 4, peaks: [{ hour: 21, spread: 4 }], mood: true },
];

const ACTIVITIES_BY_ID: Record<string, Activity> = Object.fromEntries(ACTIVITIES.map((a) => [a.id, a]));

const FILTERS = [
  { id: 'world', label: 'Dünya' },
  { id: 'country', label: 'Ülke' },
  { id: 'city', label: 'Şehir' },
  { id: 'age', label: 'Yaş' },
  { id: 'gender', label: 'Cinsiyet' },
] as const;

const AGE_RANGES = ['18-24', '25-34', '35-44', '45-54', '55+'];

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

// Filtre simgeleri (karşılaştırma satırı)
const FILTER_ICONS: Record<FilterId, ComponentType<{ size?: number; color?: string; weight?: any }>> = {
  world: GlobeHemisphereEast,
  country: Flag,
  city: MapPin,
  age: Cake,
  gender: GenderIntersex,
};
type Ratio = { enough: boolean; pct?: number } | null;
type DashboardRow = { activity: string; cnt: number };

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
    p_gender: p.gender ?? null,
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

async function fetchActiveCount(): Promise<number | null> {
  if (!(await ensureSession())) return null;
  const { data, error } = await supabase.rpc('get_active_count');
  if (error || typeof data !== 'number') return null;
  return data;
}

async function fetchDashboard(): Promise<DashboardRow[] | null> {
  if (!(await ensureSession())) return null;
  const { data, error } = await supabase.rpc('get_dashboard');
  if (error || !Array.isArray(data)) return null;
  return data as DashboardRow[];
}

// "Günün Anı" bildirim kartı gösterilmeli mi? (sadece bir kez sorulur)
async function shouldAskNotifications(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    if ((await AsyncStorage.getItem(NOTIF_ASKED_KEY)) === 'yes') return false;
    if (await hasNotificationPermission()) {
      await AsyncStorage.setItem(NOTIF_ASKED_KEY, 'yes');
      scheduleDailyMoments().catch(() => {});
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// Gündüz (09:00-18:00) standart ilk üç aktivite
const WEEKDAY_TOP = ['work', 'coffee', 'shop'];
const WEEKEND_TOP = ['shop', 'gaming', 'sport'];
const LIVE_WEIGHT = 0.5; // Karma yöntemde gerçek verinin ağırlığı

// Saate göre tahmini puan (0-1 arası); gündüz standart üçlü en üstte
function baselineScores(date: Date): Record<string, number> {
  const hour = date.getHours();
  const day = date.getDay();
  const weekend = day === 0 || day === 6;
  const main = ACTIVITIES.filter((a) => !a.mood);
  const raw: Record<string, number> = {};
  let max = 0;
  for (const a of main) {
    raw[a.id] = timeFactor(a.peaks, hour) * a.world;
    if (raw[a.id] > max) max = raw[a.id];
  }
  const scores: Record<string, number> = {};
  for (const a of main) scores[a.id] = max > 0 ? (raw[a.id] / max) * 0.9 : 0;
  if (hour >= 9 && hour < 18) {
    const top = weekend ? WEEKEND_TOP : WEEKDAY_TOP;
    top.forEach((id, i) => {
      scores[id] = 1 + (top.length - i) * 0.01;
    });
  }
  return scores;
}

// Ana aktiviteleri sırala: canlı veri varsa tahminle yarı yarıya karıştır
function rankMainActivities(date: Date, liveRows: DashboardRow[] | null): Activity[] {
  const base = baselineScores(date);
  let live: Record<string, number> | null = null;
  if (liveRows && liveRows.length > 0) {
    const maxCnt = Math.max(...liveRows.map((r) => r.cnt));
    if (maxCnt > 0) {
      live = {};
      for (const r of liveRows) live[r.activity] = r.cnt / maxCnt;
    }
  }
  const score = (a: Activity) => {
    const b = base[a.id] ?? 0;
    if (!live) return b;
    return (1 - LIVE_WEIGHT) * b + LIVE_WEIGHT * (live[a.id] ?? 0);
  };
  return ACTIVITIES.filter((a) => !a.mood).sort((a, b) => score(b) - score(a));
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

function tap(select = false) {
  const p = select
    ? Haptics.selectionAsync()
    : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  p.catch(() => {});
}

function FadeIn({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const o = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(o, { toValue: 1, duration: DUR, easing: EASE, useNativeDriver: true }).start();
  }, []);
  return <Animated.View style={[{ opacity: o }, style]}>{children}</Animated.View>;
}

function StaggerIn({
  delay,
  style,
  children,
}: {
  delay: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const o = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(10)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(o, { toValue: 1, duration: DUR, delay, easing: EASE, useNativeDriver: true }),
      Animated.timing(y, { toValue: 0, duration: DUR, delay, easing: EASE, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={[style, { opacity: o, transform: [{ translateY: y }] }]}>
      {children}
    </Animated.View>
  );
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
    Animated.timing(scale, { toValue: v, duration: DUR / 2, easing: EASE, useNativeDriver: true }).start();
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

function ActivityIcon({
  activity,
  size = 40,
  iconSize = 22,
  bg,
}: {
  activity: Activity;
  size?: number;
  iconSize?: number;
  bg?: string;
}) {
  const Icon = activity.icon;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        backgroundColor: bg ?? activity.bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon size={iconSize} color={activity.fg} weight="duotone" />
    </View>
  );
}

// Ana ekran üst alanındaki dağınık insan figürleri (logodaki motif)
const HERO_PEOPLE = [
  { x: 10, y: 22, s: 16, o: 0.18 },
  { x: 42, y: 4, s: 14, o: 0.18 },
  { x: 76, y: 14, s: 20, o: 0.32 },
  { x: 112, y: 2, s: 14, o: 0.18 },
  { x: 28, y: 54, s: 18, o: 0.28 },
  { x: 66, y: 60, s: 14, o: 0.18 },
  { x: 102, y: 44, s: 24, o: 0.45 },
  { x: 132, y: 78, s: 14, o: 0.18 },
  { x: 86, y: 96, s: 16, o: 0.22 },
  { x: 48, y: 100, s: 12, o: 0.16 },
];

function HeroPeople() {
  return (
    <View style={styles.heroPeople} pointerEvents="none">
      {HERO_PEOPLE.map((p, i) => (
        <Ionicons
          key={i}
          name="person"
          size={p.s}
          color="#ffffff"
          style={{ position: 'absolute', left: p.x, top: p.y, opacity: p.o }}
        />
      ))}
    </View>
  );
}

function Sparkles({ color }: { color: string }) {
  const positions = [
    { x: -78, y: -6 },
    { x: 64, y: -26 },
    { x: -46, y: -58 },
    { x: 44, y: 14 },
    { x: -96, y: 34 },
    { x: 86, y: -64 },
  ];
  const vals = useRef(positions.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    const anims = vals.map((v, i) =>
      Animated.timing(v, { toValue: 1, duration: 900, delay: i * 70, easing: EASE, useNativeDriver: true })
    );
    Animated.stagger(0, anims).start();
  }, []);
  return (
    <View style={ABS_FILL} pointerEvents="none">
      {vals.map((v, i) => {
        const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [0, -42] });
        const opacity = v.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 1, 1, 0] });
        const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
        const pos = positions[i];
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: '50%',
              top: '36%',
              marginLeft: pos.x,
              marginTop: pos.y,
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: color,
              opacity,
              transform: [{ translateY }, { scale }],
            }}
          />
        );
      })}
    </View>
  );
}

const LOGO_POINTS: { x: number; y: number; big?: boolean }[] = [
  { x: 120, y: 92 },
  { x: 158, y: 70 },
  { x: 200, y: 64 },
  { x: 242, y: 76 },
  { x: 272, y: 106 },
  { x: 282, y: 146 },
  { x: 266, y: 184 },
  { x: 238, y: 214 },
  { x: 214, y: 246 },
  { x: 200, y: 280 },
  { x: 200, y: 320, big: true },
];
const LOGO_BOX = 380;
const LOGO_CANVAS = 176;
const LOGO_SCALE = LOGO_CANVAS / LOGO_BOX;

function SplashLogo() {
  const anims = useRef(LOGO_POINTS.map(() => new Animated.Value(0))).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const seq = anims.map((v, i) =>
      Animated.spring(v, {
        toValue: 1,
        useNativeDriver: true,
        delay: i * 65,
        speed: 14,
        bounciness: 9,
      })
    );
    Animated.stagger(0, seq).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, easing: EASE, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1400, easing: EASE, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.06] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.16, 0.32] });

  return (
    <View style={{ width: LOGO_CANVAS, height: LOGO_CANVAS }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: LOGO_CANVAS,
          height: LOGO_CANVAS,
          borderRadius: LOGO_CANVAS / 2,
          backgroundColor: '#ffffff',
          opacity: pulseOpacity,
          transform: [{ scale: pulseScale }],
        }}
      />
      {LOGO_POINTS.map((p, i) => {
        const v = anims[i];
        const angle = (i / LOGO_POINTS.length) * Math.PI * 2;
        const fromX = Math.cos(angle) * 130;
        const fromY = Math.sin(angle) * 130;
        const translateX = v.interpolate({ inputRange: [0, 1], outputRange: [fromX, 0] });
        const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [fromY, 0] });
        const opacity = v.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 1, 1] });
        const iconSize = (p.big ? 30 : 20) * LOGO_SCALE * 2.1;
        const left = p.x * LOGO_SCALE - iconSize / 2;
        const top = p.y * LOGO_SCALE - iconSize / 2;
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left,
              top,
              opacity,
              transform: [{ translateX }, { translateY }],
            }}
          >
            <Ionicons name="person" size={iconSize} color="#ffffff" />
          </Animated.View>
        );
      })}
    </View>
  );
}

function MiniLogoMark({ color = '#ffffff', size = 16 }: { color?: string; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
      <Ionicons name="person" size={size * 0.72} color={color} style={{ opacity: 0.6 }} />
      <Ionicons name="person" size={size} color={color} />
      <Ionicons name="person" size={size * 0.72} color={color} style={{ opacity: 0.6 }} />
    </View>
  );
}

function InstaBadge({ size = 22 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, marginRight: 7 }}>
      <Svg width={size} height={size} viewBox="0 0 26 26">
        <Defs>
          <LinearGradient id="ig" x1="0" y1="26" x2="26" y2="0">
            <Stop offset="0" stopColor="#FEDA75" />
            <Stop offset="0.35" stopColor="#FA7E1E" />
            <Stop offset="0.65" stopColor="#D62976" />
            <Stop offset="1" stopColor="#962FBF" />
          </LinearGradient>
        </Defs>
        <Rect width="26" height="26" rx="7" fill="url(#ig)" />
      </Svg>
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="logo-instagram" size={size * 0.62} color="#ffffff" />
      </View>
    </View>
  );
}

function Splash({ tx }: { tx: Strings }) {
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: DUR, delay: 1300, easing: EASE, useNativeDriver: true }).start();
  }, []);
  return (
    <SafeAreaView style={styles.splashSafe}>
      <StatusBar style="light" />
      <View style={styles.splashCenter}>
        <SplashLogo />
        <Animated.View style={{ opacity: fade, marginTop: SP.xxl }}>
          <Text style={styles.splashQuestion}>{tx.splashQuestion}</Text>
          <Text style={styles.splashHint}>{tx.splashHint}</Text>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const BIG = 84;
const BIG_H = 104;

function charWidth(ch: string) {
  if (ch >= '0' && ch <= '9') return BIG * 0.66;
  if (ch === ',' || ch === '.') return BIG * 0.32;
  if (ch === '%') return BIG * 0.98;
  return BIG * 0.8;
}

function CountUp({ value, color, lang }: { value: number; color: string; lang: Lang }) {
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
      duration: 800,
      easing: EASE,
      useNativeDriver: false,
    }).start();
  }, [value]);

  const finalText = formatPct(value, lang);
  const totalWidth = finalText.split('').reduce((sum, ch) => sum + charWidth(ch), 0);
  const text = formatPct(shown, lang);

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

function CountUpInt({
  value,
  color,
  fontSize = 40,
  lang,
}: {
  value: number;
  color: string;
  fontSize?: number;
  lang: Lang;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setShown(Math.round(v)));
    return () => anim.removeListener(id);
  }, [anim]);
  useEffect(() => {
    anim.stopAnimation();
    anim.setValue(0);
    Animated.timing(anim, { toValue: value, duration: 900, easing: EASE, useNativeDriver: false }).start();
  }, [value]);
  return (
    <Text style={{ fontFamily: F.bold, fontSize, color }}>{formatCount(shown, lang)}</Text>
  );
}

type PickOption = { value: string; label: string };

function OptionPicker({
  title,
  options,
  onPick,
}: {
  title: string;
  options: PickOption[];
  onPick: (v: string) => void;
}) {
  return (
    <View style={styles.pickerOuter}>
      <Text style={styles.pickerTitle}>{title}</Text>
      <ScrollView>
        {options.map((o) => (
          <Pressable
            key={o.value}
            style={styles.row}
            onPress={() => {
              tap(true);
              onPick(o.value);
            }}
          >
            <Text style={styles.rowText}>{o.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

// Arama kutulu seçici (şehir ve ülke için)
function SearchPicker({
  title,
  placeholder,
  options,
  locale,
  onPick,
}: {
  title: string;
  placeholder: string;
  options: PickOption[];
  locale: string;
  onPick: (v: string) => void;
}) {
  const [q, setQ] = useState('');
  const query = q.toLocaleLowerCase(locale);
  const list = options.filter((o) => o.label.toLocaleLowerCase(locale).includes(query));
  return (
    <View style={styles.pickerOuter}>
      <Text style={styles.pickerTitle}>{title}</Text>
      <TextInput style={styles.input} placeholder={placeholder} value={q} onChangeText={setQ} />
      <ScrollView keyboardShouldPersistTaps="handled">
        {list.map((o) => (
          <Pressable
            key={o.value}
            style={styles.row}
            onPress={() => {
              tap(true);
              onPick(o.value);
            }}
          >
            <Text style={styles.rowText}>{o.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function ConsentCard({
  fg,
  tx,
  privacyUrl,
  onAccept,
  onDecline,
}: {
  fg: string;
  tx: Strings;
  privacyUrl: string;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <View style={styles.consentOuter}>
      <View style={styles.consentCard}>
        <Text style={styles.pickerTitle}>{tx.consentTitle}</Text>
        <Text style={styles.consentText}>{tx.consentP1}</Text>
        <Text style={styles.consentText}>{tx.consentP2}</Text>
        <Pressable onPress={() => Linking.openURL(privacyUrl)}>
          <Text style={[styles.privacyLink, { color: fg }]}>{tx.readPrivacy}</Text>
        </Pressable>
        <Pressable style={[styles.primaryBtn, { backgroundColor: fg }]} onPress={onAccept}>
          <Text style={styles.primaryBtnText}>{tx.accept}</Text>
        </Pressable>
        <Pressable style={styles.ghostBtn} onPress={onDecline}>
          <Text style={styles.ghostBtnText}>{tx.notNow}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function NotifPromptCard({
  fg,
  bg,
  tx,
  onAccept,
  onDecline,
}: {
  fg: string;
  bg: string;
  tx: Strings;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const o = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(24)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(o, { toValue: 1, duration: DUR, easing: EASE, useNativeDriver: true }),
      Animated.timing(y, { toValue: 0, duration: DUR + 120, easing: EASE, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={[styles.notifBackdrop, { opacity: o }]}>
      <Pressable style={ABS_FILL} onPress={onDecline} />
      <Animated.View style={[styles.notifCard, { transform: [{ translateY: y }] }]}>
        <View style={[styles.notifIconWrap, { backgroundColor: bg }]}>
          <BellRinging size={28} color={fg} weight="duotone" />
        </View>
        <Text style={styles.notifTitle}>{tx.notifTitle}</Text>
        <Text style={styles.notifText}>{tx.notifText}</Text>
        <Text style={styles.notifSub}>{tx.notifSub}</Text>
        <Pressable
          style={[styles.primaryBtn, styles.notifBtn, { backgroundColor: fg }]}
          onPress={onAccept}
        >
          <Text style={styles.primaryBtnText}>{tx.notifYes}</Text>
        </Pressable>
        <Pressable style={styles.ghostBtn} onPress={onDecline}>
          <Text style={styles.ghostBtnText}>{tx.notNow}</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

// Karşılaştırma filtreleri: başlık + simgeli seçenekler + eksik bilgide "+" işareti.
// hint=true olduğunda "Ülke" seçeneği birkaç kez hafifçe nabız atar (ilk sonuçta bir kez).
function FilterSegment({
  filters,
  active,
  fg,
  bg,
  profile,
  consent,
  lang,
  hint,
  onChoose,
}: {
  filters: ReadonlyArray<{ id: FilterId; label: string }>;
  active: FilterId;
  fg: string;
  bg: string;
  profile: Profile;
  consent: boolean;
  lang: Lang;
  hint: boolean;
  onChoose: (id: FilterId) => void;
}) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!hint) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 520, easing: EASE, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 520, easing: EASE, useNativeDriver: true }),
        Animated.delay(250),
      ]),
      { iterations: 3 }
    );
    anim.start();
    return () => anim.stop();
  }, [hint]);

  const title = lang === 'tr' ? 'Kimlerle karşılaştıralım?' : 'Compare with…';
  const labels: Record<FilterId, string> =
    lang === 'tr'
      ? { world: 'Dünya', country: 'Ülke', city: 'Şehir', age: 'Yaş', gender: 'Cinsiyet' }
      : { world: 'World', country: 'Country', city: 'City', age: 'Age', gender: 'Gender' };

  return (
    <View>
      <Text style={styles.segmentTitle}>{title}</Text>
      <View style={styles.segment}>
        {filters.map((f) => {
          const isActive = active === f.id;
          const Icon = FILTER_ICONS[f.id];
          const missing = f.id !== 'world' && !(consent && profile[f.id as keyof Profile]);
          const isHint = hint && f.id === 'country' && !isActive;
          const scale = isHint ? pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) : 1;
          return (
            <Animated.View key={f.id} style={[styles.segmentCell, { transform: [{ scale }] }]}>
              {isHint ? (
                <Animated.View
                  pointerEvents="none"
                  style={[styles.segmentHalo, { backgroundColor: bg, opacity: pulse }]}
                />
              ) : null}
              <Pressable
                style={[styles.segmentBtn, isActive && { backgroundColor: fg }]}
                onPress={() => onChoose(f.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
              >
                <View>
                  <Icon size={19} color={isActive ? '#ffffff' : SOFT} weight={isActive ? 'fill' : 'regular'} />
                  {missing ? (
                    <View
                      style={[
                        styles.segmentPlus,
                        { backgroundColor: isActive ? '#ffffff' : fg },
                      ]}
                    >
                      <Text style={[styles.segmentPlusText, { color: isActive ? fg : '#ffffff' }]}>+</Text>
                    </View>
                  ) : null}
                </View>
                <Text
                  style={[styles.segmentText, isActive && styles.segmentTextActive]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  {labels[f.id]}
                </Text>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

// Instagram hikâyesi kartı — Stil 1 (gece): lacivert zemin + aktivite renginde ışıma.
// 360x640 çizilir, 1080x1920 kaydedilir (3x). Svg boyutları bilerek sayı olarak verildi:
// ekran dışında çizilen görünümde "100%" yanlış hesaplanıp gradyanı küçültüyordu.
const STORY_W = 360;
const STORY_H = 640;
const STORY_BG = '#0E2850';
const STORY_ACCENT = '#FBBF24';

function StoryCard({ innerRef, story }: { innerRef: React.RefObject<View>; story: Story }) {
  const glow = story.colors[1];
  const noData = story.tier === 'none';
  return (
    <View style={styles.shareCardWrap} pointerEvents="none">
      <View ref={innerRef} collapsable={false} style={styles.story}>
        <Svg
          width={STORY_W}
          height={STORY_H}
          viewBox={`0 0 ${STORY_W} ${STORY_H}`}
          style={styles.storyBgSvg}
        >
          <Defs>
            <RadialGradient
              id="storyGlow"
              cx={STORY_W / 2}
              cy={280}
              rx={200}
              ry={215}
              fx={STORY_W / 2}
              fy={280}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor={glow} stopOpacity={0.6} />
              <Stop offset="0.6" stopColor={glow} stopOpacity={0.45} />
              <Stop offset="1" stopColor={glow} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={STORY_W} height={STORY_H} fill={STORY_BG} />
          <Rect x={0} y={0} width={STORY_W} height={STORY_H} fill="url(#storyGlow)" />
        </Svg>

        <View style={styles.storyTop}>
          <Text style={styles.storyWhen}>{story.when}</Text>
          <View style={styles.storyBadge}>
            <Text style={styles.storyBadgeText}>{story.badge}</Text>
          </View>
        </View>

        <Text style={styles.storyEmoji}>{story.emoji}</Text>

        <Text style={styles.storyQuestion}>{story.question}</Text>
        <Text style={[styles.storyAnswer, noData && styles.storyAnswerNoData]}>
          {story.answer[0]}
          {story.answer[1] ? (
            <Text style={noData ? null : styles.storyHighlight}>{story.answer[1]}</Text>
          ) : null}
          {story.answer[2]}
        </Text>
        {story.slogan ? <Text style={styles.storySlogan}>{story.slogan}</Text> : null}

        <Text style={styles.storyCta}>
          {story.ctaTeam[0]}
          <Text style={styles.storyCtaBold}>{story.ctaTeam[1]}</Text>
          {story.ctaTeam[2]}
        </Text>
        <Text style={styles.storyHandle}>→ {INSTA_HANDLE}</Text>

        <View style={styles.storyBrand}>
          <MiniLogoMark size={15} />
          <Text style={styles.storyBrandText}>Şu An</Text>
        </View>
      </View>
    </View>
  );
}

function BackgroundDecor() {
  return (
    <View style={styles.bgDecor} pointerEvents="none">
      <View style={[styles.blob, { top: -70, left: -50, width: 220, height: 220, backgroundColor: BRAND, opacity: 0.06 }]} />
      <View style={[styles.blob, { top: 160, right: -70, width: 190, height: 190, backgroundColor: PALETTE.amber.fg, opacity: 0.05 }]} />
      <View style={[styles.blob, { bottom: 60, left: -60, width: 210, height: 210, backgroundColor: PALETTE.teal.fg, opacity: 0.05 }]} />
      <View style={[styles.blob, { bottom: -80, right: -40, width: 180, height: 180, backgroundColor: PALETTE.rose.fg, opacity: 0.045 }]} />
    </View>
  );
}

function DashboardScreen({
  totalCount,
  rows,
  loading,
  onBack,
  tx,
  lang,
}: {
  totalCount: number;
  rows: DashboardRow[] | null;
  loading: boolean;
  onBack: () => void;
  tx: Strings;
  lang: Lang;
}) {
  const total = rows ? rows.reduce((s, r) => s + r.cnt, 0) : 0;
  return (
    <SafeAreaView style={styles.dashSafe}>
      <StatusBar style="light" />
      <FadeIn style={styles.dashContainer}>
        <View style={styles.dashHeaderRow}>
          <Pressable onPress={onBack} style={styles.dashBackBtn}>
            <Ionicons name="arrow-back" size={20} color="#ffffff" />
          </Pressable>
          <Text style={styles.dashHeaderTitle}>{tx.dashTitle}</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.dashHeroCard}>
          <Text style={styles.dashHeroLabel}>{tx.dashActive}</Text>
          <CountUpInt value={totalCount} color="#ffffff" fontSize={52} lang={lang} />
          <Text style={styles.dashHeroSub}>{tx.dashSub}</Text>
        </View>

        <Text style={styles.dashSectionTitle}>{tx.dashSection}</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#ffffff" style={{ marginTop: SP.xxl }} />
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: SP.xxl }}>
            {(rows ?? []).map((r) => {
              const a = ACTIVITIES_BY_ID[r.activity];
              if (!a) return null;
              const pct = total > 0 ? (r.cnt / total) * 100 : 0;
              return (
                <View key={r.activity} style={styles.dashRow}>
                  <ActivityIcon activity={a} size={38} iconSize={20} bg="#ffffff" />
                  <View style={{ flex: 1, marginLeft: SP.md }}>
                    <Text style={styles.dashRowName}>{activityName(a.id, lang)}</Text>
                    <View style={styles.dashBarTrack}>
                      <View style={[styles.dashBarFill, { width: `${Math.max(4, pct)}%`, backgroundColor: a.fg }]} />
                    </View>
                  </View>
                  <Text style={styles.dashRowCount}>{formatCount(r.cnt, lang)}</Text>
                </View>
              );
            })}
            {(!rows || rows.length === 0) && !loading ? (
              <Text style={styles.dashEmptyText}>{tx.dashEmpty}</Text>
            ) : null}
          </ScrollView>
        )}
      </FadeIn>
    </SafeAreaView>
  );
}

export default function HomeScreen() {
  const [fontsLoaded] = useFonts({ DMSans_400Regular, DMSans_500Medium, DMSans_700Bold });
  const insets = useSafeAreaInsets();
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
  const [ratioError, setRatioError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState<Lang>('tr');
  const tx = STRINGS[lang];
  const [refreshKey, setRefreshKey] = useState(0);
  const [filterHint, setFilterHint] = useState(false);
  const reqId = useRef(0);
  const silentRefresh = useRef(false);
  const lastEnough = useRef(false);
  const shareRef = useRef<View>(null);

  const [activeCount, setActiveCount] = useState<number | null>(null);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [dashboardRows, setDashboardRows] = useState<DashboardRow[] | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [liveRows, setLiveRows] = useState<DashboardRow[] | null>(null);

  const [notifPrompt, setNotifPrompt] = useState(false);
  const notifTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (notifTimer.current) clearTimeout(notifTimer.current);
    };
  }, []);

  useEffect(() => {
    ensureSession();
    (async () => {
      const [p, c, l] = await Promise.all([
        AsyncStorage.getItem('profile'),
        AsyncStorage.getItem('consent'),
        loadLang(),
      ]);
      setLang(l);
      let loadedProfile: Profile = p ? JSON.parse(p) : {};
      if (c === 'yes') setConsent(true);

      if (!loadedProfile.country) {
        try {
          const region = Localization.getLocales()[0]?.regionCode ?? '';
          const guessed = countryFromRegion(region);
          loadedProfile = { ...loadedProfile, country: guessed };
          AsyncStorage.setItem('profile', JSON.stringify(loadedProfile));
        } catch {}
      }
      setProfile(loadedProfile);
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
    if (filter !== 'world' && (!consent || !value)) {
      setRatio(null);
      setRatioError(false);
      setLoading(false);
      return;
    }
    const id = ++reqId.current;
    const silent = silentRefresh.current;
    silentRefresh.current = false;
    if (!silent) setLoading(true);
    fetchRatio(selected.id, filter, value).then((r) => {
      if (id === reqId.current) {
        // Arka planda yenilenirken veri yeterli hale geldiyse küçük bir titreşim
        if (silent && r?.enough && !lastEnough.current) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
        lastEnough.current = !!r?.enough;
        setRatio(r);
        setRatioError(r === null);
        setLoading(false);
      }
    });
  }, [selected, filter, profile, consent, refreshKey]);

  // İlk kez bir sonuç görüldüğünde filtrelere dikkat çek (cihaz başına bir kez)
  useEffect(() => {
    if (!selected || filter !== 'world' || loading || ratioError || ratio === null) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    AsyncStorage.getItem('filterHintSeen')
      .then((seen) => {
        if (seen || cancelled) return;
        AsyncStorage.setItem('filterHintSeen', '1').catch(() => {});
        timer = setTimeout(() => {
          if (cancelled) return;
          setFilterHint(true);
          timer = setTimeout(() => setFilterHint(false), 4200);
        }, 900);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [selected, filter, loading, ratioError, ratio]);

  // Veri yokken oranı arka planda düzenli kontrol et; yeterli olunca kart kendiliğinden canlıya döner
  useEffect(() => {
    if (!selected || ratio?.enough) return;
    const id = setInterval(() => {
      silentRefresh.current = true;
      setRefreshKey((k) => k + 1);
    }, RATIO_POLL_MS);
    return () => clearInterval(id);
  }, [selected, ratio?.enough]);

  // Toplam aktif kullanıcı sayısını periyodik olarak kontrol ediyoruz; sadece ana ekrandayken.
  useEffect(() => {
    if (selected || dashboardOpen) return;
    let cancelled = false;
    const check = () => {
      setNow(Date.now());
      fetchActiveCount().then((n) => {
        if (cancelled || n === null) return;
        setActiveCount(n);
        if (n >= HERO_COUNT_THRESHOLD) {
          fetchDashboard().then((rows) => {
            if (!cancelled && rows) setLiveRows(rows);
          });
        } else {
          setLiveRows(null);
        }
      });
    };
    check();
    const id = setInterval(check, ACTIVE_COUNT_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [selected, dashboardOpen]);

  const sortedActivities = useMemo(() => {
    const main = rankMainActivities(new Date(now), liveRows);
    const mood = ACTIVITIES.filter((a) => a.mood);
    return [...main, ...mood];
  }, [now, liveRows]);

  function selectActivity(a: Activity) {
    tap();
    const t = Date.now();
    setSelected(a);
    setStartedAt(t);
    setNow(t);
    setFilter('world');
    setEditing(false);
    setRatio(null);
    pushPresence(a.id, profile, consent).then(() => setRefreshKey((k) => k + 1));
    shouldAskNotifications().then((ask) => {
      if (!ask) return;
      if (notifTimer.current) clearTimeout(notifTimer.current);
      notifTimer.current = setTimeout(() => setNotifPrompt(true), NOTIF_ASK_DELAY_MS);
    });
  }

  function acceptNotifications() {
    tap();
    setNotifPrompt(false);
    AsyncStorage.setItem(NOTIF_ASKED_KEY, 'yes').catch(() => {});
    requestNotificationPermission()
      .then((ok) => {
        if (ok) scheduleDailyMoments().catch(() => {});
      })
      .catch(() => {});
  }

  function declineNotifications() {
    tap(true);
    setNotifPrompt(false);
    AsyncStorage.setItem(NOTIF_ASKED_KEY, 'yes').catch(() => {});
  }

  function changeActivity() {
    if (notifTimer.current) clearTimeout(notifTimer.current);
    setNotifPrompt(false);
    setSelected(null);
    setStartedAt(null);
    setEditing(false);
    setFilter('world');
    setRatio(null);
  }

  function saveProfile(next: Profile) {
    setProfile(next);
    if (filter === 'city' && next.country !== COUNTRY_TR) setFilter('world');
    AsyncStorage.setItem('profile', JSON.stringify(next));
    setEditing(false);
    if (selected) {
      const t = Date.now();
      setStartedAt(t);
      setNow(t);
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
    setFilterHint(false);
    setFilter(id);
    setEditing(false);
  }

  function resetAll() {
    Alert.alert(
      tx.resetTitle,
      tx.resetText,
      [
        { text: tx.cancel, style: 'cancel' },
        {
          text: tx.delete,
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.multiRemove(['profile', 'consent']);
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

  async function shareStory() {
    if (!selected || !shareRef.current) return;
    tap();
    // İlk paylaşımda bağlantı çıkartması hatırlatması (bir kez gösterilir)
    try {
      const seen = await AsyncStorage.getItem('storyHintSeen');
      if (!seen) {
        await AsyncStorage.setItem('storyHintSeen', '1');
        await new Promise<void>((resolve) =>
          Alert.alert(tx.storyHintTitle, tx.storyHintText, [{ text: tx.ok, onPress: () => resolve() }], {
            cancelable: true,
            onDismiss: () => resolve(),
          })
        );
      }
    } catch {}
    try {
      const uri = await captureRef(shareRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
        width: 1080,
        height: 1920,
      });
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: tx.shareDialog });
      } else {
        Alert.alert(tx.shareUnavailableTitle, tx.shareUnavailableText);
      }
    } catch {
      Alert.alert(tx.shareErrorTitle, tx.shareErrorText);
    }
  }

  function changeLanguage(next: Lang) {
    if (next === lang) return;
    tap(true);
    setLang(next);
    saveLang(next).then(() => scheduleDailyMoments().catch(() => {}));
  }

  function openDashboard() {
    tap();
    setDashboardOpen(true);
    setDashboardLoading(true);
    fetchDashboard().then((rows) => {
      setDashboardRows(rows);
      setDashboardLoading(false);
    });
  }

  if (!ready || !fontsLoaded) return <SafeAreaView style={styles.safe} />;
  if (!splashDone) return <Splash tx={tx} />;

  if (dashboardOpen) {
    return (
      <DashboardScreen
        totalCount={activeCount ?? 0}
        rows={dashboardRows}
        loading={dashboardLoading}
        onBack={() => setDashboardOpen(false)}
        tx={tx}
        lang={lang}
      />
    );
  }

  if (selected) {
    const { bg, fg } = selected;
    const visibleFilters = FILTERS.filter((f) => f.id !== 'city' || profile.country === COUNTRY_TR);
    const needsProfile = filter !== 'world';
    const value = needsProfile ? profile[filter as keyof Profile] : undefined;
    const picking = needsProfile && (!value || editing);

    const isReal = !!ratio?.enough && typeof ratio.pct === 'number';
    const pct = isReal ? (ratio!.pct as number) : null;
    const shareLine = ratioLine(filter, value, lang);

    const elapsed = startedAt ? now - startedAt : 0;
    const remainingMin = Math.max(0, Math.ceil((SESSION_MS - elapsed) / 60000));

    let resultShown = false;
    let noData = false;
    let body;
    if (needsProfile && !consent) {
      body = (
        <ConsentCard
          fg={fg}
          tx={tx}
          privacyUrl={PRIVACY_URLS[lang]}
          onAccept={acceptConsent}
          onDecline={() => setFilter('world')}
        />
      );
    } else if (picking && filter === 'country') {
      body = (
        <SearchPicker
          title={tx.pickCountry}
          placeholder={tx.searchCountry}
          options={countryOptions(lang)}
          locale={lang === 'tr' ? 'tr-TR' : 'en-US'}
          onPick={(v) => saveProfile({ ...profile, country: v })}
        />
      );
    } else if (picking && filter === 'age') {
      body = (
        <OptionPicker
          title={tx.pickAge}
          options={AGE_RANGES.map((a) => ({ value: a, label: a }))}
          onPick={(v) => saveProfile({ ...profile, age: v })}
        />
      );
    } else if (picking && filter === 'city') {
      body = (
        <SearchPicker
          title={tx.pickCity}
          placeholder={tx.searchCity}
          options={CITIES.map((c) => ({ value: c, label: c }))}
          locale="tr-TR"
          onPick={(v) => saveProfile({ ...profile, city: v })}
        />
      );
    } else if (picking && filter === 'gender') {
      body = (
        <OptionPicker
          title={tx.pickGender}
          options={GENDER_VALUES.map((g) => ({ value: g, label: genderLabel(g, lang) }))}
          onPick={(v) => saveProfile({ ...profile, gender: v })}
        />
      );
    } else if (loading) {
      body = (
        <View style={styles.center}>
          <View style={styles.resultCard}>
            <ActivityIndicator size="large" color={fg} />
          </View>
        </View>
      );
    } else if (ratioError) {
      body = (
        <View style={styles.center}>
          <View style={styles.resultCard}>
            <View style={[styles.badge, styles.badgeEst]}>
              <Text style={[styles.badgeText, styles.badgeTextEst]}>{tx.errorBadge}</Text>
            </View>
            <View style={[styles.noDataIcon, { backgroundColor: bg }]}>
              <Ionicons name="cloud-offline-outline" size={30} color={fg} />
            </View>
            <Text style={styles.noDataTitle}>{tx.errorTitle}</Text>
            <Text style={styles.note}>{tx.errorNote}</Text>
            <Pressable
              style={[styles.primaryBtn, { backgroundColor: fg, alignSelf: 'stretch' }]}
              onPress={() => {
                tap();
                setRefreshKey((k) => k + 1);
              }}
            >
              <Text style={styles.primaryBtnText}>{tx.retry}</Text>
            </Pressable>
          </View>
        </View>
      );
    } else if (isReal && pct !== null) {
      resultShown = true;
      body = (
        <View style={styles.center}>
          <View style={styles.resultCard}>
            <View style={[styles.cardBlob, { backgroundColor: bg }]} />
            <Sparkles key={filter + 'r'} color={fg} />
            <View style={[styles.badge, styles.badgeLive]}>
              <View style={styles.badgeDot} />
              <Text style={[styles.badgeText, styles.badgeTextLive]}>{tx.live}</Text>
            </View>
            <CountUp value={pct} color={fg} lang={lang} />
            <Text style={styles.line}>{shareLine}</Text>
            <View style={styles.peopleRow}>
              <View style={styles.avatarStack}>
                {[PALETTE.amber, PALETTE.indigo, PALETTE.teal].map((c, i) => (
                  <View
                    key={i}
                    style={[styles.avatar, { backgroundColor: c.bg, marginLeft: i === 0 ? 0 : -8 }]}
                  >
                    <Ionicons name="person" size={12} color={c.fg} />
                  </View>
                ))}
              </View>
              <Text style={styles.peopleText}>{tx.amongUsers}</Text>
            </View>
          </View>
        </View>
      );
    } else {
      noData = true;
      body = (
        <View style={styles.center}>
          <View style={styles.resultCard}>
            <View style={[styles.badge, styles.badgeEst]}>
              <Text style={[styles.badgeText, styles.badgeTextEst]}>{tx.noData}</Text>
            </View>
            <View style={[styles.noDataIcon, { backgroundColor: bg }]}>
              <UsersThree size={32} color={fg} weight="duotone" />
            </View>
            <Text style={styles.noDataTitle}>{tx.firstTitle}</Text>
            <Text style={styles.note}>{tx.firstNote}</Text>
          </View>
        </View>
      );
    }

    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: bg }]}>
        <StatusBar style="dark" />
        <FadeIn style={styles.resultContainer}>
          <View style={styles.topRow}>
            <Pressable
              style={styles.backBtn}
              onPress={() => {
                tap();
                changeActivity();
              }}
            >
              <Ionicons name="arrow-back" size={20} color={INK} />
            </Pressable>
            <View style={styles.chip}>
              <ActivityIcon activity={selected} size={30} iconSize={18} />
              <Text style={styles.chipText} numberOfLines={1}>
                {activityName(selected.id, lang)}
              </Text>
            </View>
          </View>

          <FilterSegment
            filters={visibleFilters}
            active={filter}
            fg={fg}
            bg={bg}
            profile={profile}
            consent={consent}
            lang={lang}
            hint={filterHint}
            onChoose={chooseFilter}
          />

          {needsProfile && consent && value && !editing ? (
            <Pressable onPress={() => setEditing(true)}>
              <Text style={[styles.editLink, { color: fg }]}>
                {filter === 'country'
                  ? countryLabel(value, lang)
                  : filter === 'gender'
                    ? genderLabel(value, lang)
                    : value}{' '}
                · {tx.change}
              </Text>
            </Pressable>
          ) : null}

          {picking ? (
            <View style={styles.resultMiddle}>{body}</View>
          ) : (
            <ScrollView
              style={styles.resultMiddle}
              contentContainerStyle={styles.resultScroll}
              showsVerticalScrollIndicator={false}
            >
              {body}
            </ScrollView>
          )}

          <View style={styles.timerBox}>
            <View style={styles.timerLabels}>
              <Text style={styles.timerText}>{tx.validFor(remainingMin)}</Text>
              <Text style={styles.timerText}>{tx.sixtyMin}</Text>
            </View>
            <View style={styles.timerTrack}>
              <View
                style={[
                  styles.timerFill,
                  { width: `${Math.max(0, Math.min(100, 100 - (elapsed / SESSION_MS) * 100))}%`, backgroundColor: fg },
                ]}
              />
            </View>
          </View>

          <View style={styles.buttonsCol}>
            {resultShown || noData ? (
              <Pressable style={[styles.primaryAction, { backgroundColor: fg }]} onPress={shareStory}>
                <Ionicons name="share-social-outline" size={18} color="#ffffff" />
                <Text style={styles.primaryActionText}>{tx.shareActivity}</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={styles.secondaryAction}
              onPress={() => {
                tap();
                changeActivity();
              }}
            >
              <Text style={styles.buttonText}>{tx.changeActivity}</Text>
            </Pressable>
          </View>
        </FadeIn>

        {resultShown || noData ? (
          <StoryCard
            innerRef={shareRef}
            story={buildStory({
              activityId: selected.id,
              lang,
              pct: resultShown ? pct : null,
              filter,
              value: filter === 'world' ? null : (value as string | null | undefined),
            })}
          />
        ) : null}

        {notifPrompt ? (
          <NotifPromptCard
            fg={fg}
            bg={bg}
            tx={tx}
            onAccept={acceptNotifications}
            onDecline={declineNotifications}
          />
        ) : null}
      </SafeAreaView>
    );
  }

  const showDashboardEntry = activeCount !== null && activeCount >= DASHBOARD_THRESHOLD;
  const mainActivities = sortedActivities.filter((a) => !a.mood);
  const topThree = mainActivities.slice(0, 3);
  const others = mainActivities.slice(3);
  const moods = sortedActivities.filter((a) => a.mood);
  const showHeroCount = activeCount !== null && activeCount >= HERO_COUNT_THRESHOLD;
  const part = dayPart(lang);

  return (
    <View style={styles.homeRoot}>
      <StatusBar style="light" />
      <FadeIn style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + SP.xxl }}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.hero, { paddingTop: insets.top + SP.lg }]}>
            <HeroPeople />
            <View style={styles.heroLiveRow}>
              {showHeroCount ? (
                <>
                  <View style={styles.liveDot} />
                  <Text style={styles.heroLive}>{tx.heroCount(formatCount(activeCount!, lang))}</Text>
                </>
              ) : (
                <>
                  <Ionicons name={part.icon} size={14} color={part.color} />
                  <Text style={styles.heroLive}>{part.text}</Text>
                </>
              )}
            </View>
            <Text style={styles.heroTitle}>
              {tx.heroBefore}
              <Text style={styles.heroAccent}>{tx.heroAccent}</Text>
              {tx.heroAfter}
            </Text>
            <View style={styles.momentChip}>
              <Ionicons name="notifications-outline" size={15} color="#ffffff" />
              <Text style={styles.momentText}>{momentLabel(getTodayMoment(), lang)}</Text>
            </View>
          </View>

          <View style={styles.homeBody}>
            {showDashboardEntry ? (
              <Pressable style={styles.dashEntry} onPress={openDashboard}>
                <View style={styles.dashEntryDot} />
                <Text style={styles.dashEntryText}>{tx.dashEntry(formatCount(activeCount!, lang))}</Text>
                <Ionicons name="chevron-forward" size={16} color={LOGO_NAVY} />
              </Pressable>
            ) : null}

            <Text style={styles.sectionTitle}>{tx.sectionTop}</Text>
            <View style={styles.topRow3}>
              {topThree.map((a, i) => (
                <StaggerIn key={a.id} delay={i * 30} style={styles.topCardWrap}>
                  <PressableScale
                    wrapStyle={styles.cardPress}
                    style={[styles.topCard, { backgroundColor: a.bg }]}
                    onPress={() => selectActivity(a)}
                  >
                    <ActivityIcon activity={a} size={42} iconSize={23} bg="#ffffff" />
                    <Text style={styles.topCardName} numberOfLines={2}>
                      {activityName(a.id, lang)}
                    </Text>
                  </PressableScale>
                </StaggerIn>
              ))}
            </View>

            <Text style={styles.sectionTitle}>{tx.sectionOthers}</Text>
            <View style={styles.grid}>
              {others.map((a, i) => (
                <StaggerIn key={a.id} delay={90 + i * 18} style={styles.cardWrap}>
                  <PressableScale wrapStyle={styles.cardPress} style={styles.card} onPress={() => selectActivity(a)}>
                    <ActivityIcon activity={a} size={36} iconSize={20} />
                    <Text style={styles.name} numberOfLines={2}>
                      {activityName(a.id, lang)}
                    </Text>
                  </PressableScale>
                </StaggerIn>
              ))}
            </View>

            <Text style={styles.sectionTitle}>{tx.sectionMood}</Text>
            <View style={styles.moodRow}>
              {moods.map((a) => {
                const Icon = a.icon;
                return (
                  <PressableScale
                    key={a.id}
                    style={styles.moodChip}
                    onPress={() => selectActivity(a)}
                  >
                    <Icon size={17} color={a.fg} weight="duotone" />
                    <Text style={styles.moodText} numberOfLines={1}>
                      {activityName(a.id, lang)}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>

            <View style={styles.footerLinks}>
              {consent || Object.values(profile).some(Boolean) ? (
                <Pressable onPress={resetAll}>
                  <Text style={styles.resetLink}>{tx.resetLink}</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => Linking.openURL(PRIVACY_URLS[lang])}>
                <Text style={styles.resetLink}>{tx.privacyLink}</Text>
              </Pressable>
              <View style={styles.langRow}>
                {(['tr', 'en'] as Lang[]).map((l, i) => (
                  <View key={l} style={styles.langItem}>
                    {i > 0 ? <Text style={styles.langSep}>·</Text> : null}
                    <Pressable onPress={() => changeLanguage(l)} hitSlop={8}>
                      <Text style={[styles.langText, lang === l && styles.langTextActive]}>
                        {l === 'tr' ? 'Türkçe' : 'English'}
                      </Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </ScrollView>
      </FadeIn>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F7F9' },
  bgDecor: { ...ABS_FILL, overflow: 'hidden' },
  blob: { position: 'absolute', borderRadius: 999 },
  container: { padding: SP.xl, paddingBottom: SP.xxl + SP.xs },
  title: { fontFamily: F.bold, fontSize: FS.xxl, color: INK, marginTop: SP.sm, letterSpacing: -0.5 },
  titleAccent: { color: BRAND },
  subtitle: { fontFamily: F.regular, fontSize: FS.base, color: SOFT, marginTop: SP.xs, marginBottom: SP.lg },
  dashEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAF1FF',
    borderRadius: 999,
    paddingVertical: SP.sm + 2,
    paddingHorizontal: SP.md,
    marginBottom: SP.lg,
    gap: SP.xs,
  },
  dashEntryDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22C55E' },
  dashEntryText: { flex: 1, fontFamily: F.medium, fontSize: FS.sm, color: LOGO_NAVY, marginLeft: SP.xs },
  homeRoot: { flex: 1, backgroundColor: '#F7F7F9' },
  hero: {
    backgroundColor: LOGO_NAVY,
    paddingHorizontal: SP.xl,
    paddingBottom: SP.xxl + SP.xs,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  heroPeople: { position: 'absolute', right: -6, bottom: 18, width: 150, height: 124 },
  heroLiveRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22C55E' },
  heroLive: { fontFamily: F.regular, fontSize: FS.sm, color: 'rgba(255,255,255,0.75)' },
  heroTitle: {
    fontFamily: F.bold,
    fontSize: FS.xxl,
    color: '#ffffff',
    lineHeight: 34,
    marginTop: SP.sm,
    letterSpacing: -0.5,
  },
  heroAccent: { color: '#A5B4FC' },
  momentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    paddingVertical: SP.sm,
    paddingHorizontal: SP.md,
    marginTop: SP.lg,
  },
  momentText: { fontFamily: F.medium, fontSize: FS.sm, color: '#ffffff' },
  homeBody: { paddingHorizontal: SP.xl, paddingTop: SP.xs },
  sectionTitle: {
    fontFamily: F.bold,
    fontSize: FS.md,
    color: '#2A2A33',
    marginTop: SP.xl,
    marginBottom: SP.md,
  },
  topRow3: { flexDirection: 'row', gap: SP.sm + 2 },
  topCardWrap: { flex: 1 },
  topCard: {
    minHeight: 115,
    borderRadius: SP.lg + 2,
    paddingVertical: SP.md + 2,
    paddingHorizontal: SP.sm,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topCardName: {
    fontFamily: F.bold,
    fontSize: FS.sm,
    color: INK,
    textAlign: 'center',
    lineHeight: 17,
    marginTop: SP.sm,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm + 2 },
  cardWrap: { width: '48.3%' },
  cardPress: { width: '100%' },
  card: {
    backgroundColor: '#ffffff',
    minHeight: 64,
    borderRadius: SP.lg + 2,
    paddingVertical: SP.md,
    paddingHorizontal: SP.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.sm + 2,
    ...SOFT_SHADOW,
  },
  name: {
    flex: 1,
    fontFamily: F.medium,
    fontSize: FS.sm,
    color: INK,
    lineHeight: 17,
  },
  moodRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: SP.sm },
  moodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingVertical: SP.sm + 1,
    paddingHorizontal: SP.md + 2,
    ...SOFT_SHADOW,
  },
  moodText: { fontFamily: F.medium, fontSize: FS.sm, color: INK },
  footerLinks: { alignItems: 'center', marginTop: SP.xxl, gap: SP.sm },
  langRow: { flexDirection: 'row', alignItems: 'center', marginTop: SP.sm },
  langItem: { flexDirection: 'row', alignItems: 'center' },
  langSep: { fontFamily: F.regular, fontSize: FS.sm, color: FAINT, marginHorizontal: SP.sm },
  langText: { fontFamily: F.regular, fontSize: FS.sm, color: FAINT },
  langTextActive: { fontFamily: F.bold, color: INK },
  resetLink: {
    fontFamily: F.regular,
    fontSize: FS.sm,
    color: FAINT,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },

  splashSafe: { flex: 1, backgroundColor: LOGO_NAVY },
  splashCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SP.xxl + SP.sm },
  splashQuestion: {
    fontFamily: F.bold,
    fontSize: 24,
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 32,
  },
  splashHint: {
    fontFamily: F.regular,
    fontSize: FS.base,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    marginTop: SP.sm + SP.xs,
  },

  resultContainer: { flex: 1, padding: SP.xl, paddingBottom: SP.lg },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: SP.sm + 2 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    ...SOFT_SHADOW,
  },
  segmentTitle: {
    marginTop: SP.lg,
    marginLeft: SP.xs,
    marginBottom: SP.sm,
    fontFamily: F.medium,
    fontSize: FS.sm,
    color: SOFT,
  },
  segment: {
    flexDirection: 'row',
    gap: 2,
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 4,
    ...SOFT_SHADOW,
  },
  segmentCell: { flex: 1 },
  segmentHalo: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 18 },
  segmentBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingTop: SP.sm,
    paddingBottom: SP.sm - 1,
    borderRadius: 18,
  },
  segmentPlus: {
    position: 'absolute',
    top: -4,
    right: -8,
    width: 13,
    height: 13,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  segmentPlusText: { fontFamily: F.bold, fontSize: 9, lineHeight: 10 },
  segmentText: { fontFamily: F.medium, fontSize: FS.xs, color: SOFT },
  segmentTextActive: { color: '#ffffff' },
  cardBlob: { position: 'absolute', right: -24, top: -24, width: 120, height: 120, borderRadius: 60, opacity: 0.7 },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E', marginRight: 6 },
  peopleRow: { flexDirection: 'row', alignItems: 'center', marginTop: SP.lg },
  avatarStack: { flexDirection: 'row', marginRight: SP.sm },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  peopleText: { fontFamily: F.regular, fontSize: FS.xs, color: FAINT },
  noDataIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SP.xs,
  },
  noDataTitle: { fontFamily: F.bold, fontSize: FS.xl, color: INK, marginTop: SP.md },
  timerLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  resultMiddle: { flex: 1, marginTop: SP.sm },
  resultScroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: SP.sm },
  buttonsCol: { gap: SP.sm + 2 },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SP.sm,
    borderRadius: SP.lg,
    paddingVertical: SP.md + 3,
  },
  primaryActionText: { fontFamily: F.medium, fontSize: FS.md, color: '#ffffff' },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: SP.lg,
    paddingVertical: SP.md + 3,
    ...SOFT_SHADOW,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.sm,
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingLeft: SP.xs + 1,
    paddingRight: SP.md + 2,
    paddingVertical: SP.xs + 1,
    flexShrink: 1,
    ...SOFT_SHADOW,
  },
  chipText: { flexShrink: 1, fontFamily: F.bold, fontSize: FS.lg, color: INK, marginRight: SP.xs },

  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm, marginTop: SP.xl - SP.xs },
  filterBtn: {
    paddingVertical: SP.sm + SP.xs,
    paddingHorizontal: SP.lg,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    ...SOFT_SHADOW,
  },
  filterText: { fontFamily: F.medium, fontSize: FS.base, color: SOFT },
  filterTextActive: { color: '#ffffff' },
  editLink: {
    fontFamily: F.medium,
    fontSize: FS.base,
    marginTop: SP.md,
    textDecorationLine: 'underline',
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  resultCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 28,
    paddingVertical: SP.xxxl - SP.xs,
    paddingHorizontal: SP.xxl,
    alignItems: 'center',
    overflow: 'hidden',
    ...CARD_SHADOW,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: SP.md,
    paddingVertical: SP.xs,
    marginBottom: SP.md,
  },
  badgeLive: { backgroundColor: '#E3F6E8' },
  badgeEst: { backgroundColor: '#F0F1F3' },
  badgeText: { fontFamily: F.medium, fontSize: FS.xs },
  badgeTextLive: { color: '#1f7a3d' },
  badgeTextEst: { color: '#44464C' },
  line: {
    fontFamily: F.regular,
    fontSize: FS.lg,
    color: SOFT,
    textAlign: 'center',
    marginTop: SP.md + SP.xs,
    lineHeight: 24,
  },
  note: {
    fontFamily: F.regular,
    fontSize: FS.xs,
    color: FAINT,
    marginTop: SP.md,
    textAlign: 'center',
    lineHeight: 17,
  },
  primaryBtn: {
    borderRadius: SP.md + SP.xs,
    paddingVertical: SP.md + 1,
    paddingHorizontal: SP.xl + SP.xs,
    marginTop: SP.lg + SP.xs,
    alignItems: 'center',
  },
  primaryBtnText: { fontFamily: F.medium, color: '#ffffff', fontSize: FS.md },
  ghostBtn: { paddingVertical: SP.md, alignItems: 'center', marginTop: SP.xs },
  ghostBtnText: { fontFamily: F.regular, color: SOFT, fontSize: FS.md },

  notifBackdrop: {
    ...ABS_FILL,
    backgroundColor: 'rgba(15,42,82,0.35)',
    justifyContent: 'center',
    paddingHorizontal: SP.xl,
  },
  notifCard: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    paddingHorizontal: SP.xxl,
    paddingTop: SP.xxl,
    paddingBottom: SP.md,
    alignItems: 'center',
    ...CARD_SHADOW,
  },
  notifIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SP.lg,
  },
  notifTitle: { fontFamily: F.bold, fontSize: FS.xl, color: INK, textAlign: 'center' },
  notifText: {
    fontFamily: F.regular,
    fontSize: FS.md,
    color: SOFT,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: SP.sm,
  },
  notifSub: {
    fontFamily: F.medium,
    fontSize: FS.sm,
    color: FAINT,
    textAlign: 'center',
    marginTop: SP.md,
  },
  notifBtn: { alignSelf: 'stretch' },

  consentOuter: { flex: 1, justifyContent: 'center' },
  consentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    padding: SP.xxl - SP.xs,
    ...CARD_SHADOW,
  },
  consentText: { fontFamily: F.regular, fontSize: FS.md, color: '#333', lineHeight: 22, marginBottom: SP.sm + SP.xs },
  privacyLink: {
    fontFamily: F.medium,
    fontSize: FS.sm,
    textDecorationLine: 'underline',
    marginBottom: SP.xs,
  },

  pickerOuter: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 28,
    padding: SP.xl,
    marginTop: SP.xs,
    ...CARD_SHADOW,
  },
  pickerTitle: { fontFamily: F.bold, fontSize: FS.xl, color: INK, marginBottom: SP.md },
  row: {
    paddingVertical: SP.md + 3,
    paddingHorizontal: SP.lg,
    borderRadius: SP.md + 2,
    backgroundColor: '#F5F6F8',
    marginBottom: SP.sm,
  },
  rowText: { fontFamily: F.regular, fontSize: FS.md + 1, color: INK },
  input: {
    fontFamily: F.regular,
    backgroundColor: '#F5F6F8',
    borderRadius: SP.md + 2,
    paddingHorizontal: SP.lg,
    paddingVertical: SP.md + 1,
    fontSize: FS.md + 1,
    marginBottom: SP.sm + 2,
  },

  timerBox: { marginBottom: SP.md + SP.xs, marginTop: SP.lg },
  timerText: { fontFamily: F.regular, fontSize: FS.xs, color: SOFT, marginBottom: SP.xs + 2 },
  timerTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 3 },
  timerFill: { height: 6, borderRadius: 3 },

  buttonsRow: { flexDirection: 'row', gap: SP.sm + 2 },
  button: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: SP.md + 2,
    paddingVertical: SP.md + 3,
    alignItems: 'center',
    justifyContent: 'center',
    ...SOFT_SHADOW,
  },
  shareBtn: {},
  buttonText: { fontFamily: F.medium, fontSize: FS.md, color: INK },

  shareCardWrap: { position: 'absolute', top: -10000, left: 0 },
  // Hikâye kartı: 360x640 çizilir, 1080x1920 olarak kaydedilir (3x)
  story: {
    width: STORY_W,
    height: STORY_H,
    overflow: 'hidden',
    backgroundColor: STORY_BG,
    paddingHorizontal: 30,
    paddingTop: 83,
  },
  storyBgSvg: { position: 'absolute', top: 0, left: 0 },
  storyTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  storyWhen: { fontFamily: F.medium, fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  storyBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  storyBadgeText: { fontFamily: F.bold, fontSize: 11.5, color: '#ffffff' },
  storyEmoji: { marginTop: 22, fontSize: 48, lineHeight: 60 },
  storyQuestion: {
    marginTop: 12,
    fontFamily: F.bold,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.4,
    color: 'rgba(255,255,255,0.58)',
  },
  storyAnswer: {
    marginTop: 10,
    fontFamily: F.bold,
    fontSize: 28,
    lineHeight: 31,
    letterSpacing: -0.8,
    color: '#ffffff',
  },
  storyAnswerNoData: { fontSize: 30, lineHeight: 34 },
  // Sayı: sarı vurgu (Stil 1)
  storyHighlight: { color: STORY_ACCENT },
  storySlogan: { marginTop: 18, fontFamily: F.bold, fontSize: 16, lineHeight: 21, color: STORY_ACCENT },
  storyCta: { marginTop: 26, fontFamily: F.medium, fontSize: 12.5, lineHeight: 18, color: '#ffffff' },
  storyCtaBold: { fontFamily: F.bold },
  storyHandle: { marginTop: 2, fontFamily: F.bold, fontSize: 13, color: STORY_ACCENT },
  storyBrand: {
    position: 'absolute',
    left: 30,
    bottom: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  storyBrandText: { fontFamily: F.bold, fontSize: 12.5, color: '#ffffff' },

  dashSafe: { flex: 1, backgroundColor: LOGO_NAVY },
  dashContainer: { flex: 1, padding: SP.xl },
  dashHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SP.lg },
  dashBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashHeaderTitle: { fontFamily: F.bold, fontSize: FS.lg, color: '#ffffff' },
  dashHeroCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 24,
    paddingVertical: SP.xl,
    alignItems: 'center',
    marginBottom: SP.xl,
  },
  dashHeroLabel: {
    fontFamily: F.bold,
    fontSize: FS.xs,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1,
    marginBottom: SP.xs,
  },
  dashHeroSub: {
    fontFamily: F.regular,
    fontSize: FS.sm,
    color: 'rgba(255,255,255,0.7)',
    marginTop: SP.xs,
    textAlign: 'center',
    paddingHorizontal: SP.xl,
  },
  dashSectionTitle: {
    fontFamily: F.bold,
    fontSize: FS.md,
    color: '#ffffff',
    marginBottom: SP.md,
  },
  dashRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: SP.md,
    marginBottom: SP.sm,
  },
  dashRowName: { fontFamily: F.medium, fontSize: FS.base, color: '#ffffff', marginBottom: SP.xs },
  dashBarTrack: { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.15)' },
  dashBarFill: { height: 5, borderRadius: 3 },
  dashRowCount: { fontFamily: F.bold, fontSize: FS.base, color: '#ffffff', marginLeft: SP.md },
  dashEmptyText: {
    fontFamily: F.regular,
    fontSize: FS.base,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginTop: SP.xxl,
  },
});
