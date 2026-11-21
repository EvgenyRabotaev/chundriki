-- Участник без Discord ID (никогда не был на сервере) при исключении удаляется навсегда, в ушедшие не попадает.
-- Связанные данные (значки, дата рождения, заметки, строки маскота, события) удаляются каскадом; комментарии остаются без автора.
create or replace function public.move_to_former(p_member_id bigint, p_leave_type text, p_reason text, p_left_at date default current_date)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_did text;
begin
  if not public.is_admin() then raise exception 'only admins'; end if;
  select discord_id into v_did from public.members where id = p_member_id;
  if not found then return; end if;
  if v_did is null then
    delete from public.members where id = p_member_id;
    return;
  end if;
  insert into public.former_members (game_nick, discord_nick, discord_id, clan_role, real_name, joined_at, left_at, leave_type, reason)
    select game_nick, discord_nick, discord_id, clan_role, real_name, joined_at, p_left_at, p_leave_type, p_reason from public.members where id = p_member_id;
  delete from public.members where id = p_member_id;
end $$;
