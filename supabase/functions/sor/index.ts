// Supabase Edge Function: "sor"
// Uygulama iki iş için çağırır:
//   { action: 'ask', friendId }  → arkadaşa "Şu an ne yapıyorsun?" bildirimi
//   { action: 'answer' }         → soru almış kişi aktivite seçti, soranlara "cevap verdi" bildirimi
// Bildirimler Expo'nun ücretsiz bildirim servisiyle gider.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const PAIR_COOLDOWN_H = 4; // aynı kişiye 4 saatte bir
const DAILY_LIMIT = 3; // bir kişi 24 saatte en fazla 3 soru alır
const ANSWER_WINDOW_H = 3; // 3 saat içinde seçilen aktivite "cevap" sayılır
const QUIET_FROM = 23; // karşı tarafın yerel saatiyle 23:00-09:00 arası soru gitmez
const QUIET_TO = 9;

const TEXT = {
  tr: {
    askBody: (n: string) => `${n} soruyor: Şu an ne yapıyorsun? 👀`,
    answerBody: (n: string) => `${n} cevap verdi. Ne yaptığını gör 👀`,
  },
  en: {
    askBody: (n: string) => `${n} is asking: What are you doing right now? 👀`,
    answerBody: (n: string) => `${n} answered. See what they're up to 👀`,
  },
};

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

function reply(result: string, status = 200) {
  return new Response(JSON.stringify({ result }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function localHour(tzOffsetMin: number): number {
  const d = new Date(Date.now() + tzOffsetMin * 60 * 1000);
  return d.getUTCHours();
}

function isQuiet(tzOffsetMin: number): boolean {
  const h = localHour(tzOffsetMin);
  return h >= QUIET_FROM || h < QUIET_TO;
}

type Token = { user_id: string; token: string; tz_offset: number; lang: string };

async function getToken(userId: string): Promise<Token | null> {
  const { data } = await admin
    .from('push_tokens')
    .select('user_id, token, tz_offset, lang')
    .eq('user_id', userId)
    .maybeSingle();
  return (data as Token) ?? null;
}

async function displayName(userId: string): Promise<string> {
  const { data } = await admin.from('friend_profiles').select('display_name').eq('user_id', userId).maybeSingle();
  return (data?.display_name as string) || 'Bir arkadaşın';
}

async function areFriends(a: string, b: string): Promise<boolean> {
  const { data } = await admin
    .from('friendships')
    .select('user_a')
    .or(`and(user_a.eq.${a},user_b.eq.${b}),and(user_a.eq.${b},user_b.eq.${a})`)
    .limit(1);
  return !!data && data.length > 0;
}

// Expo'ya gönder. Cihaz artık kayıtlı değilse adresi sil ve false dön.
async function push(t: Token, body: string, type: string): Promise<boolean> {
  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        to: t.token,
        title: 'Şu An',
        body,
        sound: 'default',
        channelId: 'sor',
        priority: 'high',
        data: { type },
      }),
    });
    const json = await res.json().catch(() => null);
    const ticket = json?.data;
    if (ticket?.status === 'error') {
      if (ticket?.details?.error === 'DeviceNotRegistered') {
        await admin.from('push_tokens').delete().eq('user_id', t.user_id);
      }
      return false;
    }
    return res.ok;
  } catch {
    return false;
  }
}

async function handleAsk(me: string, friendId: unknown): Promise<Response> {
  if (typeof friendId !== 'string' || friendId === me || !/^[0-9a-f-]{36}$/i.test(friendId)) {
    return reply('not_friend');
  }
  if (!(await areFriends(me, friendId))) return reply('not_friend');

  const { data: prof } = await admin
    .from('friend_profiles')
    .select('allow_asks, invisible')
    .eq('user_id', friendId)
    .maybeSingle();
  if (!prof || prof.allow_asks === false || prof.invisible === true) return reply('off');

  const since4h = new Date(Date.now() - PAIR_COOLDOWN_H * 3600 * 1000).toISOString();
  const { count: pairCount } = await admin
    .from('asks')
    .select('id', { count: 'exact', head: true })
    .eq('from_user', me)
    .eq('to_user', friendId)
    .gte('created_at', since4h);
  if ((pairCount ?? 0) > 0) return reply('cooldown');

  const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count: dayCount } = await admin
    .from('asks')
    .select('id', { count: 'exact', head: true })
    .eq('to_user', friendId)
    .gte('created_at', since24h);
  if ((dayCount ?? 0) >= DAILY_LIMIT) return reply('limit');

  const token = await getToken(friendId);
  if (!token) return reply('no_device');
  if (isQuiet(token.tz_offset)) return reply('quiet');

  const name = await displayName(me);
  const tx = token.lang === 'tr' ? TEXT.tr : TEXT.en;
  const ok = await push(token, tx.askBody(name), 'ask');
  if (!ok) return reply('no_device');

  await admin.from('asks').insert({ from_user: me, to_user: friendId });
  return reply('ok');
}

async function handleAnswer(me: string): Promise<Response> {
  const since = new Date(Date.now() - ANSWER_WINDOW_H * 3600 * 1000).toISOString();
  const { data: open } = await admin
    .from('asks')
    .select('id, from_user')
    .eq('to_user', me)
    .is('answered_at', null)
    .gte('created_at', since);
  if (!open || open.length === 0) return reply('none');

  await admin
    .from('asks')
    .update({ answered_at: new Date().toISOString() })
    .in(
      'id',
      open.map((r) => r.id),
    );

  const name = await displayName(me);
  const askers = [...new Set(open.map((r) => r.from_user as string))];
  for (const asker of askers) {
    if (!(await areFriends(me, asker))) continue; // bu arada arkadaşlıktan çıkarılmış olabilir
    const token = await getToken(asker);
    if (!token || isQuiet(token.tz_offset)) continue;
    const tx = token.lang === 'tr' ? TEXT.tr : TEXT.en;
    await push(token, tx.answerBody(name), 'ask_answer');
  }
  return reply('ok');
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply('method', 405);
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: auth } = await admin.auth.getUser(jwt);
  const me = auth?.user?.id;
  if (!me) return reply('auth', 401);

  let body: any = {};
  try {
    body = await req.json();
  } catch {}

  if (body?.action === 'ask') return handleAsk(me, body.friendId);
  if (body?.action === 'answer') return handleAnswer(me);
  return reply('bad_request', 400);
});
