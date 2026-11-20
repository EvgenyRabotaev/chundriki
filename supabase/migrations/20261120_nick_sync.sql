-- Если игровой ник поменяли на сайте (админка), обновляем и анкету Discord,
-- чтобы синхронизация бота не вернула старый ник.
create or replace function sync_reg_game_nick() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.discord_id is not null and new.game_nick is distinct from old.game_nick then
    update discord_registrations set game_nick = new.game_nick
     where discord_id = new.discord_id and game_nick is distinct from new.game_nick;
  end if;
  return new;
end $$;
drop trigger if exists members_game_nick_sync on members;
create trigger members_game_nick_sync after update of game_nick on members
  for each row execute function sync_reg_game_nick();
