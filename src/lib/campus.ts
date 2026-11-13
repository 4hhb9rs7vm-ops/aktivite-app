// 1.5.2 Kampüs Ligi: öğrenci sorusu, okul durumu ("5 kişi eksik"), Pazartesi sonuçları.
// - Okul ve meslek yine sadece telefonda (me.ts). Sunucuya, karşılaştırma onayı varsa
//   an seçilirken giden kayıtla (presence.university) gider; lig sayımı oradan yapılır.
// - Toplam kişi sayısı kullanıcıya hiç gösterilmez: sadece "X kişi eksik", "Son 1 kişi", "Listede".
import { Linking, Share } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ensureSession, supabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { istanbulToday } from '@/lib/dailyQuestion';
import { getNotifications, hasNotificationPermission } from '@/lib/notifications';
import { loadLang } from '@/lib/i18n';
import { loadMe, Me, notifyProfileChanged, saveMe, STUDENT } from '@/lib/me';
import { UNIVERSITY_OTHER } from '@/lib/universities';

export const LEAGUE_MIN = 10; // sunucudaki eşikle aynı (get_campus_status)
export const DOWNLOAD_URL = 'https://4hhb9rs7vm-ops.github.io/aktivite-app/indir/';

const OPENS_KEY = 'app_opens_v1'; // { n, lastAt }
const STUDENT_KEY = 'student_asked_v1'; // 'yes' | 'no'
const FIRST_RESULT_KEY = 'first_result_seen_v1'; // 1.5.3: ilk sonucu görüp ana ekrana döndü mü
const REASK_KEY = 'school_reask_v1'; // 1.5.3: "Evet" deyip okul seçmeyene bir kez daha okul seçimi açıldı mı
const CAMPUS_KEY = 'campus_league_v1'; // { uni, day, lockShown, resultWeek }
const OPEN_GAP_MS = 10 * 60 * 1000; // 10 dakikadan kısa arka plan dönüşü yeni giriş sayılmaz
const LEAGUE_NOTIF_ID = 'kampus-ligi-pazartesi';
const CHANNEL_ID = 'gunun-ani'; // notifications.ts'teki kanal

// ---------------------------------------------------------------- okul bilgisi
// Ligde sayılabilen okul: öğrenci + listeden seçilmiş üniversite
export function leagueSchool(me: Me): string | null {
  if (me.occupation !== STUDENT) return null;
  if (!me.university || me.university === UNIVERSITY_OTHER) return null;
  return me.university;
}

// Kısa ad: "İstanbul Teknik Üniversitesi (İTÜ)" → "İTÜ", "Işık Üniversitesi" → "Işık"
export function shortSchool(name: string): string {
  const m = name.match(/\(([^)]+)\)\s*$/);
  if (m) return m[1];
  const s = name.replace(/\s+Üniversitesi$/i, '').replace(/\s+University$/i, '').trim();
  return s || name;
}

// Türkçe ilgi eki: İTÜ'nün, Boğaziçi'nin, Işık'ın, Anadolu'nun, Ege'nin
export function genitive(name: string): string {
  const low = name.toLocaleLowerCase('tr-TR');
  const vowels = 'aeıioöuü';
  let last = '';
  for (let i = low.length - 1; i >= 0; i--) {
    if (vowels.includes(low[i])) {
      last = low[i];
      break;
    }
  }
  const endsVowel = vowels.includes(low[low.length - 1] ?? '');
  const v = last === 'a' || last === 'ı' ? 'ı' : last === 'e' || last === 'i' ? 'i' : last === 'o' || last === 'u' ? 'u' : 'ü';
  return `${name}'${endsVowel ? 'n' : ''}${v}n`;
}

// Türkçe belirtme eki: İTÜ'yü, Işık'ı, Ege'yi, Koç'u, Anadolu'yu
export function accusative(name: string): string {
  const low = name.toLocaleLowerCase('tr-TR');
  const vowels = 'aeıioöuü';
  let last = '';
  for (let i = low.length - 1; i >= 0; i--) {
    if (vowels.includes(low[i])) {
      last = low[i];
      break;
    }
  }
  const endsVowel = vowels.includes(low[low.length - 1] ?? '');
  const v = last === 'a' || last === 'ı' ? 'ı' : last === 'e' || last === 'i' ? 'i' : last === 'o' || last === 'u' ? 'u' : 'ü';
  return `${name}'${endsVowel ? 'y' : ''}${v}`;
}

