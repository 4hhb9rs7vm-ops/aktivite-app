// 1.5.4: Tahmin Oyunu (Günün Sorusu üzerinden)
// Kişi Günün Sorusu'nu cevapladıktan sonra "Sence çoğunluk ne dedi?" diye tahmin eder.
// 21:00'de sonuçla birlikte tahminin tuttu mu görür. Tutarsa 10, tutmazsa 1 puan (katıldığı için).
// Puanlar haftalık (pazartesi başlar, İstanbul saati). Hesap sunucuda: get_prediction_week.
// Yüzdelik dilim ve Keskin Göz rozeti sadece o hafta en az PARTICIPANTS_MIN kişi tahmin yaptıysa.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ensureSession, supabase } from '@/lib/supabase';
import type { DailyQuestion, DQResult } from '@/lib/dailyQuestion';
import { track } from '@/lib/analytics';
import { getEarnedBadges, onBadgesChanged } from '@/lib/badges';

export const POINTS_HIT = 10;
export const POINTS_MISS = 1;

const LOCAL_KEY = 'dq_predictions_v1'; // { 'YYYY-MM-DD': 'a' }
const WEEK_SEEN_KEY = 'prediction_week_seen_v1'; // sonucu gösterilen son hafta (pazartesi tarihi)

type Listener = () => void;
const listeners = new Set<Listener>();
export function onPredictionChanged(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
function notify() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {}
  });
}

async function readLocal(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
async function saveLocal(day: string, key: string) {
  const all = await readLocal();
  all[day] = key;
  // Son 60 gün yeter
  const days = Object.keys(all).sort().slice(-60);
  const trimmed: Record<string, string> = {};
  for (const d of days) trimmed[d] = all[d];
  await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(trimmed)).catch(() => {});
}

// Tahmini gönder. İlk tahmin geçerli; daha önce tahmin yapıldıysa sunucudakini döner.
export async function submitPrediction(q: DailyQuestion, optionKey: string): Promise<string | null> {
  if (!(await ensureSession())) return null;
  const { error } = await supabase.from('dq_predictions').insert({ question_id: q.id, option_key: optionKey });
  if (error && error.code !== '23505') return null;
  let saved = optionKey;
  if (error) {
    const { data } = await supabase.from('dq_predictions').select('option_key').eq('question_id', q.id).maybeSingle();
    saved = (data as { option_key?: string } | null)?.option_key ?? optionKey;
  }
  await saveLocal(q.day_date, saved);
  track('prediction_made', { day: q.day_date });
  notify();
  return saved;
}

// Bu soruya yapılan tahmin (önce telefon, sonra sunucu)
export async function getMyPrediction(q: DailyQuestion): Promise<string | null> {
  const local = await readLocal();
  if (local[q.day_date]) return local[q.day_date];
  try {
    if (!(await ensureSession())) return null;
    const { data } = await supabase.from('dq_predictions').select('option_key').eq('question_id', q.id).maybeSingle();
    const key = (data as { option_key?: string } | null)?.option_key ?? null;
    if (key) await saveLocal(q.day_date, key);
    return key;
  } catch {
    return null;
  }
}

// Çoğunluğun cevabı: en yüksek yüzdeli seçenek(ler). Eşitlikte hepsi doğru sayılır.
export function majorityKeys(q: DailyQuestion, result: DQResult): string[] {
  let max = -1;
  for (const o of q.options) max = Math.max(max, result.pct[o.key] ?? 0);
  return q.options.filter((o) => (result.pct[o.key] ?? 0) === max).map((o) => o.key);
}

export function isHit(q: DailyQuestion, result: DQResult, predicted: string): boolean {
  return majorityKeys(q, result).includes(predicted);
}

