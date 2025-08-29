-- Create avatars bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload avatars
create policy "Avatar images are publicly accessible."
  on storage.objects for select
  using ( bucket_id = 'avatars' );

create policy "Authenticated users can upload an avatar."
  on storage.objects for insert
  to authenticated
  with check ( bucket_id = 'avatars' );

create policy "Authenticated users can update their own avatar."
  on storage.objects for update
  to authenticated
  using ( auth.uid() = owner )
  with check ( bucket_id = 'avatars' );

create policy "Authenticated users can delete their own avatar."
    on storage.objects for delete
    to authenticated
    using ( auth.uid() = owner );
