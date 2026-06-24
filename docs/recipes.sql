-- Run after docs/schema.sql and the hierarchical food catalog seed.

create table recipes (
  id                    bigint generated always as identity primary key,
  name                  text not null,
  cuisine_type          text not null
                          check (cuisine_type in (
                            'chinese', 'western', 'japanese', 'korean',
                            'indian', 'italian', 'other'
                          )),
  calories_kcal         integer check (calories_kcal >= 0),
  difficulty_level      integer check (difficulty_level between 1 and 5),
  prep_time_minutes     integer check (prep_time_minutes >= 0),
  ingredients_text      text,
  instructions_text     text,
  nutrition             text
);

create table recipe_food_types (
  recipe_id    bigint not null references recipes(id) on delete cascade,
  food_type_id bigint not null references food_types(id) on delete cascade,
  primary key (recipe_id, food_type_id)
);

create index recipe_food_types_food_type_id_idx
  on recipe_food_types(food_type_id);

alter table recipes enable row level security;
alter table recipe_food_types enable row level security;

-- TODO: Verify food_type IDs against docs/hierarchicalCatalog.sql/database data.
-- TODO: Seed 10-15 recipes spanning the agreed cuisine_type values.
-- TODO: Insert one recipe_food_types row for every required food type.
-- TODO: Test that every seeded recipe has at least one junction-table row.
-- TODO (MS3): Decide whether recipes need created_by and moderation fields.
