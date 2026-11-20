// 1.6.0: Aktivite listesi, gruplar, alt sorular ve hazır tepkiler sunucudan gelir (get_catalog).
// Yeni aktivite, alt soru ya da tepki eklemek için build gerekmez; SQL ile cat_* tablolarına satır eklenir.
// Uygulama son katalogu telefonda saklar; sunucuya ulaşamazsa saklanan, o da yoksa uygulamadaki gömülü liste kullanılır.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';

export type Palette = 'indigo' | 'teal' | 'amber' | 'rose';
export type CatGroup = { id: string; tr: string; en: string };
export type CatActivity = {
  id: string;
  group: string | null;
  tr: string;
  en: string;
  emoji: string | null;
  palette: Palette;
  sort: number;
  mood: boolean;
  sensitive: boolean;
  world: number;
  peaks: { hour: number; spread: number }[];
  isNew: boolean;
};
export type CatOption = { key: string; tr: string; en: string };
export type CatSub = { activity: string; q_tr: string; q_en: string; group_tr: string; group_en: string; options: CatOption[] };
export type CatReaction = {
  scope: string; // aktivite id, 'mood' ya da '*'
  key: string;
  emoji: string;
  tr: string;
  en: string;
  kind: 'react' | 'ask';
  replies: CatOption[] | null;
};
export type CatSettings = {
  reactionFirst: boolean; // kaydırılabilir kartta önce tepki mi (yoksa önce alt soru)
  latestVersion: number; // mağazadaki son sürüm (1.6.0 = 10600)
  minVersion: number; // bunun altındakilere ısrarlı uyarı (0: kapalı)
};
export type Catalog = { groups: CatGroup[]; activities: CatActivity[]; subs: CatSub[]; reactions: CatReaction[]; settings: CatSettings };

const KEY = 'catalog_v1';
const ID_RE = /^[a-z_]{2,24}$/;
const KEY_RE = /^[a-z0-9_]{1,24}$/;
const PALETTES: Palette[] = ['indigo', 'teal', 'amber', 'rose'];

let current: Catalog | null = null;

const str = (v: unknown, max = 80): string | null => (typeof v === 'string' && v.trim() && v.length <= max ? v : null);

function options(v: unknown): CatOption[] | null {
  if (!Array.isArray(v)) return null;
  const out: CatOption[] = [];
  for (const o of v) {
    const key = str(o?.key, 24);
    const tr = str(o?.tr);
    const en = str(o?.en);
    if (key && KEY_RE.test(key) && tr && en) out.push({ key, tr, en });
  }
  return out.length ? out : null;
}

