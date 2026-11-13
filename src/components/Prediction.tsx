// 1.5.4: Tahmin Oyunu ekranları
// - PredictionChip: ana ekrandaki "🎯 64 puan" hapı (dokununca PredictionSheet)
// - PredictionSheet: haftalık puan, ilk %10'a kalan puan, kurallar
// - PredictionWeeklyHost: pazartesi geçen haftanın sonucu (bir kez), ilk %10 ise Keskin Göz rozeti
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AppState, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Circle, Defs, LinearGradient as SvgGradient, Rect, Stop, Svg } from 'react-native-svg';
import { activityName, type Lang } from '@/lib/i18n';
import {
  fetchPredictionWeeks,
  hookBadgeSync,
  markWeeklyResultSeen,
  nextStreakStep,
  onPredictionChanged,
  pendingWeeklyResult,
  POINTS_HIT,
  PredictionWeek,
  PointsItem,
  PredictionWeeks,
  syncBadges,
} from '@/lib/prediction';
import { awardBadges, BADGES } from '@/lib/badges';
import { istanbulToday } from '@/lib/dailyQuestion';
import { DOWNLOAD_URL } from '@/lib/campus';
import { setOverlayBusy, whenOverlayFree } from '@/lib/overlay';
import { track } from '@/lib/analytics';

const NAVY = '#0F1530';
const INK = '#16161A';
const MUTED = '#6B6F7B';
const ACCENT = '#3F3BC9';
const ACCENT_BG = '#EEEDFB';
const LAVENDER = '#A5B4FC';
const PEACH = '#F4B88A';
const F = { regular: 'DMSans_400Regular', medium: 'DMSans_500Medium', bold: 'DMSans_700Bold' };

const tr = (lang: Lang) => (lang as string) === 'tr';

// ======================================================================== ana ekran hapı
// Sade: "🎯 175". Puan artınca bir kez hafifçe parlar. Dokununca puan paneli.
export function PredictionChip({ lang, style }: { lang: Lang; style?: object }) {
  const [data, setData] = useState<PredictionWeeks | null>(null);
  const [open, setOpen] = useState(false);
  const pulse = useRef(new Animated.Value(0)).current;
  const lastTotal = useRef<number | null>(null);

  const load = useCallback(() => {
    fetchPredictionWeeks()
      .then((w) => {
        if (!w) return;
        if (lastTotal.current !== null && w.allTotal > lastTotal.current) {
          pulse.setValue(0);
          Animated.sequence([
            Animated.timing(pulse, { toValue: 1, duration: 260, useNativeDriver: true }),
            Animated.timing(pulse, { toValue: 0, duration: 520, useNativeDriver: true }),
          ]).start();
        }
        lastTotal.current = w.allTotal;
        setData(w);
      })
      .catch(() => {});
  }, [pulse]);

  useEffect(() => {
    // Rozet puanları: telefondaki rozetleri sunucuya yaz, yeni rozet kazanılınca da
    hookBadgeSync();
    syncBadges().catch(() => {});
    load();
    const off = onPredictionChanged(load);
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') load();
    });
    return () => {
      off();
      sub.remove();
    };
  }, [load]);

  if (!data) return null; // sunucu cevap vermezse (ör. SQL çalışmadıysa) hiç görünmez

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  return (
    <>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            track('prediction_sheet', { points: data.allTotal });
            setOpen(true);
          }}
          style={({ pressed }) => [styles.chip, style, pressed && { opacity: 0.8 }]}
          accessibilityRole="button"
          accessibilityLabel={tr(lang) ? `${data.allTotal} puan` : `${data.allTotal} points`}
        >
          <Text style={styles.chipText} numberOfLines={1}>
            🎯 {data.allTotal.toLocaleString(tr(lang) ? 'tr-TR' : 'en-US')}
          </Text>
        </Pressable>
      </Animated.View>
      {open ? <PredictionSheet lang={lang} data={data} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

// ======================================================================== puan paneli
const KIND_TR: Record<string, string> = {
  question: 'Günün Sorusu',
  moment: 'Günün ilk anı',
  guess_hit: 'Tahmin tuttu',
  guess_miss: 'Tahmine katıldın',
  badge: 'Rozet',
};
const KIND_EN: Record<string, string> = {
  question: 'Question of the Day',
  moment: 'First moment of the day',
  guess_hit: 'Guess was right',
  guess_miss: 'Played the guess',
  badge: 'Badge',
};
const KIND_ICON: Record<string, { e: string; bg: string }> = {
  question: { e: '💬', bg: '#F1F0FD' },
  moment: { e: '✨', bg: ACCENT_BG },
  guess_hit: { e: '🎯', bg: '#E8EBFE' },
  guess_miss: { e: '🎲', bg: '#F3F4F8' },
  streak: { e: '🔥', bg: '#FDEEE2' },
  badge: { e: '🏅', bg: '#FDEEE2' },
};

function itemTitle(it: PointsItem, lang: Lang): string {
  const T = tr(lang);
  if (it.kind === 'streak') return T ? `${it.ref} gün serisi` : `${it.ref}-day streak`;
  if (it.kind === 'badge') {
    const b = BADGES.find((x) => x.id === it.ref);
    if (b) return T ? `${b.name.tr} rozeti` : `${b.name.en} badge`;
    return T ? KIND_TR.badge : KIND_EN.badge;
  }
  return (T ? KIND_TR : KIND_EN)[it.kind] ?? it.kind;
}

function itemSub(it: PointsItem, lang: Lang): string | null {
  const T = tr(lang);
  if (it.kind === 'moment' && it.info) {
    const [id, time] = it.info.split('|');
    const name = id ? activityName(id, lang) : '';
    return [name, time].filter(Boolean).join(' · ') || null;
  }
  if (it.kind === 'question' || it.kind === 'guess_hit' || it.kind === 'guess_miss') {
    const q = T ? it.info : it.infoEn || it.info;
    return q || null;
  }
  if (it.kind === 'streak') return T ? 'Seri bonusu' : 'Streak bonus';
  if (it.kind === 'badge') return T ? 'Rozet puanı' : 'Badge points';
  return null;
}

function itemIcon(it: PointsItem): { e: string; bg: string } {
  if (it.kind === 'badge') {
    const b = BADGES.find((x) => x.id === it.ref);
    if (b) return { e: b.emoji, bg: KIND_ICON.badge.bg };
  }
  return KIND_ICON[it.kind] ?? { e: '•', bg: '#F3F4F8' };
}

function dayText(day: string, lang: Lang): string {
  const T = tr(lang);
  const today = istanbulToday();
  if (day === today) return T ? 'Bugün' : 'Today';
  const d = new Date(day + 'T12:00:00Z');
  const t = new Date(today + 'T12:00:00Z');
  const diff = Math.round((t.getTime() - d.getTime()) / 86400000);
  if (diff === 1) return T ? 'Dün' : 'Yesterday';
  if (diff > 1 && diff < 7) {
    const w = d.toLocaleDateString(T ? 'tr-TR' : 'en-US', { weekday: 'long', timeZone: 'UTC' });
    return w.charAt(0).toLocaleUpperCase(T ? 'tr-TR' : 'en-US') + w.slice(1);
  }
  return d.toLocaleDateString(T ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'long', timeZone: 'UTC' });
}

