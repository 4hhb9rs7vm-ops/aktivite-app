// 1.5.4 (26): İlk gün sakin akış.
// Uygulamanın bu telefonda ilk açıldığı gün kaydedilir. İlk gün kullanıcıya sadece
// Hoş geldin + Günün Sorusu gösterilir; rozet kutlaması, puan tanıtımı, "Yeni" ipuçları ve
// dünün sonucu ertesi güne kalır.
// Güncelleme yapan eski kullanıcılar (telefonda geçmiş varsa) "eski" sayılır.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { istanbulToday } from '@/lib/dailyQuestion';

const INSTALL_KEY = 'install_day_v1';
const OLD = '2000-01-01';
// Bu anahtarlardan biri telefonda varsa kişi uygulamayı daha önce kullanmıştır
const EXISTING_KEYS = ['welcome_seen_v2', 'moment_history_v1', 'dq_answers_v1', 'app_opens_v1'];
const NEW_USER_SEEN_KEYS = ['friends_tip_seen_v1']; // yeni kullanıcıya "Yeni: …" ipuçları gösterilmez

let cached: Promise<string> | null = null;

async function resolveInstallDay(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(INSTALL_KEY);
    if (stored) return stored;
    const pairs = await AsyncStorage.multiGet(EXISTING_KEYS);
    const existing = pairs.some(([, v]) => v !== null && v !== '' && v !== '[]' && v !== '{}');
    const day = existing ? OLD : istanbulToday();
    await AsyncStorage.setItem(INSTALL_KEY, day);
    if (!existing) await AsyncStorage.multiSet(NEW_USER_SEEN_KEYS.map((k) => [k, '1']));
    return day;
  } catch {
    return OLD;
  }
}

// Uygulama açılır açılmaz bir kez çağrılır (_layout); diğerleri aynı sonucu bekler.
export function initFirstRun(): Promise<string> {
  if (!cached) cached = resolveInstallDay();
  return cached;
}

export async function isFirstDay(): Promise<boolean> {
  return (await initFirstRun()) === istanbulToday();
}

// Bu sürümle (1.5.4 (26)) ya da sonra kuranlar: hoş geldin puanı bunlara
export async function isNewUser(): Promise<boolean> {
  return (await initFirstRun()) !== OLD;
}

// "Ben → Sıfırla" sonrası yeniden yeni kullanıcı gibi davranılsın
export async function resetFirstRun(): Promise<void> {
  cached = null;
  await AsyncStorage.removeItem(INSTALL_KEY).catch(() => {});
}