// Türkçe yönelme eki: İTÜ'ye, Işık'a, Ege'ye, Koç'a, Anadolu'ya
export function dative(name: string): string {
  const low = name.toLocaleLowerCase('tr-TR');
  const vowels = 'aeıioöuü';
  let last = '';
  for (let i = low.length - 1; i >= 0; i--) {
    if (vowels.includes(low[i])) {
      last = low[i];
      break;
    }
  }
  const endsVowel = vowels.includes(low[low.length - 1] ?? '');
  const v = 'aıou'.includes(last) ? 'a' : 'e';
  return `${name}'${endsVowel ? 'y' : ''}${v}`;
}

export async function hasConsent(): Promise<boolean> {
  return (await AsyncStorage.getItem('consent').catch(() => null)) === 'yes';
}

// ---------------------------------------------------------------- giriş sayısı
// Uygulama her açıldığında (ya da 10 dakikadan uzun aradan sonra öne geldiğinde) bir giriş sayılır.
let lastNoted = 0;
export async function noteAppOpen(): Promise<number> {
  const now = Date.now();
  let st = { n: 0, lastAt: 0 };
  try {
    const raw = await AsyncStorage.getItem(OPENS_KEY);
    if (raw) st = { ...st, ...JSON.parse(raw) };
  } catch {}
  // Aynı oturumda iki kez çağrılırsa (açılış + AppState) bir kez say
  if (now - lastNoted < 5000) return st.n;
  lastNoted = now;
  if (st.n === 0 || now - st.lastAt > OPEN_GAP_MS) st.n += 1;
  st.lastAt = now;
  await AsyncStorage.setItem(OPENS_KEY, JSON.stringify(st)).catch(() => {});
  return st.n;
}

// ---------------------------------------------------------------- ana ekrana dönüş
// 1.5.3: Kişi sonuç ekranından ana ekrana dönünce haber verilir; öğrenci sorusu ilk açılışta bu andan sonra sorulur.
const homeListeners = new Set<() => void>();
export function onHomeReturn(cb: () => void): () => void {
  homeListeners.add(cb);
  return () => {
    homeListeners.delete(cb);
  };
}
export async function markHomeReturn(): Promise<void> {
  await AsyncStorage.setItem(FIRST_RESULT_KEY, '1').catch(() => {});
  homeListeners.forEach((cb) => {
    try {
      cb();
    } catch {}
  });
}

// ---------------------------------------------------------------- öğrenci sorusu
// Bir kez: ilk sonucunu görüp ana ekrana dönmüş (ya da 2. kez açmış), okul seçmemiş,
// meslek olarak başka bir şey seçmemiş ve daha önce cevaplamamış herkese.
export async function shouldAskStudent(opens: number): Promise<boolean> {
  const seen = (await AsyncStorage.getItem(FIRST_RESULT_KEY).catch(() => null)) === '1';
  if (opens < 2 && !seen) return false;
  const asked = await AsyncStorage.getItem(STUDENT_KEY).catch(() => null);
  if (asked) return false;
  const me = await loadMe();
  if (me.occupation && me.occupation !== STUDENT) return false; // başka meslek seçmiş
  if (me.occupation === STUDENT && me.university) return false; // okulu zaten seçmiş
  return true;
}

export async function answerStudent(answer: 'yes' | 'no'): Promise<void> {
  await AsyncStorage.setItem(STUDENT_KEY, answer).catch(() => {});
  track('student_prompt', { answer });
  // 1.5.3: "Evet" diyenin mesleği hemen Öğrenci olur; okul seçmeden çıksa bile kalır
  if (answer === 'yes') {
    const me = await loadMe();
    if (me.occupation !== STUDENT) await saveMe({ ...me, occupation: STUDENT });
  }
}

// 1.5.3: "Evet" deyip okul seçmeden çıkana bir sonraki açılışta bir kez daha (soru sormadan) okul seçimi açılır
export async function shouldReaskSchool(): Promise<boolean> {
  const asked = await AsyncStorage.getItem(STUDENT_KEY).catch(() => null);
  if (asked !== 'yes') return false;
  if (await AsyncStorage.getItem(REASK_KEY).catch(() => null)) return false;
  const me = await loadMe();
  return me.occupation === STUDENT && !me.university;
}
export async function markReasked(): Promise<void> {
  await AsyncStorage.setItem(REASK_KEY, '1').catch(() => {});
}

