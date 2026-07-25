-- ByteBite household feature migration
-- Apply this to an existing Supabase Postgres database before using household APIs.

alter table households
  add column if not exists code text;

update households
set code = upper(substr(md5(random()::text || id::text || now()::text), 1, 10))
where code is null;

alter table households
  alter column code set not null;

create unique index if not exists households_code_uidx
  on households (code);

alter table users
  add column if not exists profile_picture_url text;
