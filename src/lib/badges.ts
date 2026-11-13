// Rozetler ve 30 günlük yol
// Her şey telefonda hesaplanır: anket cevapları (dq_answers_v1), an geçmişi (moment_history_v1), selamlar.
// - Yol: 1-30 Kasım, her gün bir durak. Cevaplanan gün dolu, kaçırılan gün boş.
// - Can (🛟): serinin her haftasında (1-7, 8-14, 15-21, 22-28, 29-30) 1 can. Kaçırılan ilk gün canla kurtarılır,
//   seri bozulmaz (ama o gün seriye sayılmaz). Aynı haftada ikinci kaçırılan gün seriyi bozar.
// - Üyelik: 7 gün seri → Daimi Üye, 14 → Gümüş, 21 → Altın, 30/30 (1. günden kesintisiz) → Kurucu Üye.
// - Rozetler kalıcıdır: bir kez kazanılan rozet seri bozulsa da gitmez.
// 1.5.1 (sonradan katılanlar için):
// - 🌱 Hoş geldin: ilk cevap. 🚀 Kasım Öncüsü: Kasım bitmeden 7 cevap (30 Kasım'da kapanır).
// - 🔍 Meraklı Kâşif: kaçırılan 5 soruyu arşivden cevapla. Arşiv cevapları seriye sayılmaz, sonuçları değiştirmez.
// - 🛟 Hediye can: geç katılanın ilk 7 gününde 1 ekstra can.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Lang } from '@/lib/i18n';
import { istanbulToday, SERIES_LENGTH, SERIES_START } from '@/lib/dailyQuestion';
import { sentSelamTotal } from '@/lib/selam';
import { ensureSession, supabase } from '@/lib/supabase';

const ANSWERS_KEY = 'dq_answers_v1';
const HISTORY_KEY = 'moment_history_v1';
const EARNED_KEY = 'badges_earned_v1'; // { badgeId: 'YYYY-MM-DD' }
const PATH_LEN_KEY = 'path_len_v1'; // yolun uzunluğu (veritabanındaki soru sayısı)
export const ARCHIVE_KEY = 'dq_archive_v1'; // { 'YYYY-MM-DD': 'a' } arşivden cevaplanan günler
const PIONEER_END = '2026-11-30'; // Kasım Öncüsü son gün
const PIONEER_NEED = 7;
const EXPLORER_NEED = 5;

// Bitmeyen yol: uzunluk veritabanındaki soru sayısından gelir.
// Aralık soruları eklenince yol kendiliğinden uzar, uygulama güncellemesi gerekmez.
let pathLenCache: number | null = null;
export async function getPathLength(): Promise<number> {
  if (pathLenCache) return pathLenCache;
  let n = SERIES_LENGTH;
  try {
    const saved = Number(await AsyncStorage.getItem(PATH_LEN_KEY));
    if (saved > n) n = saved;
  } catch {}
  try {
    if (await ensureSession()) {
      const { data, error } = await supabase.rpc('path_length');
      const fresh = Number(data);
      if (!error && fresh > 0) {
        n = Math.max(SERIES_LENGTH, fresh);
        await AsyncStorage.setItem(PATH_LEN_KEY, String(n)).catch(() => {});
      }
    }
  } catch {}
  pathLenCache = n;
  return n;
}

export type BadgeId =
  | 'tier_7'
  | 'tier_14'
  | 'tier_21'
  | 'tier_30'
  | 'selam_1'
  | 'selam_10'
  | 'selam_50'
  | 'early_5'
  | 'night_5'
  | 'daily_7'
  | 'daily_30'
  | 'ask_1'
  | 'welcome_1'
  | 'pioneer_nov'
  | 'explorer_5'
  | 'sharp_eye';

export type TierId = 'tier_7' | 'tier_14' | 'tier_21' | 'tier_30';

export type BadgeDef = {
  id: BadgeId;
  emoji: string;
  name: { tr: string; en: string };
  how: { tr: string; en: string }; // nasıl kazanılır (kilitliyken görünür)
  done: { tr: string; en: string }; // kazanınca kutlamada görünür (geçmiş zaman)
  reward?: { tr: string; en: string }; // kazanınca kutlamada görünür
};