// Bugünün haftadaki sırası (pazartesi = 0)
function todayIndex(): number {
  const d = new Date(istanbulToday() + 'T12:00:00Z').getUTCDay(); // pazar = 0
  return (d + 6) % 7;
}

const DAY_SHORT_TR = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'];
const DAY_SHORT_EN = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function PredictionSheet({ lang, data, onClose }: { lang: Lang; data: PredictionWeeks; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [howOpen, setHowOpen] = useState(false);
  useEffect(() => {
    setOverlayBusy('prediction', true);
    return () => setOverlayBusy('prediction', false);
  }, []);

  const T = tr(lang);
  const loc = T ? 'tr-TR' : 'en-US';
  const fmt = (n: number) => n.toLocaleString(loc);
  const week = data.current;
  const ti = todayIndex();
  const maxDay = Math.max(1, ...data.days);
  const monthName = new Date(istanbulToday() + 'T12:00:00Z').toLocaleDateString(loc, { month: 'long', timeZone: 'UTC' });
  const monthLabel = monthName.charAt(0).toLocaleUpperCase(loc) + monthName.slice(1);
  const diff = data.weekTotal - data.lastWeekTotal;

  // Seri
  const today = istanbulToday();
  const todayActive = data.history.some((h) => h.day === today && (h.kind === 'moment' || h.kind === 'question'));
  const next = nextStreakStep(data.streak);
  const ringPct = next ? Math.min(1, data.streak / next.day) : 1;
  let streakTitle: string;
  let streakSub: string;
  if (data.streak === 0) {
    streakTitle = T ? 'Seri başlat' : 'Start a streak';
    streakSub = T ? '3 gün üst üste gel, +10 puan kazan' : 'Come back 3 days in a row for +10';
  } else if (!next) {
    streakTitle = T ? `🔥 ${data.streak} gün üst üste` : `🔥 ${data.streak} days in a row`;
    streakSub = T ? 'Bir aydan uzun seri. Çok az kişi bunu yapıyor.' : 'Over a month. Very few people get here.';
  } else {
    streakTitle = T ? `🔥 ${data.streak} gün üst üste` : `🔥 ${data.streak} ${data.streak === 1 ? 'day' : 'days'} in a row`;
    const left = next.day - data.streak;
    streakSub = !todayActive
      ? T
        ? 'Bugün bir an seç ya da soruyu cevapla, seri sürsün'
        : 'Pick a moment or answer today to keep it going'
      : T
        ? `${left} gün daha gelirsen +${next.points} puan`
        : `${left} more ${left === 1 ? 'day' : 'days'} for +${next.points}`;
  }

  // Puanların nereden geldiği
  const kinds = [
    { k: 'moment', label: T ? 'Anlar' : 'Moments', color: ACCENT, v: data.byKind.moment },
    { k: 'question', label: T ? 'Günün Sorusu' : 'Daily question', color: '#7C79E8', v: data.byKind.question },
    { k: 'guess', label: T ? 'Tahminler' : 'Guesses', color: LAVENDER, v: data.byKind.guess },
    { k: 'badge', label: T ? 'Rozetler' : 'Badges', color: PEACH, v: data.byKind.badge },
    { k: 'streak', label: T ? 'Seri' : 'Streaks', color: '#F8D7BE', v: data.byKind.streak },
  ].filter((x) => x.v > 0);

  // Geçmiş: güne göre grupla
  const groups: { day: string; total: number; items: PointsItem[] }[] = [];
  for (const it of data.history) {
    let g = groups[groups.length - 1];
    if (!g || g.day !== it.day) {
      g = { day: it.day, total: 0, items: [] };
      groups.push(g);
    }
    g.total += it.points;
    g.items.push(it);
  }

  const toTop10 = week.top10 !== null && week.points < week.top10 ? week.top10 - week.points : 0;

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={T ? 'Kapat' : 'Close'} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12, maxHeight: '92%' }]}>
          <View style={styles.grab} />
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
            {/* Üst kart */}
            <View style={styles.hdr}>
              <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
                <Defs>
                  <SvgGradient id="pg" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor="#4B47D6" />
                    <Stop offset="0.7" stopColor="#2B2899" />
                    <Stop offset="1" stopColor="#221F7A" />
                  </SvgGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill="url(#pg)" />
                <Circle cx="88%" cy="0" r="100" fill="rgba(255,255,255,0.06)" />
              </Svg>
              <View style={styles.hdrTop}>
                <Text style={styles.hdrLabel}>{T ? 'Puanın' : 'Your points'}</Text>
                <Text style={styles.hdrLabel}>
                  {monthLabel} · {fmt(data.monthTotal)}
                </Text>
              </View>
              <View style={styles.hdrNumRow}>
                <Text style={styles.hdrNum}>{fmt(data.allTotal)}</Text>
                <Text style={styles.hdrUnit}>{T ? 'puan' : 'pts'}</Text>
              </View>
              <View style={styles.delta}>
                <Text style={styles.deltaText}>
                  {T ? 'Bu hafta ' : 'This week '}
                  <Text style={{ color: PEACH }}>+{fmt(data.weekTotal)}</Text>
                  {diff > 0 && data.lastWeekTotal > 0
                    ? T
                      ? ` · geçen haftadan ${fmt(diff)} fazla`
                      : ` · ${fmt(diff)} more than last week`
                    : ''}
                </Text>
              </View>
              <View style={styles.bars}>
                {data.days.map((v, i) => {
                  const future = i > ti;
                  const h = future || v === 0 ? 3 : Math.max(8, Math.round((v / maxDay) * 56));
                  return (
                    <View key={i} style={styles.barCol}>
                      <View
                        style={[
                          styles.bar,
                          { height: h },
                          i === ti && v > 0 && { backgroundColor: PEACH },
                          future && { backgroundColor: 'rgba(255,255,255,0.15)' },
                        ]}
                      />
                      <Text style={[styles.barDay, i === ti && styles.barDayToday]}>{(T ? DAY_SHORT_TR : DAY_SHORT_EN)[i]}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Seri */}
            <View style={styles.card}>
              <Text style={styles.cardKicker}>{T ? 'SERİ' : 'STREAK'}</Text>
              <View style={styles.streakRow}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={styles.streakTitle}>{streakTitle}</Text>
                  <Text style={styles.streakSub}>{streakSub}</Text>
                </View>
                <Ring pct={ringPct} label={next ? `${data.streak}/${next.day}` : '30+'} />
              </View>
              {next && next.day <= 7 ? (
                <View style={styles.dots}>
                  {Array.from({ length: next.day }).map((_, i) => (
                    <View
                      key={i}
                      style={[styles.dot, i < data.streak && styles.dotOn, i === next.day - 1 && i >= data.streak && styles.dotGoal]}
                    />
                  ))}
                </View>
              ) : null}
            </View>

            {/* Puanların nereden geliyor */}
            {kinds.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.cardKicker}>{T ? 'PUANLARIN NEREDEN GELİYOR' : 'WHERE YOUR POINTS COME FROM'}</Text>
                <View style={styles.stack}>
                  {kinds.map((x) => (
                    <View key={x.k} style={{ flex: x.v, backgroundColor: x.color }} />
                  ))}
                </View>
                <View style={styles.legend}>
                  {kinds.map((x) => (
                    <View key={x.k} style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: x.color }]} />
                      <Text style={styles.legendLabel} numberOfLines={1}>
                        {x.label}
                      </Text>
                      <Text style={styles.legendVal}>{fmt(x.v)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Tahmin sıralaması */}
            {week.count > 0 ? (
              <View style={styles.card}>
                <Text style={styles.cardKicker}>{T ? 'TAHMİN SIRALAMASI · BU HAFTA' : 'GUESS RANKING · THIS WEEK'}</Text>
                {week.beat !== null ? (
                  <>
                    <View style={styles.rankRow}>
                      <Text style={styles.rankN}>%{week.beat}</Text>
                      <Text style={styles.rankText}>
                        {T ? `Tahmincilerin %${week.beat}’ini geçiyorsun.` : `You’re ahead of ${week.beat}% of guessers.`}
                        {'\n'}
                        {toTop10 > 0
                          ? T
                            ? `İlk %10 için ${toTop10} puan daha.`
                            : `${toTop10} more points for the top 10%.`
                          : T
                            ? 'İlk %10’dasın, Keskin Göz yolda.'
                            : 'You’re in the top 10%. Sharp Eye is coming.'}
                      </Text>
                    </View>
                    <View style={styles.pbar}>
                      <View style={styles.pbarGoal} />
                      <View style={[styles.pbarKnob, { left: `${Math.max(2, Math.min(98, week.beat))}%` }]} />
                    </View>
                    <View style={styles.pbarLabels}>
                      <Text style={styles.pbarLabel}>
                        {T ? `${week.hits}/${week.count} tahmin tuttu` : `${week.hits}/${week.count} right`}
                      </Text>
                      <Text style={styles.pbarLabel}>{T ? 'Keskin Göz ▸ %90' : 'Sharp Eye ▸ 90%'}</Text>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.streakTitle}>
                      {T ? `${week.count} tahminin ${week.hits}’i tuttu` : `${week.hits} of ${week.count} guesses right`}
                    </Text>
                    <Text style={styles.streakSub}>
                      {T
                        ? 'Yeterince kişi tahmin edince sıralaman burada görünecek.'
                        : 'Your ranking appears here once enough people have guessed.'}
                    </Text>
                  </>
                )}
              </View>
            ) : null}

            {/* Kazandıkların */}
            {groups.length === 0 ? (
              <Text style={styles.empty}>
                {T
                  ? 'Henüz puanın yok. Bugün bir an seç ya da Günün Sorusu’nu cevapla, ilk puanların gelsin.'
                  : 'No points yet. Pick a moment or answer the Question of the Day to earn your first points.'}
              </Text>
            ) : (
              groups.map((g) => (
                <View key={g.day}>
                  <View style={styles.groupHead}>
                    <Text style={styles.groupDay}>{dayText(g.day, lang)}</Text>
                    <Text style={styles.groupTotal}>+{fmt(g.total)}</Text>
                  </View>
                  {g.items.map((it, i) => {
                    const ic = itemIcon(it);
                    const sub = itemSub(it, lang);
                    return (
                      <View key={`${it.kind}-${it.ref ?? ''}-${i}`} style={styles.item}>
                        <View style={[styles.itemIcon, { backgroundColor: ic.bg }]}>
                          <Text style={{ fontSize: 17 }}>{ic.e}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.itemTitle} numberOfLines={1}>
                            {itemTitle(it, lang)}
                          </Text>
                          {sub ? (
                            <Text style={styles.itemSub} numberOfLines={1}>
                              {sub}
                            </Text>
                          ) : null}
                        </View>
                        <Text style={styles.itemPts}>+{it.points}</Text>
                      </View>
                    );
                  })}
                </View>
              ))
            )}

            {/* Nasıl kazanılır */}
            <Pressable
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setHowOpen((v) => !v);
              }}
              style={({ pressed }) => [styles.how, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
              accessibilityState={{ expanded: howOpen }}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.howTitle}>{T ? 'Nasıl kazanılır?' : 'How to earn'}</Text>
                <Text style={styles.howSub}>{T ? 'Puanlar, seriler ve Keskin Göz rozeti' : 'Points, streaks and the Sharp Eye badge'}</Text>
              </View>
              <Ionicons name={howOpen ? 'chevron-up' : 'chevron-down'} size={18} color={MUTED} />
            </Pressable>
            {howOpen ? (
              <View style={styles.rules}>
                <Rule label={T ? 'Günün ilk anını seç' : 'Pick your first moment of the day'} pts="+5" />
                <Rule label={T ? 'Günün Sorusu’nu cevapla' : 'Answer the Question of the Day'} pts="+5" />
                <Rule label={T ? 'Tahminin tutsun (tutmazsa +1)' : 'Guess right (+1 if not)'} pts={`+${POINTS_HIT}`} />
                <Rule label={T ? 'Üst üste 3 / 7 / 14 / 30 gün' : '3 / 7 / 14 / 30 days in a row'} pts="+10 / 30 / 50 / 100" />
                <Rule label={T ? 'Rozet kazan' : 'Earn a badge'} pts="+25 / 50" />
                <Text style={styles.note}>
                  {T
                    ? 'Puanların hiç silinmez, birikir. Seri bozulursa yeniden başlar ama kazandığın puanlar kalır. Haftalık tahmin sıralamasında en iyi %10 Keskin Göz rozetini alır.'
                    : 'Your points never reset. If a streak breaks it starts over, but you keep what you earned. The top 10% of weekly guessers earn the Sharp Eye badge.'}
                </Text>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Ring({ pct, label }: { pct: number; label: string }) {
  const r = 23;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: 56, height: 56, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={56} height={56} style={StyleSheet.absoluteFill}>
        <Circle cx={28} cy={28} r={r} stroke={ACCENT_BG} strokeWidth={6} fill="none" />
        <Circle
          cx={28}
          cy={28}
          r={r}
          stroke={ACCENT}
          strokeWidth={6}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
          transform="rotate(-90 28 28)"
        />
      </Svg>
      <Text style={styles.ringText}>{label}</Text>
    </View>
  );
}

function Rule({ label, pts }: { label: string; pts: string }) {
  return (
    <View style={styles.rule}>
      <Text style={styles.ruleText}>{label}</Text>
      <Text style={styles.rulePts}>{pts}</Text>
    </View>
  );
}

// ======================================================================== kilometre taşı anları
// Sadece önemli anlarda ortada bir kart açılır: 3/7/14/30 gün serisi ve 1.5.4'ü ilk açışta puan tanıtımı.
// Günde en fazla bir kez; başka bir pencere açıksa sırasını bekler.
const MOMENT_SEEN_KEY = 'points_moment_seen_v1'; // ['2026-11-13:7', ...]
const MOMENT_DAY_KEY = 'points_moment_day_v1'; // son kart gösterilen gün
const INTRO_KEY = 'points_intro_v1';
const MOMENT_DELAY_MS = 8000;

type PointsMoment = { kind: 'intro'; total: number } | { kind: 'streak'; day: number; points: number };

async function readSeen(): Promise<string[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(MOMENT_SEEN_KEY)) || '[]');
  } catch {
    return [];
  }
}

