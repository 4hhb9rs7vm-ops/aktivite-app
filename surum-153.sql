-- 1.5.3: Uygulama ayarlarına "Diğerleri ne yapıyor?" eşiği eklendi (others_min).
-- Eşiği değiştirmek için v_others_min'i değiştirip bu dosyayı yeniden çalıştır; build gerekmez.
create or replace function public.get_app_flags()
returns json
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_min int := 6;              -- Ülke filtresi: bir ülkede en az kaç kişi
  v_countries int := 2;        -- Ülke filtresi: en az kaç ülke
  v_force boolean := null;     -- Ülke filtresi: true = hep açık, false = hep kapalı, null = kurala göre
  v_others_min int := 11;      -- "Diğerleri ne yapıyor?" hapı: en az kaç kişi (6'nın altına inmez)
  v_ok int;
  v_country boolean;
begin
  if v_force is not null then
    v_country := v_force;
  else
    select count(*) into v_ok from (
      select country
        from public.presence
       where coalesce(country, '') <> ''
         and started_at > now() - interval '24 hours'
       group by country
      having count(distinct user_id) >= v_min
    ) t;
    v_country := coalesce(v_ok, 0) >= v_countries;
  end if;
  return json_build_object('country_filter', v_country, 'others_min', v_others_min);
end $$;

revoke all on function public.get_app_flags() from public, anon;
grant execute on function public.get_app_flags() to authenticated;

select public.get_app_flags();
