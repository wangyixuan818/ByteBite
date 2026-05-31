-- Run AFTER docs/schema.sql on a fresh database. Idempotent on
-- first run only; re-running will fail on the UNIQUE(name)
-- constraint, which is the intended safeguard against duplicates.

insert into food_types (name, category, default_shelf_life_days) values
  ('Milk',           'Dairy',      7),
  ('Eggs',           'Dairy',      21),
  ('Chicken Breast', 'Meat',       2),
  ('Bread',          'Bakes',      5),
  ('Apple',          'Fruits',     14),
  ('Spinach',        'Vegetables', 5),
  ('Yogurt',         'Dairy',      14);