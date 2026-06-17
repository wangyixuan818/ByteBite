-- ByteBite: database schema
-- Apply to a fresh Supabase Postgres database via the SQL Editor


-- 1. households: a "fridge account" shared by a group of users
create table households (
  id          bigint generated always as identity primary key,
  name        text not null,
  created_at  timestamptz not null default now()
);

-- 2. users: accounts (custom JWT auth, not Supabase Auth)
create table users (
  id            bigint generated always as identity primary key,
  email         text not null unique,
  password_hash text not null,                  -- bcrypt hash so plaintext is never stored
  display_name  text not null,
  created_at    timestamptz not null default now()
);


-- 3. user_household is a many-to-many join between users and households (a user can be in many households
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


-- 4. Categories table
create table categories (
  id              bigint generated always as identity primary key,
  name            text not null unique,
  default_storage text not null,   -- default storage location for this category (fridge/pantry/freezer)  
  pantry_days     integer,
  fridge_days     integer,
  freezer_days    integer,
  created_at      timestamptz not null default now()
);


-- 5. food_types: reference data (drives auto-expiry + categories)
-- Seeded separately (see docs/foodTypes.sql).
create table food_types (
  id                      bigint generated always as identity primary key,
  name                    text not null unique,
  category_id             bigint references categories(id) on delete set null,
  default_storage         text,   
  pantry_days             integer,    
  fridge_days             integer,
  freezer_days            integer
);


-- 6. brands
create table brand_products (
  id              bigint generated always as identity primary key,
  brand           text not null,
  food_type_id    bigint not null references food_types(id) on delete cascade,
  default_storage text,     -- default storage loc         
  pantry_days     integer,           
  fridge_days     integer,
  freezer_days    integer,
  created_at      timestamptz not null default now(),
  unique (brand, food_type_id)       -- one row per (brand, product) pair 
);


-- 7. items is where actual food in a household's fridge is stored
create table items (
  id                  bigint generated always as identity primary key,
  household_id        bigint not null references households(id),
  name                text not null,
  food_type_id        bigint references food_types(id) on delete set null,
  brand_product_id    bigint references brand_products(id) on delete set null,
  quantity            numeric,
  unit                text,
  added_date          date    not null default current_date,
  expiry_date         date,
  expiry_is_estimated boolean not null default false,
  status              text    not null default 'active'
                          check (status in ('active','consumed','removed','expired')), -- expired can also be for spoilt food then have to throw out
  storage             text    check (storage in ('fridge','pantry','freezer', 'fridge door', 'fresh zone')),
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
alter table categories     enable row level security;
alter table brand_products enable row level security;