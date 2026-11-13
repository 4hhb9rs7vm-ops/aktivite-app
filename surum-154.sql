-- 1.5.4: Tahmin Oyunu (Günün Sorusu)
-- 1) Tahminler: kişi başına soru başına bir tahmin, sadece o günün sorusuna ve 21:00'den önce
create table if not exists public.dq_predictions (
  user_id uuid not null default auth.uid(),
  question_id bigint not null,
  option_key text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, question_id)
);
create index if not exists dq_predictions_q on public.dq_predictions (question_id);

alter table public.dq_predictions enable row level security;

drop policy if exists tahmin_ekle on public.dq_predictions;
create policy tahmin_ekle on public.dq_predictions for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.daily_questions q
     where q.id = question_id
       and q.day_date = (now() at time zone 'Europe/Istanbul')::date
       and extract(hour from now() at time zone 'Europe/Istanbul') < 21
  )
);

drop policy if exists tahmin_oku on public.dq_predictions;
create policy tahmin_oku on public.dq_predictions for select to authenticated
using (user_id = auth.uid());

-- 2) Bir haftanın puan özeti (tek kişi için). Puan: çoğunluğu bilirse 10, bilemezse 1.
--    Yüzdelik ve rozet: o hafta en az 3 tahmini puanlanan en az v_min kişi varsa.
create or replace function public.prediction_week_json(p_uid uuid, p_week date)
returns json
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_min int := 30;
  v_now timestamp := now() at time zone 'Europe/Istanbul';
  v_today date := v_now::date;
  v_points int := 0;
  v_hits int := 0;
  v_count int := 0;
  v_n int := 0;
  v_below int := 0;
  v_beat int;
  v_top10 int;
begin
  with mx as (
    select question_id, max(pct::numeric) as m
      from public.daily_results
     where scope = 'world'
     group by question_id
  ),
  scored as (
    select p.user_id,
           exists (
             select 1 from public.daily_results r
              where r.question_id = p.question_id and r.scope = 'world'
                and r.option_key = p.option_key and r.pct::numeric = mx.m
           ) as hit
      from public.dq_predictions p
      join public.daily_questions q on q.id = p.question_id
      join mx on mx.question_id = p.question_id
     where q.day_date >= p_week and q.day_date < p_week + 7
       and (q.day_date < v_today or extract(hour from v_now) >= 21)
  ),
  agg as (
    select user_id,
           sum(case when hit then 10 else 1 end)::int as points,
           (count(*) filter (where hit))::int as hits,
           count(*)::int as cnt
      from scored
     group by user_id
  ),
  me as (select * from agg where user_id = p_uid)
  select coalesce((select points from me), 0),
         coalesce((select hits from me), 0),
         coalesce((select cnt from me), 0),
         (select count(*) from agg where cnt >= 3),
         (select count(*) from agg where cnt >= 3 and points < coalesce((select points from me), 0)),
         (select percentile_disc(0.9) within group (order by points) from agg where cnt >= 3)
    into v_points, v_hits, v_count, v_n, v_below, v_top10;

  if v_n >= v_min and v_count >= 3 then
    v_beat := round(100.0 * v_below / v_n);
  end if;

  return json_build_object(
    'week', p_week,
    'points', v_points,
    'hits', v_hits,
    'count', v_count,
    'participants', v_n,
    'beat', v_beat,
    'top10', case when v_n >= v_min then v_top10 end,
    'badge', coalesce(v_beat >= 90, false)
  );
end $$;

revoke all on function public.prediction_week_json(uuid, date) from public, anon, authenticated;

-- 3) Rozet puanları: uygulama kazanılan rozetleri buraya yazar (rozet başına bir kez)
create table if not exists public.user_badges (
  user_id uuid not null default auth.uid(),
  badge_id text not null,
  earned_on date not null default ((now() at time zone 'Europe/Istanbul')::date),
  created_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);
alter table public.user_badges enable row level security;

drop policy if exists rozet_ekle on public.user_badges;
create policy rozet_ekle on public.user_badges for insert to authenticated
with check (
  user_id = auth.uid()
  and badge_id ~ '^[a-z0-9_]{2,40}$'
  and earned_on between date '2026-10-01' and ((now() at time zone 'Europe/Istanbul')::date)
);
drop policy if exists rozet_oku on public.user_badges;
create policy rozet_oku on public.user_badges for select to authenticated
using (user_id = auth.uid());

