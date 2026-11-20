-- Дни рождения: только день и месяц (без года), в приватной таблице. anon доступа нет совсем.
drop function if exists public.clan_events_on(date);
drop table if exists public.member_birthdays;

create table if not exists public.member_private (
  member_id bigint primary key references public.members(id) on delete cascade,
  birth_day smallint check (birth_day between 1 and 31),
  birth_month smallint check (birth_month between 1 and 12),
  check ((birth_day is null) = (birth_month is null))
);
alter table public.member_private enable row level security;
drop policy if exists member_private_admin on public.member_private;
create policy member_private_admin on public.member_private for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.member_private from anon;
grant select, insert, update, delete on public.member_private to authenticated;

-- День рождения из анкеты Discord (таблица доступна только Edge Functions)
alter table public.discord_registrations add column if not exists birth_day smallint, add column if not exists birth_month smallint;

-- анкета -> участник сайта (по discord_id); пустое значение в анкете ничего не стирает
create or replace function public.sync_birthday_from_reg(p_discord_id text) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into member_private(member_id, birth_day, birth_month)
  select m.id, r.birth_day, r.birth_month from members m join discord_registrations r on r.discord_id = m.discord_id
   where m.discord_id = p_discord_id and r.birth_day is not null
  on conflict (member_id) do update set birth_day = excluded.birth_day, birth_month = excluded.birth_month;
end $$;
revoke all on function public.sync_birthday_from_reg(text) from public, anon, authenticated;

create or replace function public.trg_reg_birthday() returns trigger language plpgsql security definer set search_path = public as $$
begin perform sync_birthday_from_reg(new.discord_id); return new; end $$;
drop trigger if exists reg_birthday_sync on public.discord_registrations;
create trigger reg_birthday_sync after insert or update of birth_day, birth_month on public.discord_registrations
  for each row execute function public.trg_reg_birthday();

create or replace function public.trg_member_birthday() returns trigger language plpgsql security definer set search_path = public as $$
begin if new.discord_id is not null then perform sync_birthday_from_reg(new.discord_id); end if; return new; end $$;
drop trigger if exists members_birthday_sync on public.members;
create trigger members_birthday_sync after insert or update of discord_id on public.members
  for each row execute function public.trg_member_birthday();

-- правка в админке -> анкета, чтобы повторное заполнение формы показывало актуальное значение
create or replace function public.trg_private_to_reg() returns trigger language plpgsql security definer set search_path = public as $$
begin
  update discord_registrations r set birth_day = new.birth_day, birth_month = new.birth_month
   from members m where m.id = new.member_id and r.discord_id = m.discord_id
     and (r.birth_day is distinct from new.birth_day or r.birth_month is distinct from new.birth_month);
  return new;
end $$;
drop trigger if exists member_private_to_reg on public.member_private;
create trigger member_private_to_reg after insert or update on public.member_private
  for each row execute function public.trg_private_to_reg();

-- События на дату (по умолчанию сегодня по Москве). Дни рождения наружу уходят только как ник, без даты.
create or replace function public.clan_events_on(d date default null)
returns table(kind text, title text, description text, emoji text)
language sql stable security definer set search_path = public as $$
  with p as (select coalesce(d, (now() at time zone 'Europe/Moscow')::date) as day)
  select 'birthday'::text, 'День рождения: ' || m.game_nick, null::text, '🎂'
    from member_private b join members m on m.id = b.member_id, p
   where b.birth_month = extract(month from p.day) and b.birth_day = extract(day from p.day)
  union all
  select 'anniversary',
    case when y = 1 then 'Год в клане: ' || nick
         else y || case when y % 10 between 2 and 4 and y % 100 not between 12 and 14 then ' года' else ' лет' end || ' в клане: ' || nick end,
    null, '🎖'
    from (select m.game_nick as nick, (extract(year from p.day) - extract(year from m.joined_at))::int as y
            from members m, p
           where m.joined_at is not null
             and extract(month from m.joined_at) = extract(month from p.day) and extract(day from m.joined_at) = extract(day from p.day)) a
   where y >= 1
  union all
  select 'event', e.title, e.description, e.emoji
    from clan_events e, p
   where (e.recurring_yearly and extract(month from e.event_date) = extract(month from p.day) and extract(day from e.event_date) = extract(day from p.day))
      or (not e.recurring_yearly and e.event_date = p.day);
$$;
grant execute on function public.clan_events_on(date) to anon, authenticated;