// ---------------------------------------------------------------- haftalık puan
export type PredictionWeek = {
  week: string; // pazartesi 'YYYY-MM-DD'
  points: number;
  hits: number;
  count: number; // puanlanmış tahmin sayısı
  participants: number; // bu hafta en az 3 tahmini puanlanan kişi
  beat: number | null; // tahmincilerin yüzde kaçını geçtin (participants yeterliyse)
  top10: number | null; // ilk %10'a girmek için gereken puan (participants yeterliyse)
  badge: boolean; // ilk %10 (participants yeterliyse ve en az 3 tahmin)
};

export type PointsItem = {
  day: string;
  kind: string; // question | moment | guess_hit | guess_miss | streak | badge
  ref: string | null; // seri: gün sayısı, rozet: rozet id
  points: number;
  info: string | null; // alt satır (an: "aktivite|saat", soru/tahmin: soru metni)
  infoEn: string | null;
};
export type PointsByKind = {
  moment: number;
  question: number;
  guess: number;
  streak: number;
  badge: number;
  welcome: number;
  share: number; // 1.5.7: ilk paylaşım
  invite: number; // 1.5.7: bağlantıdan katılan arkadaşlar
};
export const STREAK_STEPS: { day: number; points: number }[] = [
  { day: 3, points: 10 },
  { day: 7, points: 30 },
  { day: 14, points: 50 },
  { day: 30, points: 100 },
];
// Sıradaki seri bonusu (30'dan sonra yok)
export function nextStreakStep(streak: number): { day: number; points: number } | null {
  return STREAK_STEPS.find((s) => s.day > streak) ?? null;
}
export type PredictionWeeks = {
  current: PredictionWeek; // bu haftanın tahmin sıralaması
  last: PredictionWeek | null; // geçen haftanın (pazartesi sonucu)
  weekTotal: number; // bu hafta kazanılan tüm puan
  lastWeekTotal: number; // geçen hafta
  monthTotal: number; // bu ay
  allTotal: number; // toplam
  days: number[]; // bu haftanın günleri (pazartesi..pazar)
  byKind: PointsByKind; // puanların nereden geldiği
  streak: number; // şu anki seri (bugün ya da dün biten ardışık günler)
  history: PointsItem[]; // son kazanılanlar (yeniden eskiye)
};

function toWeek(raw: unknown): PredictionWeek | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!r.week) return null;
  return {
    week: String(r.week),
    points: Number(r.points) || 0,
    hits: Number(r.hits) || 0,
    count: Number(r.count) || 0,
    participants: Number(r.participants) || 0,
    beat: r.beat === null || r.beat === undefined ? null : Number(r.beat),
    top10: r.top10 === null || r.top10 === undefined ? null : Number(r.top10),
    badge: !!r.badge,
  };
}

let cache: { at: number; data: PredictionWeeks } | null = null;
export async function fetchPredictionWeeks(force = false): Promise<PredictionWeeks | null> {
  if (!force && cache && Date.now() - cache.at < 60 * 1000) return cache.data;
  try {
    if (!(await ensureSession())) return null;
    const { data, error } = await supabase.rpc('get_prediction_week');
    if (error || !data) return null;
    const d = data as {
      current?: unknown;
      last?: unknown;
      week_total?: number;
      last_week_total?: number;
      month_total?: number;
      all_total?: number;
      days?: unknown;
      by_kind?: Record<string, unknown>;
      streak?: number;
      history?: unknown;
    };
    const current = toWeek(d.current);
    if (!current) return null;
    const history: PointsItem[] = Array.isArray(d.history)
      ? (d.history as Record<string, unknown>[]).map((h) => ({
          day: String(h.day ?? ''),
          kind: String(h.kind ?? ''),
          ref: h.ref === null || h.ref === undefined ? null : String(h.ref),
          points: Number(h.points) || 0,
          info: h.info === null || h.info === undefined ? null : String(h.info),
          infoEn: h.info_en === null || h.info_en === undefined ? null : String(h.info_en),
        }))
      : [];
    const out: PredictionWeeks = {
      current,
      last: toWeek(d.last),
      weekTotal: Number(d.week_total) || 0,
      lastWeekTotal: Number(d.last_week_total) || 0,
      monthTotal: Number(d.month_total) || 0,
      allTotal: Number(d.all_total) || 0,
      days: Array.isArray(d.days) ? (d.days as unknown[]).slice(0, 7).map((n) => Number(n) || 0) : [0, 0, 0, 0, 0, 0, 0],
      byKind: {
        moment: Number(d.by_kind?.moment) || 0,
        question: Number(d.by_kind?.question) || 0,
        guess: Number(d.by_kind?.guess) || 0,
        streak: Number(d.by_kind?.streak) || 0,
        badge: Number(d.by_kind?.badge) || 0,
        welcome: Number(d.by_kind?.welcome) || 0,
        share: Number(d.by_kind?.share) || 0,
        invite: Number(d.by_kind?.invite) || 0,
      },
      streak: Number(d.streak) || 0,
      history,
    };
    cache = { at: Date.now(), data: out };
    return out;
  } catch {
    return null;
  }
}

