// 1.6.0: Mesaj kutusu. Bana gelen tepkiler, bana sorulan sorular, sorularıma gelen cevaplar, selam ve rozetler.
// Son 30 gün; günlere ve aktivitelere göre gruplu. Kişi sayısı ve gönderen kimliği sunucudan hiç gelmez.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ensureSession, supabase } from '@/lib/supabase';

export type InboxAsk = { key: string; reply: string | null; pending: boolean };
export type InboxMine = { key: string; replies: { key: string; pct: number }[] };
export type InboxCard = { activity: string; asks: InboxAsk[]; reacts: string[]; mine: InboxMine[] };
export type InboxDay = { day: string; selam: boolean; cards: InboxCard[] };
export type InboxPage = { days: InboxDay[]; more: boolean };
export type Totals = {
  firstDay: string | null;
  selamGot: number;
  selamSent: number;
  reactGot: number;
  answersGot: number;
};
export type InboxStamp = { got: number; ans: number };

const SEEN_KEY = 'inbox_seen_v1'; // { got, ans }: Mesaj kutusu en son açıldığında

type Listener = () => void;
const listeners = new Set<Listener>();
export function onInboxChanged(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export function notifyInboxChanged(): void {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {}
  });
}

const arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

function parseDay(d: any): InboxDay | null {
  const day = str(d?.day);
  if (!day) return null;
  const cards: InboxCard[] = arr(d.cards)
    .map((c: any) => ({
      activity: String(c?.activity ?? ''),
      asks: arr(c?.asks)
        .map((a: any) => ({ key: String(a?.key ?? ''), reply: str(a?.reply), pending: a?.pending === true }))
        .filter((a: InboxAsk) => a.key),
      reacts: arr(c?.reacts).map((k: any) => String(k)).filter(Boolean),
      mine: arr(c?.mine)
        .map((m: any) => ({
          key: String(m?.key ?? ''),
          replies: arr(m?.replies)
            .map((r: any) => ({ key: String(r?.key ?? ''), pct: Number(r?.pct) || 0 }))
            .filter((r: { key: string }) => r.key),
        }))
        .filter((m: InboxMine) => m.key),
    }))
    .filter((c: InboxCard) => c.activity && (c.asks.length || c.reacts.length || c.mine.length));
  return { day, selam: d.selam === true, cards };
}

export async function fetchInbox(before?: string): Promise<InboxPage | null> {
  try {
    if (!(await ensureSession())) return null;
    const { data, error } = await supabase.rpc('get_inbox', { p_before: before ?? null, p_days: 7 });
    if (error || !data) return null;
    const d = data as any;
    return { days: arr(d.days).map(parseDay).filter((x): x is InboxDay => !!x), more: d.more === true };
  } catch {
    return null;
  }
}

export async function fetchTotals(): Promise<Totals | null> {
  try {
    if (!(await ensureSession())) return null;
    const { data, error } = await supabase.rpc('get_my_totals');
    if (error || !data) return null;
    const d = data as any;
    return {
      firstDay: str(d.first_day),
      selamGot: Number(d.selam_got) || 0,
      selamSent: Number(d.selam_sent) || 0,
      reactGot: Number(d.react_got) || 0,
      answersGot: Number(d.answers_got) || 0,
    };
  } catch {
    return null;
  }
}

// Aynı soruya tek cevap: o gün o aktivitede bana sorulan aynı sorunun hepsine gider
export async function replyGroup(day: string, activity: string, key: string, reply: string): Promise<boolean> {
  try {
    if (!(await ensureSession())) return false;
    const { data, error } = await supabase.rpc('reply_reaction_group', {
      p_day: day,
      p_activity: activity,
      p_key: key,
      p_reply: reply,
    });
    if (error || !data) return false;
    return (data as any).ok === true;
  } catch {
    return false;
  }
}

export async function fetchStamp(): Promise<InboxStamp | null> {
  try {
    if (!(await ensureSession())) return null;
    const { data, error } = await supabase.rpc('get_inbox_stamp');
    if (error || !data) return null;
    const d = data as any;
    return { got: Number(d.got) || 0, ans: Number(d.ans) || 0 };
  } catch {
    return null;
  }
}

async function readSeen(): Promise<InboxStamp> {
  try {
    const raw = await AsyncStorage.getItem(SEEN_KEY);
    const v = raw ? JSON.parse(raw) : null;
    if (v) return { got: Number(v.got) || 0, ans: Number(v.ans) || 0 };
  } catch {}
  return { got: 0, ans: 0 };
}

// Alt menüdeki kırmızı nokta: son açılıştan beri yeni tepki ya da sorularıma yeni cevap geldi mi
export async function inboxUnread(): Promise<boolean> {
  const [now, seen] = await Promise.all([fetchStamp(), readSeen()]);
  if (!now) return false;
  return now.got > seen.got || now.ans > seen.ans;
}

export async function markInboxSeen(): Promise<void> {
  const now = await fetchStamp();
  if (!now) return;
  await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(now)).catch(() => {});
  notifyInboxChanged();
}
