import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
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
import { Circle, Defs, LinearGradient, Path, Rect, Stop, Svg } from 'react-native-svg';
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

type IconName = keyof typeof Ionicons.glyphMap;
type Peak = { hour: number; spread: number };
type Activity = {
  id: string;
  name: string;
  icon: IconName;
  bg: string;
  fg: string;
  grad: [string, string];
  world: number;
  country: number;
  peaks: Peak[];
};

const ACTIVITIES: Activity[] = [
  { id: 'lying', name: 'Uzanıyorum', icon: 'bed-outline', ...PALETTE.indigo, world: 22, country: 30, peaks: [{ hour: 3, spread: 3.5 }] },
  { id: 'work', name: 'İşteyim', icon: 'briefcase-outline', ...PALETTE.indigo, world: 18, country: 14, peaks: [{ hour: 11, spread: 4.5 }] },
  { id: 'eat', name: 'Yemek yiyorum', icon: 'restaurant-outline', ...PALETTE.amber, world: 7.5, country: 9, peaks: [{ hour: 8, spread: 1.3 }, { hour: 13, spread: 1.3 }, { hour: 19, spread: 1.3 }] },
  { id: 'travel', name: 'Yoldayım', icon: 'car-outline', ...PALETTE.teal, world: 8, country: 10, peaks: [{ hour: 8, spread: 1.3 }, { hour: 18, spread: 1.3 }] },
  { id: 'study', name: 'Ders çalışıyorum', icon: 'book-outline', ...PALETTE.indigo, world: 6, country: 7, peaks: [{ hour: 20, spread: 4 }] },
  { id: 'sport', name: 'Spor yapıyorum', icon: 'barbell-outline', ...PALETTE.teal, world: 4, country: 3, peaks: [{ hour: 19, spread: 3 }] },
  { id: 'tv', name: 'Dizi/film izliyorum', icon: 'tv-outline', ...PALETTE.rose, world: 7, country: 8, peaks: [{ hour: 21, spread: 3 }] },
  { id: 'coffee', name: 'Kahve içiyorum', icon: 'cafe-outline', ...PALETTE.amber, world: 5, country: 6, peaks: [{ hour: 9, spread: 2.5 }] },
  { id: 'gaming', name: 'Oyun oynuyorum', icon: 'game-controller-outline', ...PALETTE.rose, world: 9, country: 6, peaks: [{ hour: 22, spread: 4 }] },
  { id: 'shop', name: 'Alışveriş yapıyorum', icon: 'cart-outline', ...PALETTE.amber, world: 3.5, country: 3, peaks: [{ hour: 15, spread: 4 }] },
  { id: 'chores', name: 'Ev işi yapıyorum', icon: 'home-outline', ...PALETTE.teal, world: 5, country: 2, peaks: [{ hour: 11, spread: 4 }] },
  { id: 'friends', name: 'Arkadaşlarımlayım', icon: 'people-outline', ...PALETTE.rose, world: 4.5, country: 2, peaks: [{ hour: 20, spread: 4 }] },
  { id: 'nothing', name: 'Boş boş oturuyorum', icon: 'ellipsis-horizontal-outline', ...PALETTE.indigo, world: 6, country: 5, peaks: [{ hour: 16, spread: 5 }] },
  { id: 'bored', name: 'Sıkılıyorum', icon: 'sad-outline', ...PALETTE.indigo, world: 7, country: 5, peaks: [{ hour: 15, spread: 5 }] },
  { id: 'scrolling', name: 'Telefonda geziniyorum', icon: 'phone-portrait-outline', ...PALETTE.rose, world: 10, country: 8, peaks: [{ hour: 22, spread: 3 }] },
  { id: 'procrastinating', name: 'Erteliyorum', icon: 'time-outline', ...PALETTE.indigo, world: 8, country: 6, peaks: [{ hour: 15, spread: 4 }] },
  { id: 'resting', name: 'Dinleniyorum', icon: 'leaf-outline', ...PALETTE.teal, world: 8, country: 6, peaks: [{ hour: 14, spread: 5 }] },
  { id: 'money', name: 'Borçları düşünüyorum', icon: 'wallet-outline', ...PALETTE.indigo, world: 5, country: 4, peaks: [{ hour: 21, spread: 4 }] },
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

// Gradyanlı, ince renkli gölgeli (ışımalı) ikon dairesi.
function IconCircle({
  size,
  grad,
  icon,
  iconSize,
}: {
  size: number;
  grad: [string, string];
  icon: IconName;
  iconSize: number;
}) {
  const gid = `g-${size}-${grad[1].slice(1)}`;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        shadowColor: grad[1],
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 5,
      }}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <LinearGradient id={gid} x1="0" y1="0" x2={size} y2={size}>
            <Stop offset="0" stopColor={grad[0]} />
            <Stop offset="1" stopColor={grad[1]} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${gid})`} />
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
        <Ionicons name={icon} size={iconSize} color="#ffffff" />
      </View>
    </View>
  );
}

// Sonuç belirdiğinde aktivitenin renginde yükselip kaybolan ince parçacıklar.
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
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
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

function Globe({ size = 96 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Circle cx={50} cy={50} r={46} fill="#3B7DE8" />
      <Path
        d="M14 38 Q24 26 38 30 Q46 20 58 26 Q70 22 78 32 Q82 40 74 46 Q66 42 58 46 Q50 40 40 46 Q30 44 24 50 Q16 46 14 38 Z"
        fill="#3CB878"
      />
      <Path
        d="M20 62 Q30 56 40 62 Q50 58 58 66 Q52 78 40 76 Q26 80 20 62 Z"
        fill="#3CB878"
      />
      <Path
        d="M68 58 Q78 54 84 62 Q80 70 70 68 Q64 64 68 58 Z"
        fill="#3CB878"
      />
      <Circle cx={50} cy={50} r={46} stroke="#ffffff" strokeOpacity={0.3} strokeWidth={1.2} fill="none" />
      <Path d="M4 50 A46 15 0 0 0 96 50" stroke="#ffffff" strokeOpacity={0.28} strokeWidth={1} fill="none" />
      <Path d="M4 50 A46 15 0 0 1 96 50" stroke="#ffffff" strokeOpacity={0.28} strokeWidth={1} fill="none" />
      <Path d="M50 4 A46 46 0 0 1 50 96" stroke="#ffffff" strokeOpacity={0.22} strokeWidth={1} fill="none" />
      <Circle cx={36} cy={32} r={16} fill="#ffffff" opacity={0.16} />
    </Svg>
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

function Splash() {
  const rot = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0.85)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(rot, { toValue: 1, duration: 1400, easing: Easing.linear, useNativeDriver: true })
    ).start();
    Animated.timing(pop, { toValue: 1, duration: DUR, easing: EASE, useNativeDriver: true }).start();
    Animated.timing(fade, { toValue: 1, duration: DUR, delay: 250, easing: EASE, useNativeDriver: true }).start();
  }, []);
  const spin = rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <SafeAreaView style={styles.splashSafe}>
      <View style={styles.splashCenter}>
        <Animated.View style={[styles.splashRingWrap, { transform: [{ scale: pop }] }]}>
          <Animated.View style={[styles.splashRingAbs, { transform: [{ rotate: spin }] }]}>
            <Svg width={128} height={128} viewBox="0 0 128 128">
              <Circle cx={64} cy={64} r={58} stroke="#ffffff" strokeWidth={4} strokeOpacity={0.22} fill="none" />
              <Path d="M64 6 A58 58 0 0 1 122 64" stroke="#ffffff" strokeWidth={4} strokeLinecap="round" fill="none" />
            </Svg>
          </Animated.View>
          <Globe size={104} />
        </Animated.View>
        <Animated.View style={{ opacity: fade, marginTop: SP.xxxl - SP.xs }}>
          <Text style={styles.splashQuestion}>Şu an dünyada{'\n'}kim ne yapıyor?</Text>
          <Text style={styles.splashHint}>Merak ediyorsan hemen öğren</Text>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const BIG = 84;
const BIG_H = 104;

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
      duration: 800,
      easing: EASE,
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
    <View style={styles.pickerOuter}>
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
    <View style={styles.pickerOuter}>
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
    <View style={styles.consentOuter}>
      <View style={styles.consentCard}>
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
      const [p, c] = await Promise.all([
        AsyncStorage.getItem('profile'),
        AsyncStorage.getItem('consent'),
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

  const sortedActivities = useMemo(() => {
    const hour = new Date(now).getHours();
    return [...ACTIVITIES].sort(
      (a, b) => timeFactor(b.peaks, hour) * b.world - timeFactor(a.peaks, hour) * a.world
    );
  }, [now]);

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
  }

  function changeActivity() {
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
    const { bg, fg, grad } = selected;
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
          <View style={styles.resultCard}>
            <Text style={styles.line}>Cinsiyetini belirtmediğin için bu filtre kapalı.</Text>
            <Pressable
              style={[styles.primaryBtn, { backgroundColor: fg }]}
              onPress={() => setEditing(true)}
            >
              <Text style={styles.primaryBtnText}>Cinsiyetimi seç</Text>
            </Pressable>
          </View>
        </View>
      );
    } else if (loading) {
      body = (
        <View style={styles.center}>
          <View style={styles.resultCard}>
            <ActivityIndicator size="large" color={fg} />
          </View>
        </View>
      );
    } else {
      resultShown = true;
      body = (
        <View style={styles.center}>
          <View style={styles.resultCard}>
            <Sparkles key={filter + (isReal ? 'r' : 'e')} color={fg} />
            <View style={[styles.badge, isReal ? styles.badgeLive : styles.badgeEst]}>
              <Text style={[styles.badgeText, isReal ? styles.badgeTextLive : styles.badgeTextEst]}>
                {isReal ? 'CANLI' : 'TAHMİNİ'}
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
        </View>
      );
    }

    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: bg }]}>
        <FadeIn style={styles.resultContainer}>
          <View style={styles.topRow}>
            <View style={styles.chip}>
              <IconCircle size={28} grad={grad} icon={selected.icon} iconSize={15} />
              <Text style={styles.chipText}>{selected.name}</Text>
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
              <Pressable style={[styles.button, styles.shareBtn]} onPress={shareResult}>
                <InstaBadge size={20} />
                <Text style={styles.buttonText}>Paylaş</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={styles.button}
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
      <BackgroundDecor />
      <FadeIn style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.title}>
            Şu an <Text style={styles.titleAccent}>SEN</Text> ne yapıyorsun?
          </Text>
          <Text style={styles.subtitle}>Birine dokun, dünyayla karşılaştır.</Text>

          <View style={styles.grid}>
            {sortedActivities.map((a, i) => (
              <StaggerIn key={a.id} delay={i * 22} style={styles.cardWrap}>
                <PressableScale wrapStyle={styles.cardPress} style={styles.card} onPress={() => selectActivity(a)}>
                  <IconCircle size={44} grad={a.grad} icon={a.icon} iconSize={22} />
                  <Text style={styles.name} numberOfLines={2}>
                    {a.name}
                  </Text>
                </PressableScale>
              </StaggerIn>
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
  safe: { flex: 1, backgroundColor: '#F7F7F9' },
  bgDecor: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  blob: { position: 'absolute', borderRadius: 999 },
  container: { padding: SP.xl, paddingBottom: SP.xxl + SP.xs },
  title: { fontFamily: F.bold, fontSize: FS.xxl, color: INK, marginTop: SP.sm, letterSpacing: -0.5 },
  titleAccent: { color: BRAND },
  subtitle: { fontFamily: F.regular, fontSize: FS.base, color: SOFT, marginTop: SP.xs, marginBottom: SP.xl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SP.md },
  cardWrap: { width: '47.5%' },
  cardPress: { width: '100%' },
  card: {
    backgroundColor: '#ffffff',
    minHeight: 108,
    borderRadius: SP.xl,
    padding: SP.lg,
    justifyContent: 'space-between',
    ...CARD_SHADOW,
  },
  name: {
    fontFamily: F.bold,
    fontSize: FS.sm,
    color: INK,
    lineHeight: 18,
    marginTop: SP.sm,
  },
  resetLink: {
    fontFamily: F.regular,
    fontSize: FS.sm,
    color: FAINT,
    textAlign: 'center',
    marginTop: SP.xxl,
    textDecorationLine: 'underline',
  },

  splashSafe: { flex: 1, backgroundColor: BRAND },
  splashCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SP.xxl + SP.sm },
  splashRingWrap: { width: 128, height: 128, alignItems: 'center', justifyContent: 'center' },
  splashRingAbs: { position: 'absolute' },
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
  topRow: { flexDirection: 'row' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.sm,
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingHorizontal: SP.sm + SP.xs,
    paddingVertical: SP.xs + 2,
    ...SOFT_SHADOW,
  },
  chipText: { fontFamily: F.bold, fontSize: FS.lg, color: INK, marginRight: SP.xs },

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
    paddingVertical: SP.xxxl + SP.sm,
    paddingHorizontal: SP.xxl,
    alignItems: 'center',
    overflow: 'hidden',
    ...CARD_SHADOW,
  },
  badge: { borderRadius: 999, paddingHorizontal: SP.md, paddingVertical: SP.xs, marginBottom: SP.md },
  badgeLive: { backgroundColor: '#E3F6E8' },
  badgeEst: { backgroundColor: '#F0F1F3' },
  badgeText: { fontFamily: F.bold, fontSize: FS.xs, letterSpacing: 0.6 },
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

  consentOuter: { flex: 1, justifyContent: 'center' },
  consentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    padding: SP.xxl - SP.xs,
    ...CARD_SHADOW,
  },
  consentText: { fontFamily: F.regular, fontSize: FS.md, color: '#333', lineHeight: 22, marginBottom: SP.sm + SP.xs },

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
  timerLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SP.xs + 2 },
  timerText: { fontFamily: F.regular, fontSize: FS.xs, color: SOFT },
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

  shareCardWrap: { position: 'absolute', top: 0, left: 0, opacity: 0 },
  shareCard: {
    width: 320,
    height: 320,
    borderRadius: 28,
    padding: SP.xxl,
    justifyContent: 'space-between',
  },
  shareBrandTop: {
    fontFamily: F.bold,
    fontSize: FS.md,
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
    marginBottom: SP.sm + 2,
  },
  sharePct: { fontFamily: F.bold, fontSize: 56, color: '#ffffff', letterSpacing: -2 },
  shareLine: {
    fontFamily: F.medium,
    fontSize: FS.base,
    color: '#ffffff',
    lineHeight: 19,
    textAlign: 'center',
    marginTop: SP.xs,
    paddingHorizontal: SP.sm,
  },
  shareNote: { fontFamily: F.regular, fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: SP.xs + 2 },
  shareCta: {
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingVertical: SP.md,
    alignItems: 'center',
  },
  shareCtaText: { fontFamily: F.bold, fontSize: FS.base },
});