// Okulu kaydet: meslek "Öğrenci", üniversite, istenirse karşılaştırma onayı.
export async function saveSchool(university: string, giveConsent: boolean): Promise<void> {
  const me = await loadMe();
  if (giveConsent) await AsyncStorage.setItem('consent', 'yes').catch(() => {});
  await saveMe({ ...me, occupation: STUDENT, university }); // saveMe değişikliği haber verir
  if (university !== UNIVERSITY_OTHER) {
    await AsyncStorage.setItem(
      CAMPUS_KEY,
      JSON.stringify({ uni: university, day: istanbulToday(), lockShown: false, resultWeek: '' })
    ).catch(() => {});
    scheduleLeagueNotification().catch(() => {});
  }
  track('campus_picked', { consent: giveConsent, other: university === UNIVERSITY_OTHER });
  notifyProfileChanged();
}

// ---------------------------------------------------------------- lig durumu (sunucu)
export type CampusRanks = { study: number; coffee: number; friends: number; procrastinating: number; schools: number };
export type CampusStatus = {
  missing: number; // bu hafta listeye girmek için eksik kişi (0 = listede)
  listed: boolean;
  lastListed: boolean; // geçen hafta listede miydi
  lastPlayed: boolean; // geçen hafta okuldan en az 1 kişi oynadı mı (hiç kimse yoksa "listeye giremedi" yazmayız)
  lastRanks: CampusRanks | null;
  week: string; // bu haftanın Pazartesi'si (YYYY-MM-DD)
};

