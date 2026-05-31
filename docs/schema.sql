-- ByteBite: initial database schema (Milestone 1)
-- Apply to a fresh Supabase Postgres database via the SQL Editor


-- 1. households — a "fridge account" shared by a group of users
create table households (
  id          bigint generated always as identity primary key,
  name        text not null,
  created_at  timestamptz not null default now()
);


-- 2. food_types — reference data (drives auto-expiry + categories)
-- Seeded separately (see docs/foodTypes.sql).
create table food_types (
  id                      bigint generated always as identity primary key,
  name                    text not null unique,
  category                text,
  default_shelf_life_days integer not null
);


-- 3. users — accounts (custom JWT auth, not Supabase Auth)
create table users (
  id            bigint generated always as identity primary key,
  email         text not null unique,
  password_hash text not null,                  -- bcrypt hash so plaintext is never stored
  display_name  text not null,
  created_at    timestamptz not null default now()
);


-- 4. user_household is a many-to-many join between users and households (a user can be in many households
-- and a household can have many users). Milestone 1 logic creates exactly ONE
-- membership per user at signup, so this join is functionally a 1:1 today. 
create table user_household (
  id           bigint generated always as identity primary key,
  user_id      bigint not null references users(id)      on delete cascade,
  household_id bigint not null references households(id) on delete cascade,
  role         text   not null default 'owner'
                       check (role in ('owner','member')),
  created_at   timestamptz not null default now(),
  unique (user_id, household_id)              -- a user can't join the same household twice
);


-- 5. items is where actual food in a household's fridge is stored
create table items (
  id                  bigint generated always as identity primary key,
  household_id        bigint not null references households(id),
  name                text not null,
  food_type_id        bigint references food_types(id) on delete set null,
  quantity            numeric,
  unit                text,
  added_date          date    not null default current_date,
  expiry_date         date,
  expiry_is_estimated boolean not null default false,
  status              text    not null default 'active'
                          check (status in ('active','consumed','removed','expired')),
  storage             text    check (storage in ('fridge','pantry','freezer')),
  created_by          bigint  references users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);


-- Row-Level Security
-- Enabled on every table

alter table households     enable row level security;
alter table food_types     enable row level security;
alter table users          enable row level security;
alter table user_household enable row level security;
alter table items          enable row level security;