-- Public bucket for hall photos and videos shown in the widget; owner and SMM upload.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('moloko-media', 'moloko-media', true, 52428800,
        array['image/jpeg','image/png','image/webp','image/avif','video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists moloko_media_read on storage.objects;
drop policy if exists moloko_media_insert on storage.objects;
drop policy if exists moloko_media_update on storage.objects;
drop policy if exists moloko_media_delete on storage.objects;
create policy moloko_media_read on storage.objects for select to anon, authenticated using (bucket_id = 'moloko-media');
create policy moloko_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'moloko-media' and public.moloko_has(array['owner','smm']));
create policy moloko_media_update on storage.objects for update to authenticated
  using (bucket_id = 'moloko-media' and public.moloko_has(array['owner','smm']));
create policy moloko_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'moloko-media' and public.moloko_has(array['owner','smm']));