export const BADGES: BadgeDef[] = [
  {
    id: 'tier_7',
    emoji: '🎖️',
    name: { tr: 'Daimi Üye', en: 'Regular' },
    how: { tr: '7 gün seri', en: '7-day streak' },
    done: { tr: '7 gün üst üste cevapladın.', en: 'You answered 7 days in a row.' },
    reward: { tr: 'Story kartların artık altın çerçeveli.', en: 'Your story cards now have a gold frame.' },
  },
  {
    id: 'tier_14',
    emoji: '🥈',
    name: { tr: 'Gümüş Üye', en: 'Silver Member' },
    how: { tr: '14 gün seri', en: '14-day streak' },
    done: { tr: '14 gün üst üste cevapladın.', en: 'You answered 14 days in a row.' },
    reward: { tr: 'Story kartların gümüş temalı.', en: 'Your story cards get the silver theme.' },
  },
  {
    id: 'tier_21',
    emoji: '🥇',
    name: { tr: 'Altın Üye', en: 'Gold Member' },
    how: { tr: '21 gün seri', en: '21-day streak' },
    done: { tr: '21 gün üst üste cevapladın.', en: 'You answered 21 days in a row.' },
    reward: { tr: 'Story kartların altın temalı.', en: 'Your story cards get the gold theme.' },
  },
  {
    id: 'tier_30',
    emoji: '👑',
    name: { tr: 'Kurucu Üye', en: 'Founding Member' },
    how: { tr: '30/30, ilk günden', en: '30/30 from day one' },
    done: { tr: '30 günün hepsini cevapladın.', en: 'You answered all 30 days.' },
    reward: { tr: 'Kalıcı unvan: Şu An Kurucu Üyesi.', en: 'A permanent title: Şu An Founding Member.' },
  },
  {
    id: 'selam_1',
    emoji: '👋',
    name: { tr: 'İlk selam', en: 'First hello' },
    how: { tr: '1 selam ver', en: 'Send 1 hello' },
    done: { tr: 'İlk selamını verdin.', en: 'You sent your first hello.' },
  },
  {
    id: 'selam_10',
    emoji: '🤝',
    name: { tr: 'Selamcı', en: 'Greeter' },
    how: { tr: '10 selam ver', en: 'Send 10 hellos' },
    done: { tr: '10 kişiye selam verdin.', en: 'You sent 10 hellos.' },
  },
  {
    id: 'selam_50',
    emoji: '🏘️',
    name: { tr: 'Mahallenin muhtarı', en: 'Neighborhood mayor' },
    how: { tr: '50 selam ver', en: 'Send 50 hellos' },
    done: { tr: '50 selam verdin. Mahalle seni tanıyor.', en: '50 hellos sent. The neighborhood knows you.' },
  },
  {
    id: 'early_5',
    emoji: '☀️',
    name: { tr: 'Erkenci', en: 'Early bird' },
    how: { tr: '5 sabah anı (05-09)', en: '5 morning moments (5-9 am)' },
    done: { tr: '5 kez sabah erkenden buradaydın.', en: 'You were here early 5 mornings.' },
  },
  {
    id: 'night_5',
    emoji: '🌙',
    name: { tr: 'Gece kuşu', en: 'Night owl' },
    how: { tr: '5 gece anı (23-04)', en: '5 night moments (11 pm-4 am)' },
    done: { tr: '5 kez gece yarısı buradaydın.', en: 'You were here 5 late nights.' },
  },
  {
    id: 'daily_7',
    emoji: '📅',
    name: { tr: 'Her Gün Buradayım', en: 'Every Single Day' },
    how: { tr: '7 gün üst üste an seç', en: 'Pick a moment 7 days in a row' },
    done: { tr: '7 gün üst üste an seçtin.', en: 'You picked a moment 7 days in a row.' },
  },
  {
    id: 'daily_30',
    emoji: '🏛️',
    name: { tr: 'Demirbaş', en: 'Fixture' },
    how: { tr: '30 gün üst üste an seç', en: 'Pick a moment 30 days in a row' },
    done: { tr: '30 gün üst üste buradaydın. Artık demirbaşsın.', en: "30 days in a row. You're part of the furniture now." },
  },
  {
    id: 'ask_1',
    emoji: '👀',
    name: { tr: 'Meraklı', en: 'Curious' },
    how: { tr: 'Bir arkadaşına "Sor" de', en: 'Ask a friend once' },
    done: { tr: 'Bir arkadaşına "Şu an ne yapıyorsun?" diye sordun.', en: 'You asked a friend what they are up to.' },
  },
  {
    id: 'welcome_1',
    emoji: '🌱',
    name: { tr: 'Hoş geldin', en: 'Welcome' },
    how: { tr: 'İlk soruyu cevapla', en: 'Answer your first question' },
    done: {
      tr: 'İlk cevabını verdin, yolun başladı. 7 gün üst üste gel, Daimi Üye ol.',
      en: 'You gave your first answer. Come back 7 days in a row to become a Regular.',
    },
    reward: { tr: 'Hediye: ilk haftan için 1 ekstra can 🛟', en: 'Gift: 1 extra life for your first week 🛟' },
  },
  {
    id: 'pioneer_nov',
    emoji: '🚀',
    name: { tr: 'Kasım Öncüsü', en: 'November Pioneer' },
    how: { tr: "Kasım'da 7 cevap", en: '7 answers in November' },
    done: { tr: 'İlk ayın öncülerindensin. Bu rozet bir daha verilmeyecek.', en: "You're one of the first month's pioneers. This badge won't come back." },
  },
  {
    id: 'explorer_5',
    emoji: '🔍',
    name: { tr: 'Meraklı Kâşif', en: 'Curious Explorer' },
    how: { tr: '5 eski soruyu cevapla', en: 'Answer 5 past questions' },
    done: { tr: 'Kaçırdığın 5 soruyu keşfettin.', en: 'You explored 5 questions you missed.' },
  },
  // 1.5.4: Tahmin Oyunu — haftanın en iyi %10 tahmincisi (sunucu hesaplar, pazartesi verilir)
  {
    id: 'sharp_eye',
    emoji: '🎯',
    name: { tr: 'Keskin Göz', en: 'Sharp Eye' },
    how: { tr: 'Haftanın en iyi %10 tahmincisi ol', en: "Be in the week's top 10% of guessers" },
    done: { tr: 'Bu hafta tahmincilerin en iyi %10’undaydın.', en: "You were in this week's top 10% of guessers." },
  },
];

