-- Картинки новостей, загружаемые из админки: публичное чтение, запись только админам
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('news', 'news', true, 6291456, array['image/webp','image/jpeg','image/png','image/gif'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists news_img_read on storage.objects;
create policy news_img_read on storage.objects for select to anon, authenticated using (bucket_id = 'news');
drop policy if exists news_img_insert on storage.objects;
create policy news_img_insert on storage.objects for insert to authenticated with check (bucket_id = 'news' and public.is_admin());
drop policy if exists news_img_update on storage.objects;
create policy news_img_update on storage.objects for update to authenticated using (bucket_id = 'news' and public.is_admin()) with check (bucket_id = 'news' and public.is_admin());
drop policy if exists news_img_delete on storage.objects;
create policy news_img_delete on storage.objects for delete to authenticated using (bucket_id = 'news' and public.is_admin());
