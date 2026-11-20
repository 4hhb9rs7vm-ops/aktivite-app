// 1.5.8: Alt sorular ve "senin gibiler" kartları.
// Ana seçim ve ana oran değişmez; sonuç ekranında isteğe bağlı tek dokunuşluk ikinci bir soru sorulur.
// Dağılım o aktiviteyi seçip cevaplayanların kendi içinde, günün toplamından hesaplanır (sunucu: get_sub_stats).
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ensureSession, supabase } from '@/lib/supabase';
import { isSensitiveActivity } from '@/lib/catalog';

export type SubOption = { key: string; tr: string; en: string };
export type SubQuestion = {
  q: { tr: string; en: string };
  // Dağılım başlığı: "Bugün işte olanlar"
  group: { tr: string; en: string };
  options: SubOption[];
};

export const SUBS: Record<string, SubQuestion> = {
  scrolling: {
    q: { tr: 'Neredesin?', en: 'Where are you?' },
    group: { tr: 'Bugün telefonda gezinenler', en: 'People scrolling today' },
    options: [
      { key: 'instagram', tr: 'Instagram', en: 'Instagram' },
      { key: 'tiktok', tr: 'TikTok', en: 'TikTok' },
      { key: 'youtube', tr: 'YouTube', en: 'YouTube' },
      { key: 'x', tr: 'X', en: 'X' },
      { key: 'whatsapp', tr: 'WhatsApp', en: 'WhatsApp' },
      { key: 'other', tr: 'Diğer', en: 'Other' },
    ],
  },
  gaming: {
    q: { tr: 'Nerede oynuyorsun?', en: 'Where are you playing?' },
    group: { tr: 'Bugün oyun oynayanlar', en: 'People gaming today' },
    options: [
      { key: 'phone', tr: 'Telefon', en: 'Phone' },
      { key: 'pc', tr: 'Bilgisayar', en: 'PC' },
      { key: 'playstation', tr: 'PlayStation', en: 'PlayStation' },
      { key: 'xbox', tr: 'Xbox', en: 'Xbox' },
      { key: 'other', tr: 'Diğer', en: 'Other' },
    ],
  },
  study: {
    q: { tr: 'Ne için çalışıyorsun?', en: 'What are you studying for?' },
    group: { tr: 'Bugün ders çalışanlar', en: 'People studying today' },
    options: [
      { key: 'exam', tr: 'Sınav', en: 'Exam' },
      { key: 'homework', tr: 'Ödev', en: 'Homework' },
      { key: 'review', tr: 'Tekrar', en: 'Review' },
      { key: 'project', tr: 'Proje', en: 'Project' },
    ],
  },
  work: {
    q: { tr: 'İşte şu an ne yapıyorsun?', en: 'What are you doing at work?' },
    group: { tr: 'Bugün işte olanlar', en: 'People at work today' },
    options: [
      { key: 'meeting', tr: 'Toplantıdayım', en: 'In a meeting' },
      { key: 'desk', tr: 'Bilgisayar başındayım', en: 'At my desk' },
      { key: 'field', tr: 'Müşteriyle / sahadayım', en: 'With a customer / in the field' },
      { key: 'overtime', tr: 'Mesaideyim', en: 'Working late' },
      { key: 'pretend', tr: 'Çalışıyormuş gibi yapıyorum 😄', en: 'Pretending to work 😄' },
    ],
  },
};

// 1.6.0: alt sorular sunucu katalogundan gelir; katalog varsa listenin tamamı onunla değişir
// (sunucuda kapatılan alt soru uygulamada da kalkar).
export function applySubs(
  subs: { activity: string; q_tr: string; q_en: string; group_tr: string; group_en: string; options: SubOption[] }[]
): void {
  for (const k of Object.keys(SUBS)) delete SUBS[k];
  for (const s of subs) {
    SUBS[s.activity] = {
      q: { tr: s.q_tr, en: s.q_en },
      group: { tr: s.group_tr, en: s.group_en },
      options: s.options,
    };
  }
}

export function subLabel(activityId: string, key: string, lang: string): string {
  const o = SUBS[activityId]?.options.find((x) => x.key === key);
  return o ? (lang === 'tr' ? o.tr : o.en) : key;
}

export type SubStats = { total: number; mine: string | null; rows: { key: string; cnt: number; pct: number }[] | null };

function parseStats(d: any): SubStats | null {
  if (!d || typeof d !== 'object' || d.error) return null;
  return {
    total: Number(d.total) || 0,
    mine: typeof d.mine === 'string' ? d.mine : null,
    rows: Array.isArray(d.rows)
      ? d.rows.map((r: any) => ({ key: String(r.key), cnt: Number(r.cnt) || 0, pct: Number(r.pct) || 0 }))
      : null,
  };
}

export async function fetchSubStats(activityId: string): Promise<SubStats | null> {
  try {
    if (!(await ensureSession())) return null;
    const { data, error } = await supabase.rpc('get_sub_stats', { p_activity: activityId });
    if (error) return null;
    return parseStats(data);
  } catch {
    return null;
  }
}

export async function answerSub(activityId: string, key: string): Promise<SubStats | null> {
  try {
    if (!(await ensureSession())) return null;
    const { data, error } = await supabase.rpc('set_sub_answer', { p_activity: activityId, p_key: key });
    if (error) return null;
    return parseStats(data);
  } catch {
    return null;
  }
}

// Yaş grubunun bugünkü dağılımı. scope 'all': grupta yeterli kişi yok, herkesin dağılımı döndü.
export type AgeToday = { scope: 'age' | 'all'; people: number; rows: { activity: string; pct: number }[] | null };
export async function fetchAgeToday(age: string): Promise<AgeToday | null> {
  try {
    if (!(await ensureSession())) return null;
    const { data, error } = await supabase.rpc('get_age_today', { p_age: age });
    if (error || !data) return null;
    const d = data as any;
    return {
      scope: d.scope === 'age' ? 'age' : 'all',
      people: Number(d.people) || 0,
      // 1.6.0: hassas anlar (İbadet) yaş özetinde gösterilmez
      rows: Array.isArray(d.rows)
        ? d.rows
            .map((r: any) => ({ activity: String(r.activity), pct: Number(r.pct) || 0 }))
            .filter((r: { activity: string }) => !isSensitiveActivity(r.activity))
        : null,
    };
  } catch {
    return null;
  }
}

// Yaş ve durum kartları: çarpıyla kapatılırsa 7 gün sonra tekrar, en fazla 3 kez.
const CARD_KEY = 'profile_card_v1';
const CARD_GAP_MS = 7 * 24 * 60 * 60 * 1000;
const CARD_MAX = 3;
type CardState = Record<string, { n: number; last: number }>;
async function readCards(): Promise<CardState> {
  try {
    const raw = await AsyncStorage.getItem(CARD_KEY);
    const v = raw ? JSON.parse(raw) : null;
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}
export async function cardAllowed(id: 'age' | 'segment'): Promise<boolean> {
  const s = (await readCards())[id];
  if (!s) return true;
  if (s.n >= CARD_MAX) return false;
  return Date.now() - s.last >= CARD_GAP_MS;
}
export async function dismissCard(id: 'age' | 'segment'): Promise<void> {
  const all = await readCards();
  const s = all[id] ?? { n: 0, last: 0 };
  all[id] = { n: s.n + 1, last: Date.now() };
  await AsyncStorage.setItem(CARD_KEY, JSON.stringify(all)).catch(() => {});
}
