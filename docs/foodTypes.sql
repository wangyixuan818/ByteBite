-- Run AFTER docs/schema.sql.
-- This seeds the catalog hierarchy used by item auto-expiry and recipe matching.

insert into categories (name, default_storage, pantry_days, fridge_days, freezer_days) values
  ('Dairy', 'fridge', 0, 7, 30),
  ('Meat', 'fridge', 0, 3, 60),
  ('Seafood', 'fridge', 0, 2, 60),
  ('Vegetables', 'fridge', 1, 7, 60),
  ('Fruits', 'fridge', 5, 10, 30),
  ('Bakes', 'pantry', 1, 5, 30),
  ('Beverages', 'fridge', 0, 14, null),
  ('Condiments', 'pantry', 365, 365, null),
  ('Fermented Food', 'fridge', 30, 60, null)
on conflict (name) do update set
  default_storage = excluded.default_storage,
  pantry_days = excluded.pantry_days,
  fridge_days = excluded.fridge_days,
  freezer_days = excluded.freezer_days;

insert into food_types (name, category_id, default_storage, pantry_days, fridge_days, freezer_days) values
  ('Milk', (select id from categories where name = 'Dairy'), 'fridge', null, null, null),
  ('Eggs', (select id from categories where name = 'Dairy'), 'fridge', null, 21, null),
  ('Cheese', (select id from categories where name = 'Dairy'), 'fridge', null, 30, 180),
  ('Yogurt', (select id from categories where name = 'Dairy'), 'fridge', null, 14, 60),
  ('Tofu', (select id from categories where name = 'Dairy'), 'fridge', null, 5, null),
  ('Chicken Breast', (select id from categories where name = 'Meat'), 'fridge', null, 2, 180),
  ('Pork Belly', (select id from categories where name = 'Meat'), 'fridge', null, 3, 180),
  ('Bak Kwa', (select id from categories where name = 'Meat'), 'fridge', 14, 30, 90),
  ('Salmon', (select id from categories where name = 'Seafood'), 'fridge', null, null, 90),
  ('Prawns', (select id from categories where name = 'Seafood'), 'fridge', null, null, 180),
  ('Spinach', (select id from categories where name = 'Vegetables'), 'fridge', null, 4, null),
  ('Kangkong', (select id from categories where name = 'Vegetables'), 'fridge', null, 3, null),
  ('Tomato', (select id from categories where name = 'Vegetables'), 'pantry', 7, 14, null),
  ('Apple', (select id from categories where name = 'Fruits'), 'pantry', 7, 30, null),
  ('Banana', (select id from categories where name = 'Fruits'), 'pantry', 4, 7, 90),
  ('Orange', (select id from categories where name = 'Fruits'), 'pantry', 10, 21, null),
  ('Bread', (select id from categories where name = 'Bakes'), 'pantry', 4, 7, 90),
  ('Orange Juice', (select id from categories where name = 'Beverages'), 'fridge', null, 7, null),
  ('Pickled Daikon', (select id from categories where name = 'Fermented Food'), 'fridge', 30, 60, null)
on conflict (name) do update set
  category_id = excluded.category_id,
  default_storage = excluded.default_storage,
  pantry_days = excluded.pantry_days,
  fridge_days = excluded.fridge_days,
  freezer_days = excluded.freezer_days;

insert into brand_products (brand, food_type_id, default_storage, pantry_days, fridge_days, freezer_days) values
  ('HL', (select id from food_types where name = 'Milk'), 'fridge', 0, 14, null),
  ('Dutch Lady', (select id from food_types where name = 'Milk'), 'fridge', 14, 14, null),
  ('Marigold', (select id from food_types where name = 'Milk'), null, null, null, null),
  ('Meiji', (select id from food_types where name = 'Milk'), null, null, null, null),
  ('F&N', (select id from food_types where name = 'Orange Juice'), null, null, null, null),
  ('Yeo''s', (select id from food_types where name = 'Orange Juice'), null, null, null, null),
  ('Sunshine', (select id from food_types where name = 'Bread'), null, null, null, null),
  ('Gardenia', (select id from food_types where name = 'Bread'), null, null, null, null),
  ('Bee Cheng Hiang', (select id from food_types where name = 'Bak Kwa'), null, null, null, null),
  ('Lim Chee Guan', (select id from food_types where name = 'Bak Kwa'), null, null, null, null),
  ('Marigold', (select id from food_types where name = 'Yogurt'), null, null, null, null)
on conflict (brand, food_type_id) do update set
  default_storage = excluded.default_storage,
  pantry_days = excluded.pantry_days,
  fridge_days = excluded.fridge_days,
  freezer_days = excluded.freezer_days;
