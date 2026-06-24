insert into recipes (name, cuisine_type, calories_kcal, difficulty_level, prep_time_minutes, ingredients_text, instructions_text, nutrition)
values
  ('Tomato Egg Stir-fry', 'chinese', 280, 2, 15,
   '3 large eggs
   2 medium tomatoes, cut into wedges
   2 tbsp cooking oil
   ½ tsp salt (adjust to taste)
   1 tsp sugar (optional, helps balance the tomato acidity)
   2 cloves garlic, minced (optional)
   1 stalk spring onion, chopped (optional garnish)',
   '1. Crack the eggs into a bowl, add a pinch of salt and 1 tablespoon of water, then beat until well combined.
   
   2. Wash the tomatoes and cut them into wedges. Mince the garlic if using.
   
   3. Heat 1 tablespoon of oil in a pan over medium-high heat. Pour in the eggs and gently stir until they are about 80% cooked. Remove and set aside.
   
   4. Add the remaining oil to the pan. Add the garlic and stir-fry for 10 seconds until fragrant.
   
   5. Add the tomatoes and cook for 2–3 minutes until they begin to soften.
   
   6. Add salt, sugar, and water. Continue cooking for another 2–3 minutes, lightly pressing the tomatoes to release their juices and form a sauce.

    7. Return the eggs to the pan and gently mix with the tomatoes.

    8. Cook for 30–60 seconds until everything is heated through and evenly coated with the sauce.

    9. Garnish with chopped spring onions if desired and serve immediately with rice.',
   'approx 10g protein, 8g fat, 20g carbs'),

  ('Omelette', 'western', 200, 1, 10,
   '2 eggs
   pinch of salt
   1 tsp butter',
   'Beat eggs with salt. Melt butter in pan. Pour eggs in, fold when set.',
   'approx 12g protein, 14g fat, 1g carbs');

insert into recipe_food_types (recipe_id, food_type_id)
values (
    (select id from recipes where name = 'Tomato Egg Stir-fry'),
    (select id from food_types where name = 'Tomato')
  ), (
     (select id from recipes where name = 'Tomato Egg Stir-fry'),
     (select id from food_types where name = 'Egg')
  ), (
    (select id from recipes where name = 'Omelette'),
    (select id from food_types where name = 'Egg')
  );
  