// Sunucudan ya da telefondan gelen veriyi doğrula; bozuk satırları at. Kullanılamazsa null.
export function sanitizeCatalog(d: any): Catalog | null {
  if (!d || typeof d !== 'object') return null;
  const groups: CatGroup[] = [];
  for (const g of Array.isArray(d.groups) ? d.groups : []) {
    const id = str(g?.id, 24);
    const tr = str(g?.tr);
    const en = str(g?.en);
    if (id && ID_RE.test(id) && tr && en) groups.push({ id, tr, en });
  }
  const groupIds = new Set(groups.map((g) => g.id));
  const activities: CatActivity[] = [];
  for (const a of Array.isArray(d.activities) ? d.activities : []) {
    const id = str(a?.id, 24);
    const tr = str(a?.tr);
    const en = str(a?.en);
    if (!id || !ID_RE.test(id) || !tr || !en) continue;
    const peaks = Array.isArray(a.peaks)
      ? a.peaks
          .map((p: any) => ({ hour: Number(p?.hour), spread: Number(p?.spread) }))
          .filter((p: { hour: number; spread: number }) => Number.isFinite(p.hour) && Number.isFinite(p.spread) && p.spread > 0)
      : [];
    const group = str(a.group, 24);
    activities.push({
      id,
      group: group && groupIds.has(group) ? group : null,
      tr,
      en,
      emoji: str(a.emoji, 16),
      palette: PALETTES.includes(a.palette) ? a.palette : 'indigo',
      sort: Number(a.sort) || 0,
      mood: a.mood === true,
      sensitive: a.sensitive === true,
      world: Number(a.world) > 0 ? Number(a.world) : 3,
      peaks: peaks.length ? peaks : [{ hour: 12, spread: 6 }],
      isNew: a.is_new === true,
    });
  }
  const subs: CatSub[] = [];
  for (const s of Array.isArray(d.subs) ? d.subs : []) {
    const activity = str(s?.activity, 24);
    const opts = options(s?.options);
    const q_tr = str(s?.q_tr);
    const q_en = str(s?.q_en);
    const group_tr = str(s?.group_tr);
    const group_en = str(s?.group_en);
    if (activity && opts && q_tr && q_en && group_tr && group_en) subs.push({ activity, q_tr, q_en, group_tr, group_en, options: opts });
  }
  const reactions: CatReaction[] = [];
  for (const r of Array.isArray(d.reactions) ? d.reactions : []) {
    const scope = str(r?.scope, 24);
    const key = str(r?.key, 24);
    const emoji = str(r?.emoji, 16);
    const tr = str(r?.tr);
    const en = str(r?.en);
    if (!scope || !key || !KEY_RE.test(key) || !emoji || !tr || !en) continue;
    reactions.push({ scope, key, emoji, tr, en, kind: r.kind === 'ask' ? 'ask' : 'react', replies: options(r.replies) });
  }
  // Güvenlik: liste bariz eksikse (yanlış bir SQL sonrası) uygulamanın gömülü listesiyle devam et
  if (activities.filter((a) => !a.mood && a.group).length < 5 || groups.length < 1) return null;
  const st = d.settings && typeof d.settings === 'object' ? d.settings : {};
  const settings: CatSettings = {
    reactionFirst: st.slot_reaction_first === undefined ? true : Number(st.slot_reaction_first) !== 0,
    latestVersion: Number(st.latest_version) || 0,
    minVersion: Number(st.min_version) || 0,
  };
  return { groups, activities, subs, reactions, settings };
}

// '1.5.9' -> 10509 (sunucudaki app_version_code ile aynı)
export function versionCode(v: string | null | undefined): number {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v ?? '');
  return m ? Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3]) : 0;
}

export function getCatalog(): Catalog | null {
  return current;
}

export async function loadCachedCatalog(): Promise<Catalog | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const c = raw ? sanitizeCatalog(JSON.parse(raw)) : null;
    if (c) current = c;
    return c;
  } catch {
    return null;
  }
}

// Sunucudan taze katalog. Değişmediyse null döner (gereksiz yeniden çizim olmasın).
export async function refreshCatalog(): Promise<Catalog | null> {
  try {
    const { data, error } = await supabase.rpc('get_catalog');
    if (error || !data) return null;
    const c = sanitizeCatalog(data);
    if (!c) return null;
    const raw = JSON.stringify(data);
    const old = await AsyncStorage.getItem(KEY).catch(() => null);
    current = c;
    if (old === raw) return null;
    await AsyncStorage.setItem(KEY, raw).catch(() => {});
    return c;
  } catch {
    return null;
  }
}

export function isSensitiveActivity(id: string): boolean {
  return !!current?.activities.find((a) => a.id === id)?.sensitive;
}

// Bir aktivitenin tepkileri (sunucudaki reaction_scope ile aynı kural)
export function reactionsFor(activityId: string): CatReaction[] {
  if (!current) return [];
  const a = current.activities.find((x) => x.id === activityId);
  if (!a || a.sensitive) return [];
  const own = current.reactions.filter((r) => r.scope === activityId);
  if (own.length) return own;
  return current.reactions.filter((r) => r.scope === (a.mood ? 'mood' : '*'));
}

export function findReaction(activityId: string, key: string): CatReaction | null {
  return reactionsFor(activityId).find((r) => r.key === key) ?? null;
}