async function pickMoment(d: PredictionWeeks): Promise<PointsMoment | null> {
  const today = istanbulToday();
  const yesterday = new Date(new Date(today + 'T12:00:00Z').getTime() - 86400000).toISOString().slice(0, 10);
  const streaks = d.history.filter((h) => h.kind === 'streak');
  const seen = await readSeen();
  const intro = await AsyncStorage.getItem(INTRO_KEY).catch(() => 'x');
  if (!intro) {
    // İlk kez: tanıtım. O ana kadarki seri bonusları ayrıca kutlanmaz.
    await AsyncStorage.setItem(INTRO_KEY, today).catch(() => {});
    await AsyncStorage.setItem(MOMENT_SEEN_KEY, JSON.stringify(streaks.map((s) => `${s.day}:${s.ref}`))).catch(() => {});
    if (d.allTotal <= 0) return null;
    return { kind: 'intro', total: d.allTotal };
  }
  const lastDay = await AsyncStorage.getItem(MOMENT_DAY_KEY).catch(() => null);
  if (lastDay === today) return null;
  const fresh = streaks.find((s) => (s.day === today || s.day === yesterday) && !seen.includes(`${s.day}:${s.ref}`));
  if (!fresh) return null;
  await AsyncStorage.setItem(MOMENT_SEEN_KEY, JSON.stringify([...seen, `${fresh.day}:${fresh.ref}`].slice(-30))).catch(() => {});
  return { kind: 'streak', day: Number(fresh.ref) || 0, points: fresh.points };
}

