import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { loadLang, NOTIF_TEXT } from '@/lib/i18n';

// ---- Ayarlar ----
const CHANNEL_ID = 'gunun-ani';
const ID_PREFIX = 'gunun-ani-';
const DAYS_AHEAD = 14; // Uygulama her açıldığında önümüzdeki 14 gün planlanır

// Her kullanıcının kendi yerel saatiyle 10:00-19:30 arası başlar; 30 dk cevap penceresiyle en geç 20:00'de biter.
// Böylece 21:00'deki Günün Sorusu sonucuyla arasında en az 1 saat kalır.
// Aynı saat dilimindeki herkes aynı anda bildirim alır.
const WINDOW_START_MIN = 10 * 60; // 10:00
const WINDOW_END_MIN = 19 * 60 + 30; // 19:30 (son başlangıç)
export const ANSWER_WINDOW_MIN = 30; // Bildirimden sonra cevap penceresi (dakika)

// ---- Bildirim modülü (gerektiğinde yüklenir) ----
// Android'de Expo Go, expo-notifications modülünü yüklerken hata veriyor (SDK 53'ten beri).
// Bu yüzden modül sadece kullanılabildiği yerde yüklenir: iPhone'da Expo Go, her iki platformda
// gerçek uygulama (mağaza ve geliştirme build'leri). Android + Expo Go'da bildirimler sessizce atlanır.
type NotificationsModule = typeof import('expo-notifications');

const IS_ANDROID_EXPO_GO = Platform.OS === 'android' && Constants.executionEnvironment === 'storeClient';
export const NOTIFICATIONS_AVAILABLE = Platform.OS !== 'web' && !IS_ANDROID_EXPO_GO;

let cached: NotificationsModule | null = null;
export function getNotifications(): NotificationsModule | null {
  if (!NOTIFICATIONS_AVAILABLE) return null;
  if (!cached) {
    try {
      cached = require('expo-notifications') as NotificationsModule;
      // Uygulama açıkken gelen bildirim de ekranda görünsün
      cached.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
    } catch {
      cached = null;
    }
  }
  return cached;
}

// ---- Tarih yardımcıları (yerel saat) ----
function dateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

// Aynı tarih her telefonda aynı sayıyı üretir (FNV-1a + son karıştırma)
function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

// Verilen günün "Günün Anı" saati (yerel saatle 10:00-19:30 arası, aynı günde herkeste aynı)
export function getMomentForDay(day: Date): Date {
  const range = WINDOW_END_MIN - WINDOW_START_MIN;
  const minuteOfDay = WINDOW_START_MIN + (hashString('gunun-ani:' + dateKey(day)) % range);
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    Math.floor(minuteOfDay / 60),
    minuteOfDay % 60,
    0,
    0
  );
}

// Bugünün anı: ne zaman başlıyor, ne zaman bitiyor, şu an açık mı
export function getTodayMoment(): { start: Date; end: Date; isOpen: boolean } {
  const now = new Date();
  const start = getMomentForDay(now);
  const end = new Date(start.getTime() + ANSWER_WINDOW_MIN * 60 * 1000);
  return { start, end, isOpen: now >= start && now < end };
}

async function ensureChannel(): Promise<void> {
  const Notifications = getNotifications();
  if (Notifications && Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Günün Anı / Today’s Moment',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#0F2A52',
    });
  }
}

// ---- İzinler ----
export async function hasNotificationPermission(): Promise<boolean> {
  const Notifications = getNotifications();
  if (!Notifications) return false;
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

export async function requestNotificationPermission(): Promise<boolean> {
  const Notifications = getNotifications();
  if (!Notifications) return false;
  // Android 13+: izin penceresinin çıkması için kanal önceden oluşturulmalı
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return true;
  if (!current.canAskAgain) return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ---- Planlama ----
export async function cancelDailyMoments(): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(ID_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
  );
}

// Ben → Ayarlar'dan "Günün Anı" kapatılabilir (varsayılan açık)
export const DAILY_MOMENT_KEY = 'daily_moment_enabled_v1';

export async function isDailyMomentEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(DAILY_MOMENT_KEY)) !== 'no';
  } catch {
    return true;
  }
}

export async function setDailyMomentEnabled(on: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(DAILY_MOMENT_KEY, on ? 'yes' : 'no');
  } catch {}
  if (on) await scheduleDailyMoments();
  else {
    await cancelDailyMoments();
    await cancelResultNotifications();
  }
}

// Dil değiştiğinde de çağrılır; bildirim metni seçili dilde planlanır
export async function scheduleDailyMoments(): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;
  if (!(await isDailyMomentEnabled())) {
    await cancelDailyMoments();
    return;
  }
  if (!(await hasNotificationPermission())) return;
  await ensureChannel();
  await cancelDailyMoments();

  const text = NOTIF_TEXT[await loadLang()];
  const now = new Date();
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const moment = getMomentForDay(day);
    if (moment <= now) continue; // Bugünün anı geçtiyse atla

    await Notifications.scheduleNotificationAsync({
      identifier: ID_PREFIX + dateKey(day),
      content: {
        title: text.title,
        body: text.body,
        data: { type: 'gunun-ani', date: dateKey(day) },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: moment,
        channelId: CHANNEL_ID,
      },
    });
  }
}

// ---- Günün Sorusu: akşam 21:00 "sonuçlar açıklandı" bildirimi ----
// Sadece o gün soruyu cevaplayanlara, cevap verdikleri anda telefonda kurulur (sunucu gerekmez).
// "Günün Anı" ayarı kapalıysa ya da bildirim izni yoksa kurulmaz.
const RESULT_ID_PREFIX = 'gunun-sorusu-sonuc-';

const RESULT_TEXT = {
  tr: {
    title: 'Sonuçlar açıklandı',
    club: (club: string) => `${club} ne kadar kalabalık? Hemen bak.`,
    plain: 'Senin gibi cevap veren kaç kişi var? Hemen bak.',
  },
  en: {
    title: 'Results are in',
    club: (club: string) => `How big is the ${club}? Take a look.`,
    plain: 'How many people answered like you? Take a look.',
  },
};

// day: İstanbul günü 'YYYY-MM-DD'. Bildirim o gün 21:00 İstanbul saatinde (18:00 UTC) gelir.
export async function scheduleResultNotification(day: string, club: string | null): Promise<void> {
  try {
    const Notifications = getNotifications();
    if (!Notifications) return;
    if (!(await isDailyMomentEnabled())) return;
    if (!(await hasNotificationPermission())) return;

    const [y, m, d] = day.split('-').map(Number);
    const at = new Date(Date.UTC(y, m - 1, d, 18, 0, 0));
    if (at.getTime() <= Date.now() + 60 * 1000) return; // 21:00 geçtiyse kurma

    await ensureChannel();
    const lang = await loadLang();
    const t = (lang as string) === 'tr' ? RESULT_TEXT.tr : RESULT_TEXT.en;
    const id = RESULT_ID_PREFIX + day;
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title: t.title,
        body: club ? t.club(club) : t.plain,
        data: { type: 'gunun-sorusu-sonuc', date: day },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: at,
        channelId: CHANNEL_ID,
      },
    });
  } catch {}
}

export async function cancelResultNotifications(): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  await Promise.all(
    scheduled
      .filter((x) => x.identifier.startsWith(RESULT_ID_PREFIX))
      .map((x) => Notifications.cancelScheduledNotificationAsync(x.identifier).catch(() => {}))
  );
}