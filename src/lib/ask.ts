// "Sor": arkadaşına "Şu an ne yapıyorsun?" bildirimi gönder.
// Bildirimi sunucudaki "sor" fonksiyonu gönderir (Supabase Edge Function).
// Kurallar sunucuda: sadece arkadaşlar, aynı kişiye 4 saatte bir, bir kişiye günde en fazla 3 soru,
// karşı tarafın gece saatinde (23:00-09:00) soru gitmez, kişi soru almayı kapatabilir.
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ensureSession, supabase } from '@/lib/supabase';
import { getNotifications, hasNotificationPermission, requestNotificationPermission } from '@/lib/notifications';
import { loadLang } from '@/lib/i18n';
import { isFriendsSetup } from '@/lib/friends';
import { track } from '@/lib/analytics';
import { checkBadges } from '@/lib/badges';

export const ASK_COOLDOWN_MS = 4 * 60 * 60 * 1000;
export const ASK_CHANNEL_ID = 'sor';

export type AskResult = 'ok' | 'cooldown' | 'limit' | 'off' | 'quiet' | 'no_device' | 'not_friend' | 'network';

const SENT_KEY = 'ask_sent_v1'; // { arkadaşId: gönderim zamanı (ms) }
const TOKEN_KEY = 'push_token_v1'; // son kaydedilen adres + saat dilimi + dil
const ALLOW_KEY = 'allow_asks_v1';

// ---- Bildirim adresini sunucuya kaydet ----
// İzin verilmemişse hiçbir şey yapmaz (izin istemez). Aynı bilgiler 3 gün içinde kaydedildiyse tekrar göndermez.
export async function registerPushToken(force = false): Promise<void> {
  try {
    const N = getNotifications();
    if (!N) return;
    if (!(await hasNotificationPermission())) return;
    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync(ASK_CHANNEL_ID, {
        name: 'Sor',
        importance: N.AndroidImportance.HIGH,
        sound: 'default',
      }).catch(() => {});
    }
    const projectId =
      (Constants.expoConfig?.extra as any)?.eas?.projectId ?? (Constants as any).easConfig?.projectId;
    if (!projectId) return;
    const token = (await N.getExpoPushTokenAsync({ projectId })).data;
    if (!token) return;
    const lang = (await loadLang()) ?? 'tr';
    const tz = -new Date().getTimezoneOffset();
    const sig = `${token}|${tz}|${lang}`;
    const prev = await AsyncStorage.getItem(TOKEN_KEY).catch(() => null);
    if (!force && prev) {
      const [p, at] = prev.split('#');
      if (p === sig && Date.now() - Number(at) < 3 * 24 * 3600 * 1000) return;
    }
    if (!(await ensureSession())) return;
    const { error } = await supabase.rpc('save_push_token', {
      p_token: token,
      p_platform: Platform.OS,
      p_tz: tz,
      p_lang: lang,
    });
    if (!error) await AsyncStorage.setItem(TOKEN_KEY, `${sig}#${Date.now()}`).catch(() => {});
  } catch {}
}

// ---- Gönderilenler (telefonda, düğmede "Soruldu" göstermek için) ----
async function loadSent(): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(SENT_KEY);
    const v = raw ? JSON.parse(raw) : {};
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

export async function recentAsks(): Promise<Record<string, number>> {
  const all = await loadSent();
  const now = Date.now();
  const fresh: Record<string, number> = {};
  for (const [id, at] of Object.entries(all)) if (now - at < ASK_COOLDOWN_MS) fresh[id] = at;
  return fresh;
}

async function markSent(friendId: string): Promise<void> {
  const fresh = await recentAsks();
  fresh[friendId] = Date.now();
  await AsyncStorage.setItem(SENT_KEY, JSON.stringify(fresh)).catch(() => {});
}

// ---- Sor ----
export async function sendAsk(friendId: string): Promise<AskResult> {
  try {
    // Soran kişi de cevabı bildirimle alsın: ilk soruda izin iste, adresi kaydet
    if (await requestNotificationPermission()) await registerPushToken();
    if (!(await ensureSession())) return 'network';
    const { data, error } = await supabase.functions.invoke('sor', { body: { action: 'ask', friendId } });
    if (error) return 'network';
    const r = (data?.result ?? 'network') as AskResult;
    if (r === 'ok' || r === 'cooldown') await markSent(friendId);
    if (r === 'ok') {
      // "Meraklı" rozeti için toplam soru sayısı
      try {
        const n = (Number(await AsyncStorage.getItem('ask_total_v1')) || 0) + 1;
        await AsyncStorage.setItem('ask_total_v1', String(n));
      } catch {}
      setTimeout(() => checkBadges().catch(() => {}), 900);
    }
    track('ask_sent', { result: r });
    return r;
  } catch {
    return 'network';
  }
}

// ---- Cevap: soru almış biri aktivite seçince soranlara "cevap verdi" bildirimi gider ----
// Sadece son 3 saatte sorulmuş ve cevaplanmamış sorular için çalışır (sunucuda kontrol edilir).
let lastAnswerCall = 0;
export async function answerAsks(): Promise<void> {
  try {
    if (Date.now() - lastAnswerCall < 60 * 1000) return;
    lastAnswerCall = Date.now();
    if (!(await isFriendsSetup())) return;
    if (!(await ensureSession())) return;
    await supabase.functions.invoke('sor', { body: { action: 'answer' } });
  } catch {}
}

// ---- Soru alma ayarı ----
export async function getAllowAsks(): Promise<boolean> {
  try {
    const cached = await AsyncStorage.getItem(ALLOW_KEY);
    if (cached === '0') return false;
    if (cached === '1') return true;
    if (!(await ensureSession())) return true;
    const { data, error } = await supabase.rpc('get_allow_asks');
    const on = error ? true : data !== false;
    await AsyncStorage.setItem(ALLOW_KEY, on ? '1' : '0').catch(() => {});
    return on;
  } catch {
    return true;
  }
}

export async function setAllowAsks(on: boolean): Promise<boolean> {
  try {
    if (!(await ensureSession())) return false;
    const { error } = await supabase.rpc('set_allow_asks', { p_on: on });
    if (error) return false;
    await AsyncStorage.setItem(ALLOW_KEY, on ? '1' : '0').catch(() => {});
    track('ask_setting', { on });
    return true;
  } catch {
    return false;
  }
}

// ---- Bildirime dokununca doğru sekmeyi aç ----
// "Sor" bildirimi → Şu An sekmesi (aktivite seç), "cevap verdi" bildirimi → Arkadaşlar sekmesi.
// 1.5.1: davet bildirimleri ("davetine katıldı", "isteğini onayladı") → Arkadaşlar sekmesi.
export type AskTab = 'now' | 'friends';
let pendingTab: AskTab | null = null;
const tabListeners = new Set<(t: AskTab) => void>();

export function openTabFromNotification(t: AskTab): void {
  if (tabListeners.size) tabListeners.forEach((f) => f(t));
  else pendingTab = t; // ana ekran henüz açılmadıysa (soğuk açılış) sonra uygulanır
}

export function onOpenTab(cb: (t: AskTab) => void): () => void {
  tabListeners.add(cb);
  if (pendingTab) {
    const p = pendingTab;
    pendingTab = null;
    cb(p);
  }
  return () => {
    tabListeners.delete(cb);
  };
}

// Bildirim verisinden sekme (tanımadığı türlerde null)
export function tabForNotification(type: string | undefined): AskTab | null {
  if (type === 'ask') return 'now';
  if (type === 'ask_answer') return 'friends';
  if (type === 'invite_joined' || type === 'invite_accepted') return 'friends';
  return null;
}