export function PointsMomentHost({ lang }: { lang: Lang }) {
  const [moment, setMoment] = useState<PointsMoment | null>(null);
  const [sheet, setSheet] = useState<PredictionWeeks | null>(null);
  const checking = useRef(false);
  const anim = useRef(new Animated.Value(0)).current;
  const T = tr(lang);

  useEffect(() => {
    setOverlayBusy('points_moment', !!moment);
    return () => setOverlayBusy('points_moment', false);
  }, [moment]);

  const check = useCallback(async () => {
    if (checking.current || moment) return;
    checking.current = true;
    try {
      const d = await fetchPredictionWeeks();
      if (!d) return;
      const m = await pickMoment(d);
      if (!m) return;
      whenOverlayFree(() => {
        AsyncStorage.setItem(MOMENT_DAY_KEY, istanbulToday()).catch(() => {});
        track('points_moment', { kind: m.kind, day: m.kind === 'streak' ? m.day : 0 });
        anim.setValue(0);
        setMoment(m);
        Animated.spring(anim, { toValue: 1, friction: 7, tension: 80, useNativeDriver: true }).start();
        setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}), 150);
      }, 'points_moment');
    } finally {
      checking.current = false;
    }
  }, [moment, anim]);

  useEffect(() => {
    const t = setTimeout(() => check().catch(() => {}), MOMENT_DELAY_MS);
    const off = onPredictionChanged(() => {
      setTimeout(() => check().catch(() => {}), 1500);
    });
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setTimeout(() => check().catch(() => {}), 3000);
    });
    return () => {
      clearTimeout(t);
      off();
      sub.remove();
    };
  }, [check]);

  function close() {
    setMoment(null);
  }

  async function openPoints() {
    setMoment(null);
    const d = await fetchPredictionWeeks();
    if (d) setTimeout(() => setSheet(d), 350);
  }

  let content: { emoji: string; title: string; big: string; body: string; primary: string; secondary: string } | null = null;
  if (moment?.kind === 'streak') {
    const n = moment.day;
    const next = nextStreakStep(n);
    const bodyTr =
      n >= 30
        ? 'Bir ay boyunca her gün geldin. Bu seriyi çok az kişi yapıyor.'
        : n >= 14
          ? `İki haftadır her gün buradasın. ${next ? `${next.day}. günde +${next.points} seni bekliyor.` : ''}`
          : n >= 7
            ? `Bir hafta boyunca her gün geldin. Seriyi sürdür: ${next ? `${next.day}. günde +${next.points} seni bekliyor.` : ''}`
            : `Üç gün üst üste geldin. ${next ? `${next.day}. günde +${next.points} seni bekliyor.` : ''}`;
    const bodyEn =
      n >= 30
        ? 'You came every day for a month. Very few people do this.'
        : `You showed up ${n} days in a row. ${next ? `Day ${next.day} brings +${next.points}.` : ''}`;
    content = {
      emoji: '🔥',
      title: T ? `${n} gün üst üste!` : `${n} days in a row!`,
      big: T ? `+${moment.points} bonus puan` : `+${moment.points} bonus points`,
      body: T ? bodyTr.trim() : bodyEn.trim(),
      primary: T ? 'Harika!' : 'Nice!',
      secondary: T ? 'Puanlarımı gör' : 'See my points',
    };
  } else if (moment?.kind === 'intro') {
    const big = moment.total >= 20;
    content = {
      emoji: '🎯',
      title: T ? (big ? 'Puanların hazır' : 'Puan toplamaya başladın') : big ? 'Your points are here' : 'You’re earning points',
      big: T ? `${moment.total.toLocaleString('tr-TR')} puan` : `${moment.total.toLocaleString('en-US')} points`,
      body: T
        ? big
          ? 'Kasım’dan beri seçtiğin anlar, cevapladığın sorular ve serilerin sayıldı. Her gün gel, puanın büyüsün.'
          : 'Seçtiğin her an, cevapladığın her soru ve serilerin puan kazandırır. Her gün gel, puanın büyüsün.'
        : 'Every moment you pick, every question you answer and your streaks earn points. Come back daily to grow them.',
      primary: T ? 'Puanlarımı gör' : 'See my points',
      secondary: T ? 'Tamam' : 'OK',
    };
  }

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
  return (
    <>
      {moment && content ? (
        <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
          <View style={styles.momentBackdrop}>
            <Animated.View style={[styles.momentCard, { opacity: anim, transform: [{ scale }] }]}>
              <Text style={styles.momentEmoji}>{content.emoji}</Text>
              <Text style={styles.momentTitle}>{content.title}</Text>
              <Text style={styles.momentBig}>{content.big}</Text>
              <Text style={styles.momentBody}>{content.body}</Text>
              <Pressable
                style={({ pressed }) => [styles.momentBtn, pressed && { opacity: 0.85 }]}
                onPress={moment.kind === 'intro' ? openPoints : close}
                accessibilityRole="button"
              >
                <Text style={styles.momentBtnText}>{content.primary}</Text>
              </Pressable>
              <Pressable onPress={moment.kind === 'intro' ? close : openPoints} hitSlop={10} accessibilityRole="button">
                <Text style={styles.momentLink}>{content.secondary}</Text>
              </Pressable>
            </Animated.View>
          </View>
        </Modal>
      ) : null}
      {sheet ? <PredictionSheet lang={lang} data={sheet} onClose={() => setSheet(null)} /> : null}
    </>
  );
}

