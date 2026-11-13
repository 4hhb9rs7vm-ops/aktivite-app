-- 1.5.4 (26) düzeltme: seri tüm geçmişe bakar (uygulamadaki "X günlük seri" ile aynı sayı)
-- Aktif gün = o gün an seçti ya da Günün Sorusu'nu cevapladı (İstanbul günü)
create or replace function public.active_days(p_uid uuid)
returns table(day date)
language sql
stable
security definer
set search_path to 'public'
as $$
  select q.day_date
    from public.daily_answers a
    join public.daily_questions q on q.id = a.question_id
   where a.user_id = p_uid
  union
  select e.day
    from public.app_events e
   where e.user_id = p_uid and e.event = 'activity_pick' and e.day is not null
$$;
revoke all on function public.active_days(uuid) from public, anon, authenticated;

-- 4) Puan defteri: kişinin kazandığı tüm puanlar. 1 Kasım 2026'dan itibaren.
--    Günün Sorusu +5 · günün ilk anı +5 · tahmin tuttu +10 / tutmadı +1
--    Seri (an seçtiği ya da soruyu cevapladığı ardışık günler): 3. gün +10, 7. gün +30, 14. gün +50, 30. gün +100
--    Rozet: seri rozetleri +50, diğerleri +25
--    info / info_en: listede alt satır (an: "aktivite|saat", soru ve tahmin: soru metni)
create or replace function public.points_ledger(p_uid uuid)
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
    -- Seri tüm geçmişe bakar (uygulamadaki "X günlük seri" ile aynı); bonus puan 1 Kasım'dan itibaren verilir
    select day from public.active_days(p_uid)
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
    from streaks, params where n in (3, 7, 14, 30) and day >= params.start_day
  union all
  select earned_on, 'badge', badge_id, case when badge_id like 'tier\_%' then 50 else 25 end, null, null
    from public.user_badges where user_id = p_uid and badge_id <> 'bonus_welcome'
  union all
  -- 1.5.4 (26): yeni kullanıcıya hoş geldin puanı (Anketler'e ilk girişte uygulama yazar)
  select earned_on, 'welcome', null, 50, null, null
    from public.user_badges where user_id = p_uid and badge_id = 'bonus_welcome'
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
           'badge', coalesce(sum(points) filter (where kind = 'badge'), 0),
           'welcome', coalesce(sum(points) filter (where kind = 'welcome'), 0))
    into v_kinds
    from json_to_recordset(v_rows) as x(day date, kind text, ref text, points int, info text, info_en text);

  -- Şu anki seri: bugün ya da dün biten ardışık aktif günler
  with act as (
    select day from public.active_days(v_uid)
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

-- Kontrol (hata vermemeli; giriş yapılmadığı için {"error":"auth"} döner)
select public.get_prediction_week();
