// Davet: uzaktaki arkadaşı link ya da 4 haneli kodla (ör. K472) eklemek.
// Kurallar sunucuda: kod 24 saat geçerli, en fazla 10 kişi, günde en fazla 5 davet,
// saatte 10 yanlış deneme sınırı. Kodu kullanan kişi doğrudan arkadaş olmaz:
// davet edene İSTEK düşer, o onaylarsa arkadaş olurlar.
import { Linking, Share } from 'react-native';

import { ensureSession, supabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { requestNotificationPermission } from '@/lib/notifications';
import { registerPushToken } from '@/lib/ask';

// Davet sayfası (web). Alan adı gelince sadece bu satır değişir.
export const INVITE_PAGE = 'https://4hhb9rs7vm-ops.github.io/aktivite-app/d/';

export type Invite = { id: string; code: string; expiresAt: number; uses: number; maxUses: number };
export type InviteRequest = { id: string; name: string; createdAt: number };
// Benim gönderdiğim, onay bekleyen istek
export type SentRequest = { id: string; name: string; createdAt: number };

export type CreateInviteResult =
  | { ok: true; invite: Invite }
  | { ok: false; error: 'no_profile' | 'limit_me' | 'daily_limit' | 'busy' | 'network' };

export type RequestInviteResult =
  | { ok: true; name: string }
  | {
      ok: false;
      error: 'no_profile' | 'too_many' | 'not_found' | 'full' | 'self' | 'already' | 'pending' | 'limit_me' | 'network';
    };

export type DecideResult =
  | { ok: true; name?: string }
  | { ok: false; error: 'not_found' | 'limit_me' | 'limit_them' | 'network' };

// Kod: 1 harf + 3 rakam. Kullanıcının yazdığını temizle (küçük harf, boşluk, tire).
export function cleanCode(raw: string): string {
  return (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
}
export function isValidCode(code: string): boolean {
  return /^[A-Z][0-9]{3}$/.test(code);
}

export function inviteUrl(code: string, name?: string): string {
  const n = name ? `&n=${encodeURIComponent(name.slice(0, 24))}` : '';
  return `${INVITE_PAGE}?c=${code}${n}`;
}

export function inviteMessage(code: string, name: string | undefined, lang: 'tr' | 'en' | string): string {
  const url = inviteUrl(code, name);
  return lang === 'tr'
    ? `Şu An'da arkadaşım ol 👀 Ne yaptığımı gör, sen de bana sor.\nDavet kodum: ${code}\n${url}`
    : `Be my friend on Şu An 👀 See what I'm up to, and ask me too.\nMy invite code: ${code}\n${url}`;
}

// ---- Sunucu çağrıları ----
export async function createInvite(): Promise<CreateInviteResult> {
  try {
    if (!(await ensureSession())) return { ok: false, error: 'network' };
    const { data, error } = await supabase.rpc('create_invite');
    if (error || !data) return { ok: false, error: 'network' };
    if (data.error) return { ok: false, error: data.error };
    const invite: Invite = {
      id: data.id,
      code: data.code,
      expiresAt: new Date(data.expires_at).getTime(),
      uses: 0,
      maxUses: 10,
    };
    track('invite_created', {});
    return { ok: true, invite };
  } catch {
    return { ok: false, error: 'network' };
  }
}

export async function getMyInvites(): Promise<Invite[]> {
  try {
    if (!(await ensureSession())) return [];
    const { data, error } = await supabase.rpc('get_my_invites');
    if (error || !Array.isArray(data)) return [];
    return data.map((r: any) => ({
      id: r.id,
      code: r.code,
      expiresAt: new Date(r.expires_at).getTime(),
      uses: r.uses ?? 0,
      maxUses: r.max_uses ?? 10,
    }));
  } catch {
    return [];
  }
}

export async function revokeInvite(id: string): Promise<boolean> {
  try {
    if (!(await ensureSession())) return false;
    const { error } = await supabase.rpc('revoke_invite', { p_id: id });
    return !error;
  } catch {
    return false;
  }
}

// Kodu kullan: davet edene istek gider ve ona bildirim gönderilir.
export async function requestInvite(rawCode: string): Promise<RequestInviteResult> {
  const code = cleanCode(rawCode);
  if (!isValidCode(code)) return { ok: false, error: 'not_found' };
  try {
    if (!(await ensureSession())) return { ok: false, error: 'network' };
    const { data, error } = await supabase.rpc('request_invite', { p_code: code });
    if (error || !data) return { ok: false, error: 'network' };
    if (data.error) {
      track('invite_request', { result: data.error });
      return { ok: false, error: data.error };
    }
    track('invite_request', { result: 'ok' });
    if (data.request_id) {
      supabase.functions
        .invoke('sor', { body: { action: 'invite_joined', requestId: data.request_id } })
        .catch(() => {});
    }
    return { ok: true, name: data.name || '' };
  } catch {
    return { ok: false, error: 'network' };
  }
}

export async function getInviteRequests(): Promise<InviteRequest[]> {
  try {
    if (!(await ensureSession())) return [];
    const { data, error } = await supabase.rpc('get_invite_requests');
    if (error || !Array.isArray(data)) return [];
    return data.map((r: any) => ({ id: r.id, name: r.name || '', createdAt: new Date(r.created_at).getTime() }));
  } catch {
    return [];
  }
}

// Onayla / reddet. Onaylanınca katılana bildirim gider. Reddedilince bildirim gitmez.
export async function decideInviteRequest(id: string, accept: boolean): Promise<DecideResult> {
  try {
    if (!(await ensureSession())) return { ok: false, error: 'network' };
    const { data, error } = await supabase.rpc('decide_invite_request', { p_id: id, p_accept: accept });
    if (error || !data) return { ok: false, error: 'network' };
    if (data.error) return { ok: false, error: data.error };
    track('invite_decided', { accept });
    if (accept) {
      supabase.functions.invoke('sor', { body: { action: 'invite_accepted', requestId: id } }).catch(() => {});
    }
    return { ok: true, name: data.name };
  } catch {
    return { ok: false, error: 'network' };
  }
}

// ---- Paylaşma ----
// WhatsApp yüklüyse doğrudan WhatsApp açılır, değilse telefonun paylaşma ekranı.
export async function shareInviteWhatsApp(message: string): Promise<void> {
  track('invite_shared', { via: 'whatsapp' });
  try {
    await Linking.openURL(`whatsapp://send?text=${encodeURIComponent(message)}`);
  } catch {
    await Share.share({ message }).catch(() => {});
  }
}

export async function shareInviteOther(message: string): Promise<void> {
  track('invite_shared', { via: 'share' });
  await Share.share({ message }).catch(() => {});
}

// ---- Linkten gelen kod ----
// aktiviteapp://davet?c=K472 açılınca kod burada bekler; Arkadaşlar sekmesi açılınca alır.
let pendingCode: string | null = null;
const codeListeners = new Set<(code: string) => void>();

export function setPendingInviteCode(raw: string): void {
  const code = cleanCode(raw);
  if (!isValidCode(code)) return;
  track('invite_link_open', {});
  if (codeListeners.size) codeListeners.forEach((f) => f(code));
  else pendingCode = code;
}

export function onInviteCode(cb: (code: string) => void): () => void {
  codeListeners.add(cb);
  if (pendingCode) {
    const c = pendingCode;
    pendingCode = null;
    cb(c);
  }
  return () => {
    codeListeners.delete(cb);
  };
}

// ---- Gönderdiğim istekler (onay bekleyenler) ----
export async function getSentRequests(): Promise<SentRequest[]> {
  try {
    if (!(await ensureSession())) return [];
    const { data, error } = await supabase.rpc('get_my_sent_requests');
    if (error || !Array.isArray(data)) return [];
    return data.map((r: any) => ({ id: r.id, name: r.name || '', createdAt: new Date(r.created_at).getTime() }));
  } catch {
    return [];
  }
}

export async function cancelSentRequest(id: string): Promise<boolean> {
  try {
    if (!(await ensureSession())) return false;
    const { data, error } = await supabase.rpc('cancel_invite_request', { p_id: id });
    return !error && data === true;
  } catch {
    return false;
  }
}

// ---- Davet bildirimleri ----
// Davet oluşturan "katıldı", istek gönderen "kabul etti" bildirimini alsın diye izni ister ve cihazı kaydeder.
// Yeni kurulan telefonda izin verilmediyse cihaz kayıtlı olmuyor, bildirim gitmiyordu.
export async function enableInviteNotifications(): Promise<void> {
  try {
    if (await requestNotificationPermission()) await registerPushToken(true);
  } catch {}
}

// ---- Davet listeleri değişti (davet ekranında istek gönderilince Arkadaşlar sekmesi yenilensin) ----
const changeListeners = new Set<() => void>();
export function notifyInvitesChanged(): void {
  changeListeners.forEach((f) => {
    try {
      f();
    } catch {}
  });
}
export function onInvitesChanged(cb: () => void): () => void {
  changeListeners.add(cb);
  return () => {
    changeListeners.delete(cb);
  };
}
