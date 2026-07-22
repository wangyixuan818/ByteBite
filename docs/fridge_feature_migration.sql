-- ByteBite fridge feature migration
-- Apply this to an existing Supabase Postgres database before building the fridge setup API.

create table if not exists fridges (
  id           bigint generated always as identity primary key,
  household_id bigint not null references households(id) on delete cascade,
  name         text not null,
  model_type   text not null
                    check (model_type in ('two_layered','three_layered','mini','side_by_side')),
  created_by   bigint references users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists storage_sections (
  id              bigint generated always as identity primary key,
  household_id    bigint not null references households(id) on delete cascade,
  fridge_id       bigint references fridges(id) on delete cascade,
  name            text not null,
  section_type    text not null
                         check (section_type in ('fridge','freezer','fresh_zone','pantry')),
  section_key     text not null,
  position        integer not null default 0,
  has_door_space  boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists storage_sections_fridge_key_uidx
  on storage_sections (fridge_id, section_key)
  where fridge_id is not null;

create unique index if not exists storage_sections_household_pantry_uidx
  on storage_sections (household_id, section_key)
  where fridge_id is null;

alter table items
  add column if not exists fridge_id bigint references fridges(id) on delete set null,
  add column if not exists storage_section_id bigint references storage_sections(id) on delete set null,
  add column if not exists is_in_door boolean not null default false;

alter table fridges enable row level security;
alter table storage_sections enable row level security;
