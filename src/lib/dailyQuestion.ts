// Günün Sorusu: veri işleri (Supabase) + "ne zaman gösterelim" kuralları.
// Ekran tarafı: src/components/DailyQuestionGate.tsx (sabah sorusu),
// src/components/DailyResultReveal.tsx (21:00 sonucu), src/components/StoryShareCard.tsx (paylaşım kartı)
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ensureSession, supabase } from '@/lib/supabase';
import type { Lang } from '@/lib/i18n';

export type DQOption = {
  key: string;
  tr: string;
  en?: string;
  club_tr?: string;
  club_en?: string;
};

export type DQTheme = 'navy' | 'amber' | 'cream';

export type DailyQuestion = {
  id: number;
  day_date: string; // 'YYYY-MM-DD' (İstanbul günü)
  series_day: number | null; // 30 Gün serisinde kaçıncı gün
  question_tr: string;
  question_en: string | null;
  question_ko?: string | null;
  options: DQOption[];
  theme?: DQTheme | null; // kartın renk teması
  art_svg?: string | null; // sorunun çizimi (SVG metni, Supabase'te duruyor)
};

export type DQResult = {
  scope: 'world' | 'country';
  total: number; // bu kapsamda kaç kişi cevapladı
  pct: Record<string, number>; // seçenek -> yüzde (0-100)
};

// Kart temaları: uygulamanın kendi renkleri
export const THEMES: Record<DQTheme, { bg: string; fg: string; soft: string; accent: string; line: string; chip: string }> = {
  navy: { bg: '#0F2A52', fg: '#FFFFFF', soft: 'rgba(255,255,255,0.78)', accent: '#FBBF24', line: 'rgba(255,255,255,0.16)', chip: 'rgba(255,255,255,0.12)' },
  amber: { bg: '#FBBF24', fg: '#0F2A52', soft: 'rgba(15,42,82,0.8)', accent: '#0F2A52', line: 'rgba(15,42,82,0.2)', chip: 'rgba(15,42,82,0.12)' },
  cream: { bg: '#FFF3E4', fg: '#0F2A52', soft: 'rgba(15,42,82,0.8)', accent: '#B45309', line: 'rgba(15,42,82,0.15)', chip: 'rgba(15,42,82,0.08)' },
};

export function themeOf(q: DailyQuestion): DQTheme {
  return q.theme === 'amber' || q.theme === 'cream' ? q.theme : 'navy';
}

// Telefonda tutulan küçük kayıtlar
const SKIP_DAY_KEY = 'dq_skip_day_v1'; // "Bugün geç" denen gün
const SNOOZE_UNTIL_KEY = 'dq_snooze_until_v1'; // "1 hafta sorma" bitiş zamanı (ms)
const ANSWERS_KEY = 'dq_answers_v1'; // { 'YYYY-MM-DD': 'a' } — telefondaki cevap geçmişi
const REVEALED_KEY = 'dq_revealed_v1'; // ['YYYY-MM-DD', ...] — sonucu gösterilmiş günler
const WELCOME_KEY = 'welcome_seen_v2'; // index.tsx'teki "Hoş geldin" kartı (ilk açılışta soru çıkmasın)

export const SERIES_LENGTH = 30;
const RESULT_HOUR = 21; // sonuçlar 21:00'de (İstanbul)
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_COUNTRY_TOTAL = 30; // ülkede en az bu kadar cevap varsa ülke sonucu, yoksa dünya sonucu

// ---- Değişiklik haberi: cevap verilince / sonuç görülünce alt banttaki nokta yenilensin
type Listener = () => void;
const listeners = new Set<Listener>();
export function onPollsChanged(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
function notifyPollsChanged() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {}
  });
}

const QUESTION_FIELDS = 'id, day_date, series_day, question_tr, question_en, question_ko, options, theme, art_svg';

