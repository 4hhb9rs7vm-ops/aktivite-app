// Arkadaşlar: sunucu fonksiyonları ve telefondaki küçük kayıtlar.
// Sunucuda sadece görünen ad, arkadaşlık kayıtları ve 2 dakikalık QR kodları tutulur.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ensureSession, supabase } from '@/lib/supabase';

export const FRIEND_LIMIT = 50;
export const PAIR_CODE_SECONDS = 120;
const QR_PREFIX = 'suan:pair:';

// Telefonda: arkadaşlar özelliği kuruldu mu (ad + kural onayı), sessize alınanlar
export const FRIENDS_SETUP_KEY = 'friends_setup_v1';
export const FRIEND_MUTES_KEY = 'friend_mutes_v1';

export type Friend = {
  id: string;
  name: string;
  activityId: string | null; // şu anki anı (yoksa null)
  moodHidden: boolean; // ruh hali seçmiş ama paylaşmıyor
  startedAt: string | null;
};

export type PairError = 'expired' | 'self' | 'already' | 'limit_me' | 'limit_them' | 'no_profile' | 'invalid' | 'network';
export type ReportReason = 'name' | 'harassment' | 'other';

// ---- Telefondaki kayıtlar ----
export async function isFriendsSetup(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(FRIENDS_SETUP_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function loadMutes(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(FRIEND_MUTES_KEY);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export async function saveMutes(ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(FRIEND_MUTES_KEY, JSON.stringify(ids));
  } catch {}
}

// ---- QR içeriği ----
export function qrValue(code: string): string {
  return QR_PREFIX + code;
}

export function parseQr(data: string): string | null {
  if (!data || !data.startsWith(QR_PREFIX)) return null;
  const code = data.slice(QR_PREFIX.length).trim();
  return /^[a-f0-9]{32}$/.test(code) ? code : null;
}

// ---- Sunucu çağrıları ----
async function rpc<T = any>(fn: string, args?: Record<string, unknown>): Promise<T> {
  if (!(await ensureSession())) throw new Error('network');
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
}

// İlk açılış (ad + kural onayı) ya da ad değişikliği
export async function setupFriends(name: string, moodShare: boolean): Promise<void> {
  await rpc('upsert_friend_profile', { p_name: name });
  await rpc('set_friend_settings', { p_mood_share: moodShare, p_invisible: false });
  await AsyncStorage.setItem(FRIENDS_SETUP_KEY, '1');
}

export async function updateFriendName(name: string): Promise<void> {
  await rpc('upsert_friend_profile', { p_name: name });
}

export async function updateMoodShare(moodShare: boolean): Promise<void> {
  await rpc('set_friend_settings', { p_mood_share: moodShare, p_invisible: false });
}

export async function createPairCode(): Promise<{ code: string } | { error: PairError }> {
  try {
    const r = await rpc<{ code?: string; error?: PairError }>('create_pair_code');
    return r.code ? { code: r.code } : { error: r.error ?? 'network' };
  } catch {
    return { error: 'network' };
  }
}

export async function peekPairCode(code: string): Promise<{ name: string } | { error: PairError }> {
  try {
    const r = await rpc<{ ok?: boolean; name?: string; error?: PairError }>('peek_pair_code', { p_code: code });
    return r.ok ? { name: r.name ?? '' } : { error: r.error ?? 'network' };
  } catch {
    return { error: 'network' };
  }
}

export async function redeemPairCode(code: string): Promise<{ name: string } | { error: PairError }> {
  try {
    const r = await rpc<{ ok?: boolean; name?: string; error?: PairError }>('redeem_pair_code', { p_code: code });
    return r.ok ? { name: r.name ?? '' } : { error: r.error ?? 'network' };
  } catch {
    return { error: 'network' };
  }
}

// "Kodum" ekranı: kod kullanıldı mı, kim ekledi?
export async function pairCodeStatus(code: string): Promise<{ used: boolean; name?: string }> {
  try {
    const r = await rpc<{ used: boolean; name?: string }>('pair_code_status', { p_code: code });
    return r ?? { used: false };
  } catch {
    return { used: false };
  }
}

export async function getFriends(): Promise<Friend[]> {
  const rows = await rpc<any[]>('get_friends');
  return (rows ?? []).map((r) => ({
    id: r.friend_id,
    name: r.display_name,
    activityId: r.activity_id ?? null,
    moodHidden: !!r.mood_hidden,
    startedAt: r.started_at ?? null,
  }));
}

export async function removeFriend(id: string): Promise<void> {
  await rpc('remove_friend', { p_friend: id });
}

export async function reportFriend(id: string, reason: ReportReason): Promise<void> {
  await rpc('report_friend', { p_friend: id, p_reason: reason });
}

// Sıfırlamada "Arkadaşlarımı da sil": herkesin listesinden çıkar
export async function deleteFriendData(): Promise<void> {
  await rpc('delete_friend_data');
  await AsyncStorage.multiRemove([FRIENDS_SETUP_KEY, FRIEND_MUTES_KEY]);
}

// Avatar renkleri: aynı ad hep aynı renk
const AVATAR_COLORS: [string, string][] = [
  ['#E6ECFF', '#3F3BC9'],
  ['#FFF1E3', '#B4570F'],
  ['#E3F5EC', '#146C43'],
  ['#FCE8EF', '#B0275A'],
  ['#E6F4F7', '#11697A'],
  ['#F1EAFE', '#6A3FC4'],
];
export function avatarColors(name: string): [string, string] {
  let h = 0;
  for (const ch of name) h = (h * 31 + (ch.codePointAt(0) ?? 0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