export function invalidatePredictionCache() {
  cache = null;
}

// Puan kazandıran bir şey oldu (an seçildi, soru cevaplandı): hap yenilensin.
// Ölçüm olayları telefondan biraz gecikmeli gittiği için bir kez de birkaç saniye sonra yenilenir.
export function pointsChanged() {
  cache = null;
  notify();
  setTimeout(() => {
    cache = null;
    notify();
  }, 9000);
}

// Geçen haftanın sonucu gösterilmeli mi? (bir kez, geçen hafta en az 1 tahmin yaptıysa)
export async function pendingWeeklyResult(): Promise<PredictionWeek | null> {
  const w = await fetchPredictionWeeks(true);
  if (!w || !w.last || w.last.count === 0) return null;
  const seen = await AsyncStorage.getItem(WEEK_SEEN_KEY).catch(() => null);
  if (seen === w.last.week) return null;
  return w.last;
}

export async function markWeeklyResultSeen(week: string) {
  await AsyncStorage.setItem(WEEK_SEEN_KEY, week).catch(() => {});
}

// ---------------------------------------------------------------- hoş geldin puanı (1.5.4 (26))
// Yeni kullanıcı Anketler'e ilk girdiğinde bir kez 50 puan. Sunucuya user_badges'e 'bonus_welcome' olarak yazılır.
export const WELCOME_POINTS = 50;
const WELCOME_CLAIMED_KEY = 'welcome_points_v1';
export async function claimWelcomePoints(): Promise<boolean> {
  try {
    if (await AsyncStorage.getItem(WELCOME_CLAIMED_KEY)) return false;
    if (!(await ensureSession())) return false;
    const { error } = await supabase
      .from('user_badges')
      .upsert([{ badge_id: 'bonus_welcome' }], { onConflict: 'user_id,badge_id', ignoreDuplicates: true });
    if (error) return false;
    await AsyncStorage.setItem(WELCOME_CLAIMED_KEY, '1').catch(() => {});
    pointsChanged();
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- paylaşım ve davet puanları (1.5.7)
// İlk paylaşım: bir kereliğine 25 puan (sunucuda user_badges'e 'bonus_share').
// Davet: bağlantıdan/koddan katılan her arkadaş için iki tarafa 50 puan (sunucu yazar, invite_bonus).
export const SHARE_POINTS = 25;
export const INVITE_POINTS = 50;
const SHARE_CLAIMED_KEY = 'share_points_v1';
const INVITE_SEEN_KEY = 'invite_points_seen_v1';

export type BonusMoment = { kind: 'share' | 'invite'; points: number; name?: string };
let pendingBonus: BonusMoment | null = null;
const bonusListeners = new Set<() => void>();
export function showBonusMoment(m: BonusMoment): void {
  pendingBonus = m;
  bonusListeners.forEach((f) => {
    try {
      f();
    } catch {}
  });
}
export function takeBonusMoment(): BonusMoment | null {
  const m = pendingBonus;
  pendingBonus = null;
  return m;
}
export function onBonusMoment(cb: () => void): () => void {
  bonusListeners.add(cb);
  return () => {
    bonusListeners.delete(cb);
  };
}

export async function shareBonusClaimed(): Promise<boolean> {
  return !!(await AsyncStorage.getItem(SHARE_CLAIMED_KEY).catch(() => null));
}

// Paylaşım menüsü açıldıktan sonra çağrılır. İlk seferde puanı yazar ve kutlamayı sıraya koyar.
export async function claimShareBonus(): Promise<boolean> {
  try {
    if (await AsyncStorage.getItem(SHARE_CLAIMED_KEY)) return false;
    if (!(await ensureSession())) return false;
    const { error } = await supabase
      .from('user_badges')
      .upsert([{ badge_id: 'bonus_share' }], { onConflict: 'user_id,badge_id', ignoreDuplicates: true });
    if (error) return false;
    await AsyncStorage.setItem(SHARE_CLAIMED_KEY, '1').catch(() => {});
    pointsChanged();
    showBonusMoment({ kind: 'share', points: SHARE_POINTS });
    return true;
  } catch {
    return false;
  }
}

// Davet eden taraf: son bakıştan beri davet puanı arttıysa bir kez kutla.
export async function checkInviteBonus(): Promise<void> {
  try {
    const w = await fetchPredictionWeeks();
    if (!w) return;
    const now = w.byKind.invite;
    const raw = await AsyncStorage.getItem(INVITE_SEEN_KEY).catch(() => null);
    const seen = raw === null ? 0 : Number(raw) || 0;
    if (now === seen) return;
    await AsyncStorage.setItem(INVITE_SEEN_KEY, String(now)).catch(() => {});
    if (now > seen) showBonusMoment({ kind: 'invite', points: now - seen });
  } catch {}
}

// Katılan taraf: puan o an yazıldı, tekrar kutlanmasın diye görülen toplam da ilerletilir.
export async function noteInviteBonusJoined(name: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(INVITE_SEEN_KEY).catch(() => null);
    const seen = raw === null ? 0 : Number(raw) || 0;
    await AsyncStorage.setItem(INVITE_SEEN_KEY, String(seen + INVITE_POINTS)).catch(() => {});
  } catch {}
  pointsChanged();
  showBonusMoment({ kind: 'invite', points: INVITE_POINTS, name });
}

// ---------------------------------------------------------------- rozet puanları
// Telefonda kazanılan rozetleri sunucuya yazar (her rozet bir kez sayılır). Eski rozetler de puan kazandırır.
const BADGES_SYNCED_KEY = 'badges_synced_v1';
let syncing = false;
export async function syncBadges(): Promise<void> {
  if (syncing) return;
  syncing = true;
  try {
    const earned = await getEarnedBadges();
    const ids = Object.keys(earned);
    if (ids.length === 0) return;
    const sent: string[] = JSON.parse((await AsyncStorage.getItem(BADGES_SYNCED_KEY).catch(() => null)) || '[]');
    const fresh = ids.filter((id) => !sent.includes(id));
    if (fresh.length === 0) return;
    if (!(await ensureSession())) return;
    const today = new Date().toISOString().slice(0, 10);
    const rows = fresh.map((id) => {
      const d = earned[id];
      const day = /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= '2026-10-01' && d <= today ? d : undefined;
      return day ? { badge_id: id, earned_on: day } : { badge_id: id };
    });
    const { error } = await supabase.from('user_badges').upsert(rows, { onConflict: 'user_id,badge_id', ignoreDuplicates: true });
    if (error) return;
    await AsyncStorage.setItem(BADGES_SYNCED_KEY, JSON.stringify([...sent, ...fresh])).catch(() => {});
    cache = null;
    notify();
  } catch {
  } finally {
    syncing = false;
  }
}

let badgeSyncHooked = false;
export function hookBadgeSync() {
  if (badgeSyncHooked) return;
  badgeSyncHooked = true;
  onBadgesChanged(() => {
    syncBadges().catch(() => {});
  });
}