// Türkiye saati yıl boyu UTC+3 (yaz saati yok)
export function istanbulToday(d: Date = new Date()): string {
  return new Date(d.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
export function istanbulYesterday(d: Date = new Date()): string {
  return istanbulToday(new Date(d.getTime() - DAY_MS));
}
export function istanbulHour(d: Date = new Date()): number {
  return (d.getUTCHours() + 3) % 24;
}
export function isBeforeResults(d: Date = new Date()): boolean {
  return istanbulHour(d) < RESULT_HOUR;
}

const MONTHS = {
  tr: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

// '2026-11-04' -> '4 Kasım' / 'November 4'
export function dayLabel(day: string, lang: Lang): string {
  const [, m, d] = day.split('-').map(Number);
  if ((lang as string) === 'tr') return `${d} ${MONTHS.tr[m - 1]}`;
  return `${MONTHS.en[m - 1]} ${d}`;
}

// Sorunun kullanıcının dilindeki metni. Yoksa null: o dilde soru hiç gösterilmez.
export function questionText(q: DailyQuestion, lang: Lang): string | null {
  const l = lang as string;
  if (l === 'tr') return q.question_tr;
  if (l === 'en') return q.question_en || null;
  const other = (q as unknown as Record<string, string | null | undefined>)[`question_${l}`];
  return other || null;
}

export function optionLabel(o: DQOption, lang: Lang): string {
  return (lang as string) === 'tr' ? o.tr : o.en || o.tr;
}

export function clubName(o: DQOption, lang: Lang): string | null {
  return ((lang as string) === 'tr' ? o.club_tr : o.club_en) || null;
}

async function fetchQuestionByDate(day: string): Promise<DailyQuestion | null> {
  if (!(await ensureSession())) return null;
  const { data, error } = await supabase
    .from('daily_questions')
    .select(QUESTION_FIELDS)
    .eq('day_date', day)
    .maybeSingle();
  if (error || !data) return null;
  return data as DailyQuestion;
}

// Bugünün sorusu (güvenlik kuralı yarının sorusunu zaten göstermez)
export async function fetchTodayQuestion(): Promise<DailyQuestion | null> {
  return fetchQuestionByDate(istanbulToday());
}

async function readLocalAnswers(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(ANSWERS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function saveLocalAnswer(day: string, optionKey: string) {
  const all = await readLocalAnswers();
  all[day] = optionKey;
  await AsyncStorage.setItem(ANSWERS_KEY, JSON.stringify(all)).catch(() => {});
}

// Bu soruya cevap verildi mi? Önce telefona, sonra sunucuya bakar (uygulama silinip kurulduysa).
export async function getMyAnswer(q: DailyQuestion): Promise<string | null> {
  const local = await readLocalAnswers();
  if (local[q.day_date]) return local[q.day_date];
  if (!(await ensureSession())) return null;
  const { data } = await supabase
    .from('daily_answers')
    .select('option_key')
    .eq('question_id', q.id)
    .maybeSingle();
  const key = (data as { option_key?: string } | null)?.option_key ?? null;
  if (key) await saveLocalAnswer(q.day_date, key);
  return key;
}

async function readProfile(): Promise<{ country: string | null; age: string | null }> {
  try {
    const [rawProfile, consent] = await Promise.all([
      AsyncStorage.getItem('profile'),
      AsyncStorage.getItem('consent'),
    ]);
    if (consent === 'yes' && rawProfile) {
      const p = JSON.parse(rawProfile) as { country?: string; age?: string };
      return { country: p.country ?? null, age: p.age ?? null };
    }
  } catch {}
  return { country: null, age: null };
}

// Sonuç ekranı için: sunucudaki kayıtlı cevap esas (sayım ona göre yapıldı). Bağlantı yoksa telefondaki.
async function getServerAnswer(q: DailyQuestion): Promise<string | null> {
  if (await ensureSession()) {
    const { data, error } = await supabase
      .from('daily_answers')
      .select('option_key')
      .eq('question_id', q.id)
      .maybeSingle();
    const key = (data as { option_key?: string } | null)?.option_key ?? null;
    if (!error) {
      if (key) await saveLocalAnswer(q.day_date, key);
      return key;
    }
  }
  return (await readLocalAnswers())[q.day_date] ?? null;
}

// Cevabı gönder. Ülke ve yaş sadece kullanıcı profil iznini verdiyse eklenir.
// Dönen değer: sunucuda kayıtlı cevap (ilk cevap geçerlidir). Hata olursa null.
export async function submitAnswer(q: DailyQuestion, optionKey: string, lang: Lang): Promise<string | null> {
  if (!(await ensureSession())) return null;
  const { country, age } = await readProfile();

  const { error } = await supabase.from('daily_answers').insert({
    question_id: q.id,
    option_key: optionKey,
    country,
    age_range: age,
    lang,
  });

  if (error && error.code !== '23505') return null;

  let saved = optionKey;
  if (error) {
    // 23505 = bu soruya daha önce cevap verilmiş. Sunucudaki ilk cevap geçerli; telefonu ona eşitle.
    const { data } = await supabase
      .from('daily_answers')
      .select('option_key')
      .eq('question_id', q.id)
      .maybeSingle();
    saved = (data as { option_key?: string } | null)?.option_key ?? optionKey;
  }
  await saveLocalAnswer(q.day_date, saved);
  notifyPollsChanged();
  return saved;
}

type ResultRow = { question_id: number; scope: string; option_key: string; total: number; pct: number | string };

// Bir sorunun satırlarından gösterilecek sonucu seç: ülkede yeterli cevap varsa ülke, yoksa dünya.
function pickResult(q: DailyQuestion, rows: ResultRow[]): DQResult | null {
  const local = rows.filter((r) => r.scope !== 'world');
  const world = rows.filter((r) => r.scope === 'world');
  const useLocal = local.length > 0 && Number(local[0].total) >= MIN_COUNTRY_TOTAL;
  const chosen = useLocal ? local : world;
  if (chosen.length === 0) return null;
  const pct: Record<string, number> = {};
  for (const o of q.options) pct[o.key] = 0;
  for (const r of chosen) pct[r.option_key] = Number(r.pct) || 0;
  return { scope: useLocal ? 'country' : 'world', total: Number(chosen[0].total) || 0, pct };
}

// 21:00 sonucu. Sonuç henüz yoksa null.
export async function fetchResults(q: DailyQuestion): Promise<DQResult | null> {
  if (!(await ensureSession())) return null;
  const { country } = await readProfile();
  const scopes = country ? ['world', `country:${country}`] : ['world'];
  const { data, error } = await supabase
    .from('daily_results')
    .select('question_id, scope, option_key, total, pct')
    .eq('question_id', q.id)
    .in('scope', scopes);
  if (error || !data || data.length === 0) return null;
  return pickResult(q, data as ResultRow[]);
}

// ---------------------------------------------------------------- Anketler sekmesi
export const SERIES_START = '2026-11-01';

// Anketler sekmesi görünsün mü? Sadece soruların çevirisi olan dillerde ve seri başladıktan sonra.
// Geliştirme sürümünde (Expo Go) her zaman görünür.
export function pollsVisible(lang: Lang): boolean {
  const l = lang as string;
  if (l !== 'tr' && l !== 'en') return false;
  return __DEV__ || istanbulToday() >= SERIES_START;
}

export type PollItem = {
  question: DailyQuestion;
  myKey: string | null;
  result: DQResult | null;
};

// Bugün ve geçmiş günlerin soruları, kullanıcının cevapları ve sonuçlar (yeniden eskiye).
export async function fetchPollHistory(lang: Lang): Promise<PollItem[]> {
  if (!(await ensureSession())) return [];
  const { data: qData, error } = await supabase
    .from('daily_questions')
    .select(QUESTION_FIELDS)
    .lte('day_date', istanbulToday())
    .order('day_date', { ascending: false })
    .limit(60);
  if (error || !qData) return [];
  const questions = (qData as DailyQuestion[]).filter((q) => !!questionText(q, lang));
  if (questions.length === 0) return [];
  const ids = questions.map((q) => q.id);

  const { country } = await readProfile();
  const scopes = country ? ['world', `country:${country}`] : ['world'];
  const [ansRes, resRes] = await Promise.all([
    supabase.from('daily_answers').select('question_id, option_key').in('question_id', ids),
    supabase
      .from('daily_results')
      .select('question_id, scope, option_key, total, pct')
      .in('question_id', ids)
      .in('scope', scopes),
  ]);

  const local = await readLocalAnswers();
  const answers = new Map<number, string>();
  for (const r of (ansRes.data ?? []) as { question_id: number; option_key: string }[]) {
    answers.set(r.question_id, r.option_key);
  }
  const resultRows = (resRes.data ?? []) as ResultRow[];

  const items: PollItem[] = [];
  for (const q of questions) {
    let myKey = answers.get(q.id) ?? null;
    if (!myKey && ansRes.error) myKey = local[q.day_date] ?? null; // bağlantı sorunu: telefondakini kullan
    if (myKey && local[q.day_date] !== myKey) await saveLocalAnswer(q.day_date, myKey);
    const rows = resultRows.filter((r) => r.question_id === q.id);
    items.push({ question: q, myKey, result: rows.length ? pickResult(q, rows) : null });
  }
  return items;
}

async function readRevealed(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(REVEALED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function markRevealed(day: string) {
  const list = (await readRevealed()).filter((d) => d !== day);
  list.push(day);
  await AsyncStorage.setItem(REVEALED_KEY, JSON.stringify(list.slice(-60))).catch(() => {});
  notifyPollsChanged();
}

// Alt banttaki Anketler sekmesinde sarı nokta görünsün mü?
// 21:00'den önce: bugünün sorusu cevaplanmadıysa. 21:00'den sonra: cevaplandı ama sonuca bakılmadıysa.
export async function pollsBadge(lang: Lang): Promise<boolean> {
  try {
    if (!pollsVisible(lang)) return false;
    const day = istanbulToday();
    const local = await readLocalAnswers();
    const answered = !!local[day];
    if (isBeforeResults()) {
      if (answered) return false;
      const q = await fetchTodayQuestion();
      return !!q && !!questionText(q, lang);
    }
    if (!answered) return false;
    return !(await readRevealed()).includes(day);
  } catch {
    return false;
  }
}

export type PendingReveal = {
  question: DailyQuestion;
  myKey: string;
  result: DQResult;
  isYesterday: boolean;
};

// Gösterilmeyi bekleyen sonuç var mı?
// 21:00'den sonra: bugünün sonucu. 21:00'den önce: dünün sonucu (akşam bakmadıysa).
// Sadece cevap verilmiş, kullanıcının dilinde metni olan ve sonucu hesaplanmış sorular.
// force: deneme modunda saat ve "gösterildi" kaydına bakmadan bugünün sonucunu getirir.
export async function findPendingReveal(lang: Lang, force = false): Promise<PendingReveal | null> {
  try {
    const after = !isBeforeResults();
    const day = force || after ? istanbulToday() : istanbulYesterday();
    if (!force && (await readRevealed()).includes(day)) return null;
    const q = await fetchQuestionByDate(day);
    if (!q || !questionText(q, lang)) return null;
    const myKey = await getServerAnswer(q);
    if (!myKey) return null;
    const result = await fetchResults(q);
    if (!result) return null;
    return { question: q, myKey, result, isYesterday: day !== istanbulToday() };
  } catch {
    return null;
  }
}

// Seri: bugünden (ya da bugün cevap yoksa dünden) geriye kesintisiz gün sayısı
export async function getStreak(): Promise<number> {
  const all = await readLocalAnswers();
  let cursor = Date.now();
  if (!all[istanbulToday(new Date(cursor))]) cursor -= DAY_MS;
  let count = 0;
  while (all[istanbulToday(new Date(cursor))]) {
    count++;
    cursor -= DAY_MS;
  }
  return count;
}

export async function skipToday() {
  await AsyncStorage.setItem(SKIP_DAY_KEY, istanbulToday()).catch(() => {});
}

export async function snoozeWeek() {
  await AsyncStorage.setItem(SNOOZE_UNTIL_KEY, String(Date.now() + WEEK_MS)).catch(() => {});
}

// Giriş ekranında soru gösterilsin mi? (soru verisinden önceki hızlı kontroller)
export async function gateAllowedToday(): Promise<boolean> {
  try {
    if (!isBeforeResults()) return false; // 21:00'den sonra soru yok, sadece sonuç
    const [welcome, skipDay, snooze] = await Promise.all([
      AsyncStorage.getItem(WELCOME_KEY),
      AsyncStorage.getItem(SKIP_DAY_KEY),
      AsyncStorage.getItem(SNOOZE_UNTIL_KEY),
    ]);
    if (welcome !== '1') return false; // ilk açılışta önce "Hoş geldin" kartı görünsün
    if (skipDay === istanbulToday()) return false;
    if (snooze && Date.now() < Number(snooze)) return false;
    return true;
  } catch {
    return false;
  }
}
