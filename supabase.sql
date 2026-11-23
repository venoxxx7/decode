-- Run once in Supabase → SQL Editor.
create table if not exists docs (
  path text not null,            -- collection path, e.g. team/main/trades
  id   text not null,
  data jsonb not null,
  updated_at timestamptz default now(),
  primary key (path, id)
);
alter table docs enable row level security;

-- Team journal: every signed-in (invited) member can read/write.
create policy team_all on docs for all to authenticated
  using (path like 'team/main/%') with check (path like 'team/main/%');

-- Personal journal: path data/users/<uid>/... only for that user (admin included: no access).
create policy personal_all on docs for all to authenticated
  using (path like 'data/users/%' and split_part(path,'/',3) = auth.uid()::text)
  with check (path like 'data/users/%' and split_part(path,'/',3) = auth.uid()::text);

alter publication supabase_realtime add table docs;

-- Screenshot storage (private bucket, files kept under the uploader's folder).
insert into storage.buckets (id, name, public) values ('shots','shots',false) on conflict do nothing;
create policy shots_insert on storage.objects for insert to authenticated
  with check (bucket_id='shots' and (storage.foldername(name))[1] = auth.uid()::text);
create policy shots_select on storage.objects for select to authenticated
  using (bucket_id='shots' and (storage.foldername(name))[1] = auth.uid()::text);