-- 4) Puan defteri: kişinin kazandığı tüm puanlar. 1 Kasım 2026'dan itibaren.
--    Günün Sorusu +5 · günün ilk anı +5 · tahmin tuttu +10 / tutmadı +1
--    Seri (an seçtiği ya da soruyu cevapladığı ardışık günler): 3. gün +10, 7. gün +30, 14. gün +50, 30. gün +100
--    Rozet: seri rozetleri +50, diğerleri +25
--    info / info_en: listede alt satır (an: "aktivite|saat", soru ve tahmin: soru metni)
drop function if exists public.points_ledger(uuid);
create function public.points_ledger(p_uid uuid)
returns table(day date, kind text, ref text, points int, info text, info_en text)
language sql
stable
security definer
set search_path to 'public'
as $$
  with params as (
    select date '2026-11-01' as start_day,
           (now() at time zone 'Europe/Istanbul') as now_ist
  ),
  q_answers as (
    select q.day_date as day, q.question_tr, q.question_en
      from public.daily_answers a
      join public.daily_questions q on q.id = a.question_id, params
     where a.user_id = p_uid and q.day_date >= params.start_day
  ),
  moments as (
    select distinct on (e.day) e.day,
           coalesce(e.props->>'id', '') || '|' || to_char(e.created_at at time zone 'Europe/Istanbul', 'HH24:MI') as info
      from public.app_events e, params
     where e.user_id = p_uid and e.event = 'activity_pick' and e.day >= params.start_day
     order by e.day, e.created_at
  ),
  active as (
    select day from q_answers union select day from moments
  ),
  islands as (
    select day, day - (row_number() over (order by day))::int as grp from active
  ),
  streaks as (
    select day, row_number() over (partition by grp order by day) as n from islands
  ),
  mx as (
    select question_id, max(pct::numeric) as m
      from public.daily_results where scope = 'world' group by question_id
  ),
  guesses as (
    select q.day_date as day, q.question_tr, q.question_en,
           exists (
             select 1 from public.daily_results r
              where r.question_id = p.question_id and r.scope = 'world'
                and r.option_key = p.option_key and r.pct::numeric = mx.m
           ) as hit
      from public.dq_predictions p
      join public.daily_questions q on q.id = p.question_id
      join mx on mx.question_id = p.question_id, params
     where p.user_id = p_uid
       and (q.day_date < params.now_ist::date or extract(hour from params.now_ist) >= 21)
  )
  select day, 'question', null::text, 5, question_tr, question_en from q_answers
  union all
  select day, 'moment', null, 5, info, info from moments
  union all
  select day, case when hit then 'guess_hit' else 'guess_miss' end, null, case when hit then 10 else 1 end,
         question_tr, question_en
    from guesses
  union all
  select day, 'streak', n::text,
         case n when 3 then 10 when 7 then 30 when 14 then 50 when 30 then 100 end, null, null
    from streaks where n in (3, 7, 14, 30)
  union all
  select earned_on, 'badge', badge_id, case when badge_id like 'tier\_%' then 50 else 25 end, null, null
    from public.user_badges where user_id = p_uid
$$;
revoke all on function public.points_ledger(uuid) from public, anon, authenticated;

-- 5) Uygulamanın çağırdığı: puan paneli için her şey tek seferde
create or replace function public.get_prediction_week()
returns json
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Europe/Istanbul')::date;
  v_week date := date_trunc('week', v_today)::date;
  v_month date := date_trunc('month', v_today)::date;
  v_wk int; v_lw int; v_mo int; v_all int;
  v_hist json; v_days json; v_kinds json;
  v_streak int := 0;
  v_rows json;
