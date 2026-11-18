// Selam: aynı aktiviteyi yapanlara anonim "selam".
// - Gün içinde gönderilir (her aktivite için günde bir kez).
// - 1.5.9: gelen selamlar gün içinde hemen görünür (ana ekrandaki hap, an ekranındaki kart, "yeni selam" şeridi).
//   Akşam 21:00 sonuç ekranındaki toplu şerit yine 5 ve üstünde çıkar.
// - Kimin kime selam verdiği tutulmaz; sadece "bu gün bu aktivitede kaç selam var".
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ensureSession, supabase } from '@/lib/supabase';
import { isBeforeResults, istanbulToday, istanbulYesterday } from '@/lib/dailyQuestion';

const SENT_KEY = 'selam_sent_v1'; // { 'YYYY-MM-DD': ['coffee', 'work'] }
const RECEIVED_KEY = 'selam_received_v1'; // { 'YYYY-MM-DD': 214 }  (günlük toplam, rozet ve sayaç için)
const HISTORY_KEY = 'moment_history_v1'; // index.tsx'teki an geçmişi (sadece telefonda)

export const SELAM_MIN = 5; // bunun altındaki selam sayısı gösterilmez

type Listener = () => void;
const listeners = new Set<Listener>();
export function onSelamChanged(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
function emit() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {}
  });
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

// Bugün bu aktiviteye selam verdim mi?
export async function hasSentSelam(activityId: string): Promise<boolean> {
  const all = await readJson<Record<string, string[]>>(SENT_KEY, {});
  return (all[istanbulToday()] ?? []).includes(activityId);
}

// Toplam gönderilen selam (rozetler için)
export async function sentSelamTotal(): Promise<number> {
  const all = await readJson<Record<string, string[]>>(SENT_KEY, {});
  return Object.values(all).reduce((n, list) => n + (Array.isArray(list) ? list.length : 0), 0);
}

// Selam gönder. Başarılıysa (ya da bugün zaten gönderilmişse) true.
export async function sendSelam(activityId: string): Promise<boolean> {
  try {
    if (!(await ensureSession())) return false;
    const { error } = await supabase.from('selams').insert({ activity_id: activityId });
    if (error && error.code !== '23505') return false; // 23505 = bugün zaten gönderilmiş
    const day = istanbulToday();
    const all = await readJson<Record<string, string[]>>(SENT_KEY, {});
    const list = new Set(all[day] ?? []);
    list.add(activityId);
    all[day] = [...list];
    await AsyncStorage.setItem(SENT_KEY, JSON.stringify(all)).catch(() => {});
    emit();
    return true;
  } catch {
    return false;
  }
}

type HistoryEntry = { id: string; at: number };

// O gün (İstanbul günü) seçtiğim aktiviteler
async function activitiesOn(day: string): Promise<string[]> {
  const h = await readJson<HistoryEntry[]>(HISTORY_KEY, []);
  const ids = new Set<string>();
  for (const e of Array.isArray(h) ? h : []) {
    if (e && typeof e.at === 'number' && istanbulToday(new Date(e.at)) === day) ids.add(e.id);
  }
  return [...ids].slice(0, 20);
}

export type SelamSummary = {
  day: string;
  total: number;
  byActivity: { id: string; count: number }[]; // çoktan aza
};

// Bir günün gelen selamları, saat ve alt sınır gözetmeden (toplam 0 da olabilir). Hata olursa null.
async function loadSummary(day: string): Promise<SelamSummary | null> {
  try {
    const acts = await activitiesOn(day);
    if (acts.length === 0) return null;
    if (!(await ensureSession())) return null;
    const { data, error } = await supabase.rpc('selam_received', { p_day: day, p_activities: acts });
    if (error || !Array.isArray(data)) return null;
    const rows = (data as { activity_id: string; cnt: number }[])
      .map((r) => ({ id: r.activity_id, count: Number(r.cnt) || 0 }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count);
    const total = rows.reduce((n, r) => n + r.count, 0);

    // Günlük toplamı telefonda sakla (Rozetler'deki "bugüne kadar aldığın selam" sayacı için)
    const rec = await readJson<Record<string, number>>(RECEIVED_KEY, {});
    if ((rec[day] ?? 0) !== total) {
      rec[day] = total;
      await AsyncStorage.setItem(RECEIVED_KEY, JSON.stringify(rec)).catch(() => {});
    }
    return { day, total, byActivity: rows };
  } catch {
    return null;
  }
}

// Akşam sonuç ekranındaki toplu şerit: 21:00'den önce bugün için null, 5'in altındaysa null.
export async function fetchSelamSummary(day: string): Promise<SelamSummary | null> {
  if (day === istanbulToday() && isBeforeResults()) return null;
  const s = await loadSummary(day);
  return s && s.total >= SELAM_MIN ? s : null;
}

// 1.5.9: bugünün selamları, beklemeden (toplam 0 da olabilir)
export async function fetchSelamLive(): Promise<SelamSummary | null> {
  return loadSummary(istanbulToday());
}

// 1.5.9: bugün bu aktivitede bana gelen selam sayısı (an ekranındaki kart için). Bilinmiyorsa null.
export async function fetchSelamCount(activityId: string): Promise<number | null> {
  const s = await fetchSelamLive();
  if (!s) return null;
  return s.byActivity.find((r) => r.id === activityId)?.count ?? 0;
}

// Ana ekran hapı için: bugün en az bir selam geldiyse bugünün sayısı (canlı);
// henüz gelmediyse ve saat 21:00'den önceyse dünün toplamı (5 ve üstü).
export async function fetchLatestSelamSummary(): Promise<SelamSummary | null> {
  const today = await fetchSelamLive();
  if (today && today.total > 0) return today;
  if (!isBeforeResults()) return null;
  const y = await loadSummary(istanbulYesterday());
  return y && y.total >= SELAM_MIN ? y : null;
}

// 1.5.9: "son girişinden beri N yeni selam". Görülen son toplam telefonda tutulur (gün değişince sıfırlanır).
const SEEN_KEY = 'selam_seen_v1'; // { day: 'YYYY-MM-DD', total: 12 }
export async function newSelamsSince(total: number): Promise<number> {
  const seen = await readJson<{ day?: string; total?: number }>(SEEN_KEY, {});
  const base = seen.day === istanbulToday() ? Number(seen.total) || 0 : 0;
  return Math.max(0, total - base);
}
export async function markSelamsSeen(total: number): Promise<void> {
  await AsyncStorage.setItem(SEEN_KEY, JSON.stringify({ day: istanbulToday(), total })).catch(() => {});
  emit();
}

// Bugüne kadar alınan toplam selam (telefonda biriken günlük toplamlardan)
export async function receivedSelamTotal(): Promise<number> {
  const rec = await readJson<Record<string, number>>(RECEIVED_KEY, {});
  return Object.values(rec).reduce((n, v) => n + (Number(v) || 0), 0);
}