// Süresi geçmiş ve kazanılmamış rozetler listede gösterilmez (ör. Kasım Öncüsü, 30 Kasım'dan sonra)
export function badgeVisible(id: BadgeId, earned: Record<string, string>, today: string): boolean {
  if (earned[id]) return true;
  if (id === 'pioneer_nov') return today <= PIONEER_END;
  return true;
}

export const BADGE_BY_ID: Record<BadgeId, BadgeDef> = Object.fromEntries(BADGES.map((b) => [b.id, b])) as Record<
  BadgeId,
  BadgeDef
>;

export function badgeName(id: BadgeId, lang: Lang): string {
  const b = BADGE_BY_ID[id];
  return (lang as string) === 'tr' ? b.name.tr : b.name.en;
}

// ---------------------------------------------------------------- 30 günlük yol
export type DayStatus = 'answered' | 'joker' | 'archived' | 'missed' | 'today' | 'locked';
export type PathDay = { n: number; date: string; status: DayStatus };

export type Progress = {
  days: PathDay[];
  started: boolean; // seri başladı mı (1 Kasım geldi mi)
  streak: number; // şu anki seri (cevaplanan gün sayısı; canla kurtarılan gün sayılmaz ama bozmaz)
  bestStreak: number;
  cansLeft: number; // bu haftaki can (0 ya da 1)
  founding: boolean; // 1. günden beri kesintisiz mi (Kurucu Üye yolu)
  answered: number; // toplam cevaplanan gün
  firstAnswered: number; // ilk cevaplanan günün sırası (0: henüz yok)
  personalDay: number; // sonradan katılan için "senin kaçıncı günün" (1. günden beri olanlarda 0)
  missedCount: number; // arşivden cevaplanabilecek kaçırılmış gün sayısı
  tier: TierId | null; // ulaşılan en yüksek üyelik (kalıcı rozetlerden)
  next: { id: TierId; left: number } | null; // bir sonraki üyelik ve kalan gün
};

