// Ölçüm: uygulamadaki önemli anları Supabase'teki app_events tablosuna yazar.
// - Kişisel veri yok: anonim kullanıcı kimliği + olay adı + birkaç küçük bilgi.
// - Olaylar biriktirilip birkaç saniyede bir toplu gönderilir; hata olursa uygulamayı asla bozmaz.
// - Expo Go'daki denemeler app_version = 'dev' olarak yazılır ve raporlara karışmaz.
// Kullanım: track('question_answered', { day: '2026-11-04', option: 'c' })
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import { ensureSession, supabase } from '@/lib/supabase';
import { loadLang } from '@/lib/i18n';

export type EventName =
  | 'app_open'
  | 'activity_pick'
  | 'activity_share'
  | 'question_shown'
  | 'question_answered'
  | 'question_skipped'
  | 'question_snoozed'
  | 'result_shown'
  | 'result_opened'
  | 'story_shared'
  | 'polls_tab_open'
  | 'notif_open'
  | 'selam_sent'
  | 'selam_seen'
  | 'badges_tab_open'
  | 'badge_earned'
  | 'badge_shared'
  | 'ask_sent'
  | 'ask_setting'
  | 'ask_tap'
  | 'invite_created'
  | 'invite_shared'
  | 'invite_request'
  | 'invite_decided'
  | 'invite_link_open'
  | 'app_share'
  | 'insta_tip_shown'
  | 'archive_answered'
  | 'student_prompt'
  | 'campus_picked'
  | 'campus_lock'
  | 'others_open';

type Props = Record<string, string | number | boolean | null>;

type Row = {
  event: EventName;
  props: Props;
  platform: string;
  app_version: string;
  lang: string | null;
  created_at: string;
};

const APP_VERSION = __DEV__ ? 'dev' : Constants.expoConfig?.version ?? 'unknown';
const FLUSH_DELAY_MS = 4000;
const MAX_QUEUE = 200;
const SESSION_GAP_MS = 30 * 60 * 1000; // 30 dk arka planda kaldıysa yeni "açılış" sayılır

let queue: Row[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;
let langCache: string | null = null;

export function track(event: EventName, props: Props = {}) {
  try {
    queue.push({
      event,
      props,
      platform: Platform.OS,
      app_version: APP_VERSION,
      lang: langCache,
      created_at: new Date().toISOString(),
    });
    if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
    if (!timer) timer = setTimeout(flush, FLUSH_DELAY_MS);
  } catch {}
}

async function flush() {
  timer = null;
  if (flushing || queue.length === 0) return;
  flushing = true;
  const batch = queue;
  queue = [];
  try {
    if (!langCache) langCache = ((await loadLang()) as string) ?? null;
    if (!(await ensureSession())) throw new Error('no session');
    const rows = batch.map((r) => ({ ...r, lang: r.lang ?? langCache }));
    const { error } = await supabase.from('app_events').insert(rows);
    if (error) throw error;
  } catch {
    // Gönderilemedi: bir sonraki denemede tekrar (sınırlı sayıda)
    queue = [...batch, ...queue].slice(-MAX_QUEUE);
    if (!timer) timer = setTimeout(flush, FLUSH_DELAY_MS * 4);
  } finally {
    flushing = false;
  }
}

// _layout.tsx'ten bir kez çağrılır: açılışı kaydeder, arka plandan dönüşleri izler,
// uygulama arka plana giderken bekleyenleri hemen gönderir.
let started = false;
let backgroundAt: number | null = null;
export function startAnalytics() {
  if (started) return;
  started = true;
  loadLang()
    .then((l) => {
      langCache = (l as string) ?? null;
    })
    .catch(() => {});
  track('app_open', { cold: true });
  AppState.addEventListener('change', (s) => {
    if (s === 'active') {
      if (backgroundAt && Date.now() - backgroundAt > SESSION_GAP_MS) track('app_open', { cold: false });
      backgroundAt = null;
    } else if (s === 'background') {
      backgroundAt = Date.now();
      if (timer) clearTimeout(timer);
      flush();
    }
  });
}