export async function fetchCampusStatus(university: string): Promise<CampusStatus | null> {
  try {
    if (!(await ensureSession())) return null;
    const { data, error } = await supabase.rpc('get_campus_status', { p_university: university });
    if (error || !data || data.error) return null;
    const r = data.last_ranks;
    return {
      missing: Math.max(0, Number(data.missing) || 0),
      listed: !!data.listed,
      lastListed: !!data.last_listed,
      lastPlayed: data.last_played === undefined ? true : !!data.last_played,
      lastRanks: r
        ? {
            study: Number(r.study),
            coffee: Number(r.coffee),
            friends: Number(r.friends),
            procrastinating: Number(r.procrastinating),
            schools: Number(r.schools),
          }
        : null,
      week: String(data.week ?? ''),
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- yerel durum
type CampusState = { uni: string; day: string; lockShown: boolean; resultWeek: string };

export async function readCampusState(): Promise<CampusState | null> {
  try {
    const raw = await AsyncStorage.getItem(CAMPUS_KEY);
    const v = raw ? JSON.parse(raw) : null;
    return v && typeof v.uni === 'string' ? v : null;
  } catch {
    return null;
  }
}

export async function patchCampusState(patch: Partial<CampusState>): Promise<void> {
  const cur = await readCampusState();
  if (!cur) return;
  await AsyncStorage.setItem(CAMPUS_KEY, JSON.stringify({ ...cur, ...patch })).catch(() => {});
}

// Okul daha önce Ben sekmesinden seçildiyse (1.5.2 öncesi) yerel durumu oluştur
export async function ensureCampusState(university: string): Promise<CampusState> {
  const cur = await readCampusState();
  if (cur && cur.uni === university) return cur;
  // Okul değiştiyse ya da kayıt yoksa: bugün seçilmiş say (okul kilidi yarın)
  const next: CampusState = { uni: university, day: istanbulToday(), lockShown: false, resultWeek: cur?.resultWeek ?? '' };
  await AsyncStorage.setItem(CAMPUS_KEY, JSON.stringify(next)).catch(() => {});
  return next;
}

export function isMondayOrTuesday(): boolean {
  const d = new Date(Date.now() + 3 * 60 * 60 * 1000); // İstanbul
  const w = d.getUTCDay(); // 0 Pazar, 1 Pazartesi
  return w === 1 || w === 2;
}

// ---------------------------------------------------------------- metinler
type L = 'tr' | 'en';

// Okulda henüz çok az kişi var (0-3): "X kişi eksik" yerine "ilk sen taşı" deriz
export const EARLY_MISSING = 7;
export function isEarly(st: CampusStatus | null): boolean {
  return !st || (!st.listed && st.missing >= EARLY_MISSING);
}

export function statusSub(st: CampusStatus | null, lang: L): string | null {
  if (!isEarly(st)) return null;
  return lang === 'en' ? 'Invite your friends and get your school on the list' : 'Arkadaşlarını çağır, okulun listeye girsin';
}

export function statusTitle(st: CampusStatus, school: string, lang: L): string {
  const s = shortSchool(school);
  if (lang === 'en') {
    if (st.listed) return `${s} is on the list!`;
    if (st.missing === 1) return `Last 1 person for ${s}!`;
    if (isEarly(st)) return `Be the first to put ${s} in the league 🚀`;
    return `${s} needs ${st.missing} more people`;
  }
  if (st.listed) return `${s} listede!`;
  if (st.missing === 1) return `${s} için son 1 kişi!`;
  if (isEarly(st)) return `${accusative(s)} lige ilk sen taşı 🚀`;
  return `${genitive(s)} listeye girmesi için ${st.missing} kişi eksik`;
}

export function shareMessage(st: CampusStatus | null, school: string, lang: L): string {
  const s = shortSchool(school);
  if (lang === 'en') {
    if (isEarly(st)) {
      return `The Campus League started on Şu An 🏆 Let's get ${s} on the list: get Şu An and pick your school 👉 ${DOWNLOAD_URL}`;
    }
    if (!st || st.missing > 1) {
      const n = st ? st.missing : LEAGUE_MIN;
      return `${s} needs ${n} more people to join the Campus League on Şu An 🏆 Join in: get Şu An and pick your school 👉 ${DOWNLOAD_URL}`;
    }
    if (st.missing === 1) return `${s} is 1 person away from the Campus League 🔥 Be the last one 👉 ${DOWNLOAD_URL}`;
    return `${s} is in the Campus League on Şu An! 🏆 Join and make your school stronger 👉 ${DOWNLOAD_URL}`;
  }
  if (isEarly(st)) {
    return `Şu An'da Kampüs Ligi başladı 🏆 ${accusative(s)} listeye taşıyalım: Şu An'ı indir, okulunu seç 👉 ${DOWNLOAD_URL}`;
  }
  if (!st || st.missing > 1) {
    const n = st ? st.missing : LEAGUE_MIN;
    return `${genitive(s)} Kampüs Ligi'ne girmesi için ${n} kişi eksik 🏆 Sen de katıl, Şu An'ı indir, okulunu seç 👉 ${DOWNLOAD_URL}`;
  }
  if (st.missing === 1) return `${genitive(s)} Kampüs Ligi'ne girmesine 1 kişi kaldı 🔥 Son kişi sen ol 👉 ${DOWNLOAD_URL}`;
  return `${s} Şu An'daki Kampüs Ligi'nde! 🏆 Sen de katıl, okulunu güçlendir 👉 ${DOWNLOAD_URL}`;
}

export async function shareCampusWhatsApp(message: string, from: string): Promise<void> {
  track('app_share', { from, via: 'whatsapp' });
  try {
    await Linking.openURL(`whatsapp://send?text=${encodeURIComponent(message)}`);
  } catch {
    await Share.share({ message }).catch(() => {});
  }
}

export async function shareCampusOther(message: string, from: string): Promise<void> {
  track('app_share', { from, via: 'share' });
  await Share.share({ message }).catch(() => {});
}

// ---------------------------------------------------------------- Pazartesi bildirimi
// Her Pazartesi 10:00 (telefonun saati) yerel bildirim. Sadece okulunu seçenlere.
export async function scheduleLeagueNotification(): Promise<void> {
  try {
    const Notifications = getNotifications();
    if (!Notifications) return;
    if (!(await hasNotificationPermission())) return;
    const lang = (await loadLang()) as string;
    const tr = lang !== 'en';
    await Notifications.cancelScheduledNotificationAsync(LEAGUE_NOTIF_ID).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: LEAGUE_NOTIF_ID,
      content: {
        title: tr ? 'Şu An · Kampüs Ligi' : 'Şu An · Campus League',
        body: tr
          ? '🏆 Haftanın sıralaması açıklandı! Okulun bu hafta nerede, gör 👀'
          : "🏆 This week's ranking is out! See where your school stands 👀",
        data: { type: 'campus_league' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: 2, // 1 Pazar, 2 Pazartesi
        hour: 10,
        minute: 0,
        channelId: CHANNEL_ID,
      },
    });
  } catch {}
}

export async function cancelLeagueNotification(): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;
  await Notifications.cancelScheduledNotificationAsync(LEAGUE_NOTIF_ID).catch(() => {});
}

// Okul seçimi kalktıysa bildirimi iptal et, varsa kur (açılışta çağrılır)
export async function syncLeagueNotification(): Promise<void> {
  const me = await loadMe();
  if (leagueSchool(me)) await scheduleLeagueNotification();
  else await cancelLeagueNotification();
}
