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

-- 4. fridges: the configurable fridge model owned by a household
create table fridges (
  id           bigint generated always as identity primary key,
  household_id bigint not null references households(id) on delete cascade,
  name         text not null,
  model_type   text not null
                    check (model_type in ('two_layered','three_layered','mini','side_by_side')),
  created_by   bigint references users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 5. storage_sections: actual places an item can live, including the always-existing pantry
create table storage_sections (
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
create unique index storage_sections_fridge_key_uidx
  on storage_sections (fridge_id, section_key)
  where fridge_id is not null;
create unique index storage_sections_household_pantry_uidx
  on storage_sections (household_id, section_key)
  where fridge_id is null;


-- 6. Categories table
create table categories (
  id              bigint generated always as identity primary key,
  name            text not null,
  default_storage text not null,   -- default storage location for this category (fridge/pantry/freezer)  
  pantry_days     integer,
  fridge_days     integer,
  freezer_days    integer,
  household_id    bigint references households(id) on delete cascade,  
  created_at      timestamptz not null default now()
);
create unique index categories_name_public_uidx    on categories (name) where household_id is null;
create unique index categories_name_household_uidx on categories (name, household_id) where household_id is not null;

-- 7. food_types: reference data (drives auto-expiry + categories)
-- Seeded separately with categories and brands (see docs/foodTypes.sql).
create table food_types (
  id                      bigint generated always as identity primary key,
  name                    text not null,
  category_id             bigint references categories(id) on delete set null,
  default_storage         text,   
  pantry_days             integer,    
  fridge_days             integer,
  freezer_days            integer,
  household_id            bigint references households(id) on delete cascade
);
create unique index food_types_name_public_uidx    on food_types (name) where household_id is null;
create unique index food_types_name_household_uidx on food_types (name, household_id) where household_id is not null;

-- 8. brands
create table brand_products (
  id              bigint generated always as identity primary key,
  brand           text not null,
  food_type_id    bigint not null references food_types(id) on delete cascade,
  default_storage text,     -- default storage loc         
  pantry_days     integer,           
  fridge_days     integer,
  freezer_days    integer,
  created_at      timestamptz not null default now(),
  household_id    bigint references households(id) on delete cascade
);
create unique index brand_products_brand_ft_public_uidx    on brand_products (brand, food_type_id) where household_id is null;
create unique index brand_products_brand_ft_household_uidx on brand_products (brand, food_type_id, household_id) where household_id is not null;


-- 9. items is where actual food in a household's fridge is stored
create table items (
  id                  bigint generated always as identity primary key,
  household_id        bigint not null references households(id),
  fridge_id           bigint references fridges(id) on delete set null,
  storage_section_id  bigint references storage_sections(id) on delete set null,
  name                text not null,
  food_type_id        bigint references food_types(id) on delete set null,
  brand_product_id    bigint references brand_products(id) on delete set null,
  category_id         bigint references categories(id) on delete set null,
  initial_quantity    numeric,
  quantity            numeric,
  unit                text,
  added_date          date    not null default current_date,
  expiry_date         date,
  expiry_is_estimated boolean not null default false,
  status              text    not null default 'active'
                          check (status in ('active','consumed','disposed','removed')),
  status_updated_at   timestamptz,
  consumed_at         date,
  disposed_at         date,
  removed_at          date,
  storage             text    check (storage in ('fridge','pantry','freezer', 'fridge door', 'fresh zone')),
  is_in_door          boolean not null default false,
  created_by          bigint  references users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);


-- 10. notifications: in-app alerts surfaced on the dashboard
create table notifications (
  id                bigint generated always as identity primary key,
  user_id           bigint not null references users(id) on delete cascade,
  item_id           bigint references items(id) on delete cascade,
  type              text not null check (type in ('expiring_soon', 'expiring_today')),
  message           text not null,
  notification_date date not null default current_date,
  read_at           timestamptz,
  created_at        timestamptz not null default now(),
  unique (user_id, item_id, type, notification_date)
);

alter table notifications enable row level security;



-- Row-Level Security
-- Enabled on every table

alter table households     enable row level security;
alter table food_types     enable row level security;
alter table users          enable row level security;
alter table user_household enable row level security;
alter table fridges        enable row level security;
alter table storage_sections enable row level security;
alter table items          enable row level security;
alter table categories     enable row level security;
alter table brand_products enable row level security;
alter table notifications enable row level security;