begin
  if v_uid is null then
    return json_build_object('error', 'auth');
  end if;

  -- Defter bir kez hesaplanır, aşağıda json'dan okunur
  select coalesce(json_agg(l), '[]'::json) into v_rows from public.points_ledger(v_uid) l;

  select coalesce(sum(points) filter (where day >= v_week), 0)::int,
         coalesce(sum(points) filter (where day >= v_week - 7 and day < v_week), 0)::int,
         coalesce(sum(points) filter (where day >= v_month), 0)::int,
         coalesce(sum(points), 0)::int
    into v_wk, v_lw, v_mo, v_all
    from json_to_recordset(v_rows) as x(day date, kind text, ref text, points int, info text, info_en text);

  -- Bu haftanın günleri (pazartesi..pazar)
  select json_agg(coalesce(t.p, 0) order by g.d)
    into v_days
    from generate_series(v_week, v_week + 6, interval '1 day') g(d)
    left join (select day, sum(points)::int as p from json_to_recordset(v_rows) as x(day date, kind text, ref text, points int, info text, info_en text) group by day) t on t.day = g.d::date;

  -- Puanların nereden geldiği
  select json_build_object(
           'moment', coalesce(sum(points) filter (where kind = 'moment'), 0),
           'question', coalesce(sum(points) filter (where kind = 'question'), 0),
           'guess', coalesce(sum(points) filter (where kind in ('guess_hit', 'guess_miss')), 0),
           'streak', coalesce(sum(points) filter (where kind = 'streak'), 0),
           'badge', coalesce(sum(points) filter (where kind = 'badge'), 0))
    into v_kinds
    from json_to_recordset(v_rows) as x(day date, kind text, ref text, points int, info text, info_en text);

  -- Şu anki seri: bugün ya da dün biten ardışık aktif günler
  with act as (
    select distinct day from json_to_recordset(v_rows) as x(day date, kind text, ref text, points int, info text, info_en text) where kind in ('question', 'moment')
  ),
  isl as (
    select day, day - (row_number() over (order by day))::int as grp from act
  ),
  g as (
    select grp, max(day) as last_day, count(*)::int as n from isl group by grp
  )
  select coalesce(max(n), 0) into v_streak from g where last_day >= v_today - 1;

  select coalesce(json_agg(json_build_object('day', day, 'kind', kind, 'ref', ref, 'points', points,
                                             'info', info, 'info_en', info_en)
                           order by day desc, points desc), '[]'::json)
    into v_hist
    from (select * from json_to_recordset(v_rows) as x(day date, kind text, ref text, points int, info text, info_en text) order by day desc, points desc limit 40) h;

  return json_build_object(
    'current', public.prediction_week_json(v_uid, v_week),
    'last', public.prediction_week_json(v_uid, v_week - 7),
    'week_total', v_wk,
    'last_week_total', v_lw,
    'month_total', v_mo,
    'all_total', v_all,
    'days', v_days,
    'by_kind', v_kinds,
    'streak', v_streak,
    'history', v_hist
  );
end $$;

revoke all on function public.get_prediction_week() from public, anon;
grant execute on function public.get_prediction_week() to authenticated;

-- 6) Ölçüm olayları: prediction_made, prediction_sheet, prediction_week, points_moment
--    (önceki 1.5.4 SQL'i çalıştırıldıysa sadece points_moment eklenir)
do $$
declare
  v_check text;
  v_roles text;
begin
  select with_check, array_to_string(roles, ', ')
    into v_check, v_roles
    from pg_policies
   where schemaname = 'public' and tablename = 'app_events' and policyname = 'olay_ekleme';
  if v_check is null then
    raise exception 'olay_ekleme kuralı bulunamadı';
  end if;
  if position('points_moment' in v_check) > 0 then
    raise notice 'zaten ekli';
    return;
  end if;
  if position('prediction_week' in v_check) > 0 then
    v_check := replace(v_check, '''prediction_week''::text', '''prediction_week''::text, ''points_moment''::text');
  else
    v_check := replace(v_check, '''campus_lock''::text',
      '''campus_lock''::text, ''prediction_made''::text, ''prediction_sheet''::text, ''prediction_week''::text, ''points_moment''::text');
  end if;
  if position('points_moment' in v_check) = 0 then
    raise exception 'campus_lock bulunamadı, kural değiştirilmedi';
  end if;
  execute 'drop policy olay_ekleme on public.app_events';
  execute format('create policy olay_ekleme on public.app_events for insert to %s with check (%s)', v_roles, v_check);
end $$;

-- Kontrol (hata vermemeli; giriş yapılmadığı için {"error":"auth"} döner)
select public.get_prediction_week();
