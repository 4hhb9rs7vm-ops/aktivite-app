// Selam: aynı aktiviteyi yapanlara anonim "selam".
// - Gün içinde gönderilir (her aktivite için günde bir kez).
// - Gelen selamlar akşam 21:00'den sonra toplu görünür; 5'in altındaysa hiç gösterilmez.
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

// Bir günün gelen selamları. 21:00'den önce bugün için null döner (akşam toplu görünür).
export async function fetchSelamSummary(day: string): Promise<SelamSummary | null> {
  try {
    if (day === istanbulToday() && isBeforeResults()) return null;
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
    if (total < SELAM_MIN) return null;
    return { day, total, byActivity: rows };
  } catch {
    return null;
  }
}

// Ana ekran rozeti için: 21:00'den sonra bugünün, 21:00'den önce dünün selamları
export async function fetchLatestSelamSummary(): Promise<SelamSummary | null> {
  return fetchSelamSummary(isBeforeResults() ? istanbulYesterday() : istanbulToday());
}

// Bugüne kadar alınan toplam selam (telefonda biriken günlük toplamlardan)
export async function receivedSelamTotal(): Promise<number> {
  const rec = await readJson<Record<string, number>>(RECEIVED_KEY, {});
  return Object.values(rec).reduce((n, v) => n + (Number(v) || 0), 0);
}
