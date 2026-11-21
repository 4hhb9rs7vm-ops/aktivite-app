// 1.6.0: Hazır tepkiler. Serbest yazı yok; metinler sunucu katalogundan gelir (cat_reactions).
// - Tepki kutusu yalnızca bugün o aktiviteyi yeterli kişi seçtiyse açılır (karar sunucuda, sayı uygulamaya gelmez).
// - Tepki, bugün aynı aktiviteyi seçen birkaç kişiye gider; gönderen kimliği hiçbir zaman dönmez.
// - Soru tepkilerine yalnızca hazır şıklarla cevap verilir. Hepsi gece yarısı silinir.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ensureSession, supabase } from '@/lib/supabase';
import { istanbulToday } from '@/lib/dailyQuestion';

export type ReactionBox = { open: boolean; left: number; ask: boolean }; // ask: soru tepkisini cevaplayabilecek biri var mı
export type ReactionItem = { id: number; activity: string; key: string; reply: string | null };
export type MyReactions = { got: ReactionItem[]; answers: ReactionItem[] };
export type SendResult = { ok: true; sent: number; left: number } | { ok: false; error: string };

const SEEN_KEY = 'reaction_seen_v1'; // { day, got, ans }: ana ekran şeridinde en son gösterilen
const SENT_KEY = 'reaction_sent_v2'; // { items: [{ a: 'study', k: 'hours', t: 1700000000000 }] }: son gönderilenler
const GAP_MS = 30 * 60 * 1000; // her an seçiminde (30 dk) bir aktiviteye tek tepki (sunucuda da aynı kural)

type Listener = () => void;
const listeners = new Set<Listener>();
export function onReactionsChanged(fn: Listener): () => void {
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

function items(v: unknown): ReactionItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((r: any) => ({
      id: Number(r?.id),
      activity: String(r?.activity ?? ''),
      key: String(r?.key ?? ''),
      reply: typeof r?.reply === 'string' ? r.reply : null,
    }))
    .filter((r) => Number.isFinite(r.id) && r.activity && r.key);
}

export async function fetchReactionBox(activityId: string): Promise<ReactionBox | null> {
  try {
    if (!(await ensureSession())) return null;
    const { data, error } = await supabase.rpc('get_reaction_box', { p_activity: activityId });
    if (error || !data) return null;
    const d = data as any;
    return { open: d.open === true, left: Number(d.left) || 0, ask: d.ask !== false };
  } catch {
    return null;
  }
}

export async function sendReaction(activityId: string, key: string): Promise<SendResult> {
  try {
    if (!(await ensureSession())) return { ok: false, error: 'auth' };
    const { data, error } = await supabase.rpc('send_reaction', { p_activity: activityId, p_key: key });
    if (error || !data) return { ok: false, error: 'network' };
    const d = data as any;
    if (d.ok !== true) return { ok: false, error: String(d.error ?? 'unknown') };
    if (Number(d.sent) > 0) await rememberSent(activityId, key);
    return { ok: true, sent: Number(d.sent) || 0, left: Number(d.left) || 0 };
  } catch {
    return { ok: false, error: 'network' };
  }
}

type SentItem = { a: string; k: string; t: number };
async function readSent(): Promise<SentItem[]> {
  try {
    const raw = await AsyncStorage.getItem(SENT_KEY);
    const v = raw ? JSON.parse(raw) : null;
    if (v && Array.isArray(v.items)) return v.items.filter((x: SentItem) => Date.now() - Number(x?.t) < GAP_MS);
  } catch {}
  return [];
}

async function rememberSent(activityId: string, key: string): Promise<void> {
  const items = (await readSent()).filter((x) => x.a !== activityId);
  items.push({ a: activityId, k: key, t: Date.now() });
  await AsyncStorage.setItem(SENT_KEY, JSON.stringify({ items })).catch(() => {});
}

// Bu an seçiminde (son 30 dk) bu aktiviteye bıraktığım tepki; yoksa null
export async function sentReactionKey(activityId: string): Promise<string | null> {
  return (await readSent()).find((x) => x.a === activityId)?.k ?? null;
}

export async function fetchMyReactions(): Promise<MyReactions | null> {
  try {
    if (!(await ensureSession())) return null;
    const { data, error } = await supabase.rpc('get_my_reactions');
    if (error || !data) return null;
    const d = data as any;
    return { got: items(d.got), answers: items(d.answers) };
  } catch {
    return null;
  }
}

export async function replyReaction(id: number, reply: string): Promise<boolean> {
  try {
    if (!(await ensureSession())) return false;
    const { data, error } = await supabase.rpc('reply_reaction', { p_id: id, p_reply: reply });
    if (error || !data) return false;
    const d = data as any;
    const ok = d.ok === true || d.error === 'already';
    if (ok) emit();
    return ok;
  } catch {
    return false;
  }
}

// Şeritte en son gösterilen: en yeni gelen tepkinin id'si ve gelen cevap sayısı.
// Yeni bir tepki ya da cevap gelince şerit yeniden açılır.
export type SeenMark = { got: number; ans: number };
export async function lastSeenReaction(): Promise<SeenMark> {
  try {
    const raw = await AsyncStorage.getItem(SEEN_KEY);
    const v = raw ? JSON.parse(raw) : null;
    if (v && v.day === istanbulToday()) return { got: Number(v.got) || 0, ans: Number(v.ans) || 0 };
  } catch {}
  return { got: 0, ans: 0 };
}

export async function markReactionsSeen(mark: SeenMark): Promise<void> {
  await AsyncStorage.setItem(SEEN_KEY, JSON.stringify({ day: istanbulToday(), ...mark })).catch(() => {});
}

export function notifyReactionsChanged(): void {
  emit();
}

// 1.6.0: tepki kutusunda sonuç. Bugün bu aktivitede bırakılan tepkilerin oranı (en az 5 gönderim yoksa rows null).
export type ReactionStats = { enough: boolean; rows: { key: string; pct: number }[] | null };
export async function fetchReactionStats(activityId: string): Promise<ReactionStats | null> {
  try {
    if (!(await ensureSession())) return null;
    const { data, error } = await supabase.rpc('get_reaction_stats', { p_activity: activityId });
    if (error || !data) return null;
    const d = data as any;
    const rows = Array.isArray(d.rows)
      ? d.rows.map((r: any) => ({ key: String(r?.key ?? ''), pct: Number(r?.pct) || 0 })).filter((r: { key: string }) => r.key)
      : null;
    return { enough: d.enough === true, rows };
  } catch {
    return null;
  }
}

// Bu aktivitede bugün sorduğum son soru ve gelen cevapların oranı (soru yoksa null)
export type AskStatus = { key: string; replies: { key: string; pct: number }[] };
export async function fetchAskStatus(activityId: string): Promise<AskStatus | null> {
  try {
    if (!(await ensureSession())) return null;
    const { data, error } = await supabase.rpc('get_ask_status', { p_activity: activityId });
    if (error || !data) return null;
    const d = data as any;
    return {
      key: String(d.key ?? ''),
      replies: Array.isArray(d.replies)
        ? d.replies.map((r: any) => ({ key: String(r?.key ?? ''), pct: Number(r?.pct) || 0 })).filter((r: { key: string }) => r.key)
        : [],
    };
  } catch {
    return null;
  }
}