function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function computePath(
  answers: Record<string, string>,
  today: string,
  total: number = SERIES_LENGTH,
  archive: Record<string, string> = {}
): Omit<Progress, 'tier' | 'next'> {
  const days: PathDay[] = [];
  const jokerUsed: boolean[] = [];
  let giftUsed = false; // geç katılana ilk 7 günde 1 hediye can
  let chain = 0;
  let best = 0;
  let answered = 0;
  let firstAnswered = 0; // kullanıcının ilk cevapladığı gün (sonradan katılanlar için)
  let founding = true;

  for (let i = 1; i <= total; i++) {
    const date = addDays(SERIES_START, i - 1);
    const week = Math.floor((i - 1) / 7);
    const has = !!answers[date];
    if (date > today) {
      days.push({ n: i, date, status: 'locked' });
      continue;
    }
    if (has) {
      if (!firstAnswered) firstAnswered = i;
      chain++;
      answered++;
      best = Math.max(best, chain);
      days.push({ n: i, date, status: 'answered' });
      continue;
    }
    if (date === today) {
      days.push({ n: i, date, status: 'today' }); // bugün henüz cevap yok: seriyi bozmaz
      continue;
    }
    // Geçmişte kaçırılmış gün (arşivden cevaplandıysa yolda farklı görünür, seriye sayılmaz)
    const missedStatus: DayStatus = archive[date] ? 'archived' : 'missed';
    if (!firstAnswered) {
      // Kullanıcı henüz başlamamıştı: can harcanmaz, seri zaten 0
      founding = false;
      days.push({ n: i, date, status: missedStatus });
      continue;
    }
    if (!jokerUsed[week]) {
      jokerUsed[week] = true;
      days.push({ n: i, date, status: 'joker' });
      continue;
    }
    if (!giftUsed && firstAnswered > 1 && i - firstAnswered < 7) {
      giftUsed = true;
      days.push({ n: i, date, status: 'joker' });
      continue;
    }
    chain = 0;
    founding = false;
    days.push({ n: i, date, status: missedStatus });
  }

  const started = today >= SERIES_START;
  let todayIdx = 0;
  for (const d of days) if (d.date <= today) todayIdx = d.n;
  const curWeek = Math.floor(Math.max(0, todayIdx - 1) / 7);
  const giftOpen = firstAnswered > 1 && !giftUsed && todayIdx - firstAnswered < 7;
  const cansLeft = (started ? (jokerUsed[curWeek] ? 0 : 1) : 1) + (giftOpen ? 1 : 0);
  // Kurucu yolu: 1. gün cevaplanmış olmalı (ya da bugün 1. gün ve henüz cevap yok)
  founding = founding && (firstAnswered === 1 || (firstAnswered === 0 && todayIdx <= 1 && started));

  const personalDay = firstAnswered > 1 ? todayIdx - firstAnswered + 1 : 0;
  const missedCount = days.filter((d) => d.status === 'missed').length;
  return { days, started, streak: chain, bestStreak: best, cansLeft, founding, answered, firstAnswered, personalDay, missedCount };
}

// ---------------------------------------------------------------- rozet kontrolü
async function momentCounts(): Promise<{ early: number; night: number }> {
  const h = await readJson<{ id: string; at: number }[]>(HISTORY_KEY, []);
  let early = 0;
  let night = 0;
  for (const e of Array.isArray(h) ? h : []) {
    if (!e || typeof e.at !== 'number') continue;
    const hour = new Date(e.at).getHours(); // kullanıcının kendi saati
    if (hour >= 5 && hour < 9) early++;
    if (hour >= 23 || hour < 4) night++;
  }
  return { early, night };
}

