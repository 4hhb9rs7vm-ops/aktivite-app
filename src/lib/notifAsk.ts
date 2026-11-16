// 1.5.6: Bildirim iznini doğru anda isteme.
// Günün Sorusu cevaplanınca "Sonuç 21:00'de açıklanacak, haber verelim mi?" diye sorulur.
// Reddedene en erken 7 gün sonra tekrar, toplamda en fazla 3 kez.
import { Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getNotifications, hasNotificationPermission, requestNotificationPermission, scheduleDailyMoments } from '@/lib/notifications';

const KEY = 'notif_ask_v1';
const HOME_ASKED_KEY = 'notif_asked_v2'; // ana ekrandaki eski tek seferlik soru (index.tsx ile aynı anahtar)
const MAX_ASKS = 3;
const GAP_MS = 7 * 24 * 60 * 60 * 1000;

type Saved = { count: number; last: number };

async function read(): Promise<Saved> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const v = raw ? JSON.parse(raw) : null;
    if (v && typeof v.count === 'number' && typeof v.last === 'number') return v;
  } catch {}
  return { count: 0, last: 0 };
}

// Şimdi sorulabilir mi?
export async function canAskNotif(): Promise<boolean> {
  if (Platform.OS === 'web' || !getNotifications()) return false;
  try {
    if (await hasNotificationPermission()) return false;
    const s = await read();
    if (s.count >= MAX_ASKS) return false;
    if (s.last && Date.now() - s.last < GAP_MS) return false;
    return true;
  } catch {
    return false;
  }
}

// Soru kartında az önce soruldu mu? (aynı gün ana ekran ikinci kez sormasın)
// 1.5.8: süre 7 günden 20 saate indi. Soru kartında "Şimdi değil" diyen, ertesi gün ilk anını
// seçtikten sonra ana ekrandaki Günün Anı kartını bir kez daha görür (ikinci şans).
const HOME_GAP_MS = 20 * 60 * 60 * 1000;
export async function notifAskedRecently(): Promise<boolean> {
  const s = await read();
  return !!s.last && Date.now() - s.last < HOME_GAP_MS;
}

export async function noteNotifAsk(): Promise<void> {
  const s = await read();
  await AsyncStorage.setItem(KEY, JSON.stringify({ count: s.count + 1, last: Date.now() })).catch(() => {});
}

// "Haber ver": izin iste. Sistem penceresi artık çıkamıyorsa (iPhone'da bir kez reddedilmiş) Ayarlar'ı aç.
// 'granted': izin alındı · 'settings': Ayarlar açıldı · 'denied': kullanıcı pencerede reddetti
export async function acceptNotifAsk(): Promise<'granted' | 'settings' | 'denied'> {
  const Notifications = getNotifications();
  if (!Notifications) return 'denied';
  let canAsk = true;
  try {
    const cur = await Notifications.getPermissionsAsync();
    if (cur.status === 'granted') canAsk = true;
    else canAsk = cur.canAskAgain !== false;
  } catch {}
  if (!canAsk) {
    Linking.openSettings().catch(() => {});
    return 'settings';
  }
  const ok = await requestNotificationPermission().catch(() => false);
  if (!ok) return 'denied';
  AsyncStorage.setItem(HOME_ASKED_KEY, 'yes').catch(() => {});
  scheduleDailyMoments().catch(() => {});
  return 'granted';
}