// ======================================================================== pazartesi sonucu
const SHOW_DELAY_MS = 6500; // günün sorusu ve kampüs penceresinden sonra

export function PredictionWeeklyHost({ lang }: { lang: Lang }) {
  const insets = useSafeAreaInsets();
  const [week, setWeek] = useState<PredictionWeek | null>(null);
  const checking = useRef(false);

  useEffect(() => {
    setOverlayBusy('prediction_week', !!week);
    return () => setOverlayBusy('prediction_week', false);
  }, [week]);

  const check = useCallback(async () => {
    if (checking.current || week) return;
    checking.current = true;
    try {
      const w = await pendingWeeklyResult();
      if (!w) return;
      whenOverlayFree(() => {
        markWeeklyResultSeen(w.week).catch(() => {});
        track('prediction_week', { points: w.points, beat: w.beat ?? -1, badge: w.badge });
        setWeek(w);
      }, 'prediction_week');
    } finally {
      checking.current = false;
    }
  }, [week]);

  useEffect(() => {
    const t = setTimeout(() => check().catch(() => {}), SHOW_DELAY_MS);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setTimeout(() => check().catch(() => {}), 2500);
    });
    return () => {
      clearTimeout(t);
      sub.remove();
    };
  }, [check]);

  if (!week) return null;
  const T = tr(lang);

  function close() {
    const earned = week?.badge;
    setWeek(null);
    // Rozet kutlaması bu ekran kapandıktan sonra (iki pencere üst üste açılmasın)
    if (earned) setTimeout(() => awardBadges(['sharp_eye']).catch(() => {}), 600);
  }

  async function share() {
    if (!week) return;
    Haptics.selectionAsync().catch(() => {});
    const msg =
      week.beat !== null
        ? T
          ? `Şu An'da geçen hafta tahmincilerin %${week.beat}'ini geçtim 🎯 Sen de dene 👉 ${DOWNLOAD_URL}`
          : `I beat ${week.beat}% of guessers on Şu An last week 🎯 Try it 👉 ${DOWNLOAD_URL}`
        : T
          ? `Şu An'da geçen hafta ${week.count} tahminin ${week.hits}'ini bildim 🎯 Sen de dene 👉 ${DOWNLOAD_URL}`
          : `I got ${week.hits} of ${week.count} guesses right on Şu An last week 🎯 Try it 👉 ${DOWNLOAD_URL}`;
    try {
      await Share.share(Platform.OS === 'ios' ? { message: msg } : { message: msg, title: 'Şu An' });
      track('app_share', { from: 'prediction_week' });
    } catch {}
  }

  const title =
    week.beat !== null
      ? T
        ? `Tahmincilerin %${week.beat}’ini geçtin!`
        : `You beat ${week.beat}% of guessers!`
      : T
        ? `${week.count} tahminin ${week.hits}’ini bildin`
        : `You got ${week.hits} of ${week.count} right`;
  const sub = week.badge
    ? T
      ? 'Keskin Göz rozetini kazandın: haftanın en iyi %10 tahmincisi. Bu hafta da gir, rozetini koru.'
      : "You earned the Sharp Eye badge: the week's top 10% of guessers. Do it again this week."
    : week.beat !== null
      ? T
        ? 'Bu hafta en iyi %10’a gir, Keskin Göz rozeti senin olsun.'
        : 'Make the top 10% this week and the Sharp Eye badge is yours.'
      : T
        ? 'Her gün tahmin et, puanını büyüt. Haftanın en iyi %10’u Keskin Göz rozetini kazanır.'
        : 'Guess every day to grow your score. The top 10% each week earn the Sharp Eye badge.';

  return (
    <Modal visible transparent={false} animationType="fade" statusBarTranslucent onRequestClose={close}>
      <View style={[styles.mon, { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.monKicker}>{T ? 'GEÇEN HAFTANIN SONUCU' : "LAST WEEK'S RESULT"}</Text>
        <View style={[styles.badge, !week.badge && styles.badgeDim]}>
          <Text style={{ fontSize: 64 }}>🎯</Text>
        </View>
        <Text style={styles.monTitle}>{title}</Text>
        <Text style={styles.monSub}>{sub}</Text>
        <View style={styles.stats}>
          <Stat n={String(week.points)} label={T ? 'puan' : 'points'} />
          <Stat n={String(week.hits)} label={T ? 'isabet' : 'hits'} />
          <Stat n={String(week.count)} label={T ? 'tahmin' : 'guesses'} />
        </View>
        <View style={{ flex: 1 }} />
        <Pressable style={({ pressed }) => [styles.monShare, pressed && { opacity: 0.85 }]} onPress={share} accessibilityRole="button">
          <Ionicons name="share-outline" size={18} color={NAVY} />
          <Text style={styles.monShareText}>{T ? 'Paylaş' : 'Share'}</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.monClose, pressed && { opacity: 0.85 }]} onPress={close} accessibilityRole="button">
          <Text style={styles.monCloseText}>{T ? 'Kapat' : 'Close'}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statN}>{n}</Text>
      <Text style={styles.statL}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hdr: { borderRadius: 24, overflow: 'hidden', paddingHorizontal: 18, paddingTop: 16, paddingBottom: 12 },
  hdrTop: { flexDirection: 'row', justifyContent: 'space-between' },
  hdrLabel: { fontFamily: F.medium, fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  hdrNumRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 4 },
  hdrNum: { fontFamily: F.bold, fontSize: 54, lineHeight: 60, color: '#ffffff', letterSpacing: -2 },
  hdrUnit: { fontFamily: F.medium, fontSize: 16, color: 'rgba(255,255,255,0.7)', marginLeft: 6, marginBottom: 10 },
  delta: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.13)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginTop: 6 },
  deltaText: { fontFamily: F.medium, fontSize: 12.5, color: '#ffffff' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 9, height: 82, marginTop: 12 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 5 },
  bar: { alignSelf: 'stretch', borderRadius: 6, backgroundColor: 'rgba(165,180,252,0.45)' },
  barDay: { fontFamily: F.regular, fontSize: 10.5, color: 'rgba(255,255,255,0.7)' },
  barDayToday: { fontFamily: F.bold, color: '#ffffff' },
  card: { borderWidth: 1, borderColor: '#EEEFF4', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 14, marginTop: 12 },
  cardKicker: { fontFamily: F.bold, fontSize: 11.5, letterSpacing: 0.6, color: MUTED },
  streakRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  streakTitle: { fontFamily: F.bold, fontSize: 18, color: NAVY, marginTop: 2 },
  streakSub: { fontFamily: F.regular, fontSize: 13, lineHeight: 18, color: MUTED, marginTop: 3 },
  ringText: { fontFamily: F.bold, fontSize: 13, color: ACCENT },
  dots: { flexDirection: 'row', gap: 6, marginTop: 12 },
  dot: { flex: 1, height: 6, borderRadius: 3, backgroundColor: ACCENT_BG },
  dotOn: { backgroundColor: ACCENT },
  dotGoal: { backgroundColor: 'rgba(244,184,138,0.35)', borderWidth: 1, borderColor: PEACH, borderStyle: 'dashed' },
  stack: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', gap: 2, marginTop: 12 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, rowGap: 8 },
  legendItem: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 14 },
  legendDot: { width: 9, height: 9, borderRadius: 3 },
  legendLabel: { flex: 1, fontFamily: F.regular, fontSize: 13, color: NAVY },
  legendVal: { fontFamily: F.bold, fontSize: 13, color: NAVY },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  rankN: { fontFamily: F.bold, fontSize: 26, color: NAVY },
  rankText: { flex: 1, fontFamily: F.regular, fontSize: 13, lineHeight: 18, color: MUTED },
  pbar: { height: 8, borderRadius: 4, backgroundColor: '#DCDFF9', marginTop: 14, justifyContent: 'center' },
  pbarGoal: { position: 'absolute', left: '90%', top: -6, bottom: -6, width: 2, backgroundColor: PEACH },
  pbarKnob: { position: 'absolute', marginLeft: -9, width: 18, height: 18, borderRadius: 9, backgroundColor: ACCENT, borderWidth: 3, borderColor: '#ffffff' },
  pbarLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  pbarLabel: { fontFamily: F.regular, fontSize: 11, color: '#9AA0B4' },
  groupHead: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18, marginBottom: 2 },
  groupDay: { fontFamily: F.bold, fontSize: 13.5, color: NAVY },
  groupTotal: { fontFamily: F.bold, fontSize: 13.5, color: ACCENT },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  itemIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  itemTitle: { fontFamily: F.medium, fontSize: 14.5, color: NAVY },
  itemSub: { fontFamily: F.regular, fontSize: 12, color: MUTED, marginTop: 1 },
  itemPts: { fontFamily: F.bold, fontSize: 14.5, color: ACCENT },
  how: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F6F6FB', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 13, marginTop: 18 },
  howSub: { fontFamily: F.regular, fontSize: 12, color: MUTED, marginTop: 2 },
  momentBackdrop: { flex: 1, backgroundColor: 'rgba(10,14,30,0.55)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  momentCard: { alignSelf: 'stretch', backgroundColor: NAVY, borderRadius: 28, paddingHorizontal: 22, paddingTop: 26, paddingBottom: 18, alignItems: 'center' },
  momentEmoji: { fontSize: 58 },
  momentTitle: { fontFamily: F.bold, fontSize: 25, color: '#ffffff', textAlign: 'center', marginTop: 10 },
  momentBig: { fontFamily: F.bold, fontSize: 25, color: PEACH, textAlign: 'center', marginTop: 2 },
  momentBody: { fontFamily: F.regular, fontSize: 14, lineHeight: 20, color: '#C9D3EE', textAlign: 'center', marginTop: 10 },
  momentBtn: { alignSelf: 'stretch', height: 52, borderRadius: 16, backgroundColor: PEACH, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  momentBtnText: { fontFamily: F.bold, fontSize: 16, color: NAVY },
  momentLink: { fontFamily: F.medium, fontSize: 14, color: LAVENDER, marginTop: 14 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#4F46E5',
    maxWidth: '100%',
  },
  chipText: { fontFamily: F.bold, fontSize: 13.5, color: '#ffffff' },
  backdrop: { flex: 1, backgroundColor: 'rgba(10,14,30,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 10 },
  grab: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: '#DADCE3', marginBottom: 14 },
  sheetTitle: { fontFamily: F.bold, fontSize: 21, color: INK },
  sheetSub: { fontFamily: F.regular, fontSize: 13.5, color: MUTED, marginTop: 4 },
  bigTotal: { alignItems: 'center', marginTop: 2 },
  bigTotalN: { fontFamily: F.bold, fontSize: 44, color: ACCENT, letterSpacing: -1 },
  bigTotalL: { fontFamily: F.regular, fontSize: 13, color: MUTED },
  howHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#F0F1F5' },
  howTitle: { fontFamily: F.bold, fontSize: 15, color: INK },
  empty: { fontFamily: F.regular, fontSize: 13.5, lineHeight: 19, color: MUTED, marginTop: 8 },
  hist: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F0F1F5' },
  histDay: { fontFamily: F.regular, fontSize: 12.5, color: MUTED, width: 78 },
  histLabel: { flex: 1, fontFamily: F.medium, fontSize: 14, color: INK },
  histPts: { fontFamily: F.bold, fontSize: 14, color: ACCENT },
  totals: { flexDirection: 'row', gap: 8, marginTop: 14 },
  total: { flex: 1, backgroundColor: '#F6F7FB', borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  totalStrong: { backgroundColor: '#4F46E5' },
  totalN: { fontFamily: F.bold, fontSize: 24, color: INK },
  totalL: { fontFamily: F.regular, fontSize: 12, color: MUTED, marginTop: 2 },
  section: { fontFamily: F.bold, fontSize: 11.5, letterSpacing: 1, color: '#8A8E99', marginTop: 18 },
  track: { height: 12, borderRadius: 6, backgroundColor: '#EEF0F4', marginTop: 18, overflow: 'visible' },
  fill: { height: 12, borderRadius: 6, backgroundColor: '#4F46E5' },
  goal: { position: 'absolute', right: 0, top: -5, bottom: -5, width: 3, borderRadius: 2, backgroundColor: PEACH },
  trackLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  trackLabel: { fontFamily: F.regular, fontSize: 11.5, color: MUTED },
  status: { fontFamily: F.bold, fontSize: 15, lineHeight: 21, color: INK, marginTop: 14 },
  rules: { marginTop: 14, gap: 8 },
  rule: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F6F7FB', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  ruleText: { fontFamily: F.medium, fontSize: 14, color: INK },
  rulePts: { fontFamily: F.bold, fontSize: 14, color: ACCENT },
  note: { fontFamily: F.regular, fontSize: 12.5, lineHeight: 18, color: MUTED, marginTop: 12 },
  closeBtn: { marginTop: 16, height: 52, borderRadius: 16, backgroundColor: ACCENT_BG, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontFamily: F.bold, fontSize: 16, color: ACCENT },
  mon: { flex: 1, backgroundColor: NAVY, paddingHorizontal: 24, alignItems: 'center' },
  monKicker: { fontFamily: F.bold, fontSize: 12.5, letterSpacing: 1.6, color: LAVENDER },
  badge: {
    width: 150,
    height: 150,
    borderRadius: 75,
    marginTop: 34,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 8,
    borderColor: 'rgba(165,180,252,0.25)',
  },
  badgeDim: { backgroundColor: 'rgba(255,255,255,0.08)' },
  monTitle: { fontFamily: F.bold, fontSize: 29, lineHeight: 35, color: '#ffffff', textAlign: 'center', marginTop: 28 },
  monSub: { fontFamily: F.regular, fontSize: 15, lineHeight: 21, color: '#C9D3EE', textAlign: 'center', marginTop: 12 },
  stats: { flexDirection: 'row', gap: 10, marginTop: 22, alignSelf: 'stretch' },
  stat: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  statN: { fontFamily: F.bold, fontSize: 22, color: '#ffffff' },
  statL: { fontFamily: F.regular, fontSize: 12, color: '#AFC0E8', marginTop: 2 },
  monShare: {
    alignSelf: 'stretch',
    height: 54,
    borderRadius: 16,
    backgroundColor: PEACH,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monShareText: { fontFamily: F.bold, fontSize: 16, color: NAVY },
  monClose: { alignSelf: 'stretch', marginTop: 10, height: 50, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  monCloseText: { fontFamily: F.bold, fontSize: 15, color: '#ffffff' },
});