// An seçilen günlerden en uzun kesintisiz seri (kullanıcının kendi saatiyle)
async function momentBestStreak(): Promise<number> {
  const h = await readJson<{ id: string; at: number }[]>(HISTORY_KEY, []);
  const days = new Set<number>();
  for (const e of Array.isArray(h) ? h : []) {
    if (!e || typeof e.at !== 'number') continue;
    const d = new Date(e.at);
    days.add(Math.round(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).getTime() / 86400000));
  }
  const sorted = [...days].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  for (let i = 0; i < sorted.length; i++) {
    run = i > 0 && sorted[i] - sorted[i - 1] === 1 ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

async function askTotal(): Promise<number> {
  try {
    return Number(await AsyncStorage.getItem('ask_total_v1')) || 0;
  } catch {
    return 0;
  }
}

async function computeEarned(
  p: Omit<Progress, 'tier' | 'next'>,
  answers: Record<string, string>,
  archive: Record<string, string>,
  earned: Record<string, string>
): Promise<BadgeId[]> {
  const [sent, mc, daily, asks] = await Promise.all([sentSelamTotal(), momentCounts(), momentBestStreak(), askTotal()]);
  const out: BadgeId[] = [];
  if (p.bestStreak >= 7) out.push('tier_7');
  if (p.bestStreak >= 14) out.push('tier_14');
  if (p.bestStreak >= 21) out.push('tier_21');
  const day30 = p.days[SERIES_LENGTH - 1];
  if (day30 && day30.status === 'answered' && p.founding) out.push('tier_30');
  if (sent >= 1) out.push('selam_1');
  if (sent >= 10) out.push('selam_10');
  if (sent >= 50) out.push('selam_50');
  if (mc.early >= 5) out.push('early_5');
  if (mc.night >= 5) out.push('night_5');
  if (daily >= 7) out.push('daily_7');
  if (daily >= 30) out.push('daily_30');
  if (asks >= 1) out.push('ask_1');
  // Hoş geldin: sadece yeni başlayanlara (eski kullanıcılar güncellemeden sonra durup dururken almasın)
  if (p.answered >= 1 && (p.answered <= 3 || earned.welcome_1)) out.push('welcome_1');
  const novAnswers = Object.keys(answers).filter((d) => d >= SERIES_START && d <= PIONEER_END).length;
  if (novAnswers >= PIONEER_NEED) out.push('pioneer_nov');
  if (Object.keys(archive).length >= EXPLORER_NEED) out.push('explorer_5');
  return out;
}

export async function readEarned(): Promise<Record<string, string>> {
  return readJson<Record<string, string>>(EARNED_KEY, {});
}

const TIER_ORDER: TierId[] = ['tier_7', 'tier_14', 'tier_21', 'tier_30'];
const TIER_DAYS: Record<TierId, number> = { tier_7: 7, tier_14: 14, tier_21: 21, tier_30: 30 };

export function tierFrom(earned: Record<string, string>): TierId | null {
  let t: TierId | null = null;
  for (const id of TIER_ORDER) if (earned[id]) t = id;
  return t;
}

export async function getTier(): Promise<TierId | null> {
  return tierFrom(await readEarned());
}

// Yol + rozetler (ekranlar için)
export async function getProgress(): Promise<Progress> {
  const answers = await readJson<Record<string, string>>(ANSWERS_KEY, {});
  const archive = await readJson<Record<string, string>>(ARCHIVE_KEY, {});
  const base = computePath(answers, istanbulToday(), await getPathLength(), archive);
  const earned = await readEarned();
  const tier = tierFrom(earned);
  let next: Progress['next'] = null;
  for (const id of TIER_ORDER) {
    if (earned[id]) continue;
    if (id === 'tier_30') {
      if (base.founding && base.started) {
        const todayN = base.days.filter((d) => d.status !== 'locked').length;
        const todayDone = base.days[todayN - 1]?.status === 'answered';
        next = { id, left: Math.max(1, SERIES_LENGTH - todayN + (todayDone ? 0 : 1)) };
      }
    } else {
      next = { id, left: Math.max(1, TIER_DAYS[id] - base.streak) };
    }
    break;
  }
  return { ...base, tier, next };
}

// ---------------------------------------------------------------- arşiv (kaçırılan sorular)
export type ArchiveResult = { key: string; pct: number };
export type ArchiveItem = {
  questionId: number;
  date: string;
  seriesDay: number | null;
  questionTr: string;
  questionEn: string | null;
  options: { key: string; tr: string; en?: string }[];
  myAnswer: string | null;
  answeredLive: boolean;
  results: ArchiveResult[]; // dünya sonuçları
};

export async function fetchArchive(): Promise<ArchiveItem[] | null> {
  try {
    if (!(await ensureSession())) return null;
    const { data, error } = await supabase.rpc('get_archive');
    if (error || !Array.isArray(data)) return null;
    const local = await readJson<Record<string, string>>(ARCHIVE_KEY, {});
    let changed = false;
    const items: ArchiveItem[] = data.map((r: any) => {
      const results: ArchiveResult[] = (Array.isArray(r.results) ? r.results : [])
        .filter((x: any) => x && x.scope === 'world')
        .map((x: any) => ({ key: String(x.option_key), pct: Number(x.pct) || 0 }));
      // Sunucudaki arşiv cevaplarını telefona eşitle (yeniden kurulumda kaybolmasın)
      if (r.my_answer && !r.answered_live && !local[r.day_date]) {
        local[r.day_date] = r.my_answer;
        changed = true;
      }
      return {
        questionId: Number(r.question_id),
        date: String(r.day_date),
        seriesDay: r.series_day ?? null,
        questionTr: r.question_tr ?? '',
        questionEn: r.question_en ?? null,
        options: Array.isArray(r.options) ? r.options : [],
        myAnswer: r.my_answer ?? null,
        answeredLive: !!r.answered_live,
        results,
      };
    });
    if (changed) await AsyncStorage.setItem(ARCHIVE_KEY, JSON.stringify(local)).catch(() => {});
    return items;
  } catch {
    return null;
  }
}

export async function answerArchive(item: ArchiveItem, optionKey: string): Promise<boolean> {
  try {
    if (!(await ensureSession())) return false;
    const { data, error } = await supabase.rpc('answer_archive', { p_question_id: item.questionId, p_option: optionKey });
    if (error || !data || data.error) return false;
    const local = await readJson<Record<string, string>>(ARCHIVE_KEY, {});
    local[item.date] = optionKey;
    await AsyncStorage.setItem(ARCHIVE_KEY, JSON.stringify(local)).catch(() => {});
    setTimeout(() => checkBadges().catch(() => {}), 600);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- yeni rozet → kutlama
type NewBadgeListener = (ids: BadgeId[]) => void;
const listeners = new Set<NewBadgeListener>();
export function onNewBadges(fn: NewBadgeListener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

type ChangeListener = () => void;
const changeListeners = new Set<ChangeListener>();
export function onBadgesChanged(fn: ChangeListener): () => void {
  changeListeners.add(fn);
  return () => {
    changeListeners.delete(fn);
  };
}

// 1.5.4: Kazanılan rozetler ve tarihleri (rozet puanı için sunucuya yazılır)
export async function getEarnedBadges(): Promise<Record<string, string>> {
  return readEarned();
}

// 1.5.4: Sunucunun verdiği rozetler (ör. Keskin Göz). Yeni kazanıldıysa kaydeder ve kutlama açtırır.
export async function awardBadges(ids: BadgeId[]): Promise<BadgeId[]> {
  const earned = await readEarned();
  const fresh = ids.filter((id) => !earned[id]);
  if (fresh.length === 0) return [];
  const day = istanbulToday();
  for (const id of fresh) earned[id] = day;
  await AsyncStorage.setItem(EARNED_KEY, JSON.stringify(earned)).catch(() => {});
  listeners.forEach((fn) => {
    try {
      fn(fresh);
    } catch {}
  });
  changeListeners.forEach((fn) => {
    try {
      fn();
    } catch {}
  });
  return fresh;
}

let checking = false;
// Cevap verince, selam gönderince, aktivite seçince çağrılır. Yeni rozet varsa kaydeder ve kutlama açtırır.
export async function checkBadges(): Promise<BadgeId[]> {
  if (checking) return [];
  checking = true;
  try {
    const answers = await readJson<Record<string, string>>(ANSWERS_KEY, {});
    const archive = await readJson<Record<string, string>>(ARCHIVE_KEY, {});
    const base = computePath(answers, istanbulToday(), await getPathLength(), archive);
    const earned = await readEarned();
    const now = await computeEarned(base, answers, archive, earned);
    const fresh = now.filter((id) => !earned[id]);
    if (fresh.length === 0) return [];
    const day = istanbulToday();
    for (const id of fresh) earned[id] = day;
    await AsyncStorage.setItem(EARNED_KEY, JSON.stringify(earned)).catch(() => {});
    // Aynı anda çok rozet çıkarsa (ör. güncellemeden sonra ilk açılış) en fazla 3 kutlama
    const show = fresh.slice(0, 3);
    listeners.forEach((fn) => {
      try {
        fn(show);
      } catch {}
    });
    changeListeners.forEach((fn) => {
      try {
        fn();
      } catch {}
    });
    return fresh;
  } finally {
    checking = false;
  }
}
