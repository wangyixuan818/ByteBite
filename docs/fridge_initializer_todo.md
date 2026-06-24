# Fridge Initializer Preparation

This file is preparation only. The initializer is deliberately not routed into the app yet.

## Frontend TODO

- [ ] Confirm the fridge models and whether pantry is a separate unit.
- [ ] Add `/initialize` as a protected route.
- [ ] Ask the backend whether the household is already initialized before showing the dashboard.
- [ ] Build model selection using `config/fridgeModels.js` or API-provided models.
- [ ] Build one storage-type selector for every fridge/pantry section.
- [ ] Validate that every section is assigned.
- [ ] Save the setup atomically and redirect to `/dashboard`.
- [ ] Update the dashboard visualizer and inventory filtering to use saved section IDs.
- [ ] Add loading, retry, back, and duplicate-submission handling.
- [ ] Add tests for new users, initialized users, invalid assignments, and failed saves.

## Backend and database TODO

- [ ] Add a household-level initialized state, preferably inferred from an existing storage setup rather than a separate boolean.
- [ ] Add `fridge_models` and `fridge_model_sections` reference tables, or agree on a stable JSON model contract.
- [ ] Add household-owned `storage_setups` and `storage_sections` tables.
- [ ] Each section needs a stable ID, label/order, and storage type such as `fridge`, `freezer`, or `pantry`.
- [ ] Add authenticated `GET /fridge-models`, `GET /storage-setup`, and transactional `POST /storage-setup` endpoints.
- [ ] Scope setup reads/writes to the authenticated user's household.
- [ ] Decide how reconfiguration affects items already assigned to a removed section.
- [ ] Add `storage_section_id` to `items`; the current free-text `storage` field is not enough for layer-specific inventory lists.
- [ ] Add integration tests for household isolation and atomic setup creation.

## Catalog creation needed by the corrected add-food flow

- [ ] Add authenticated `POST /categories` with unique-name validation and `{ category }` response.
- [ ] Add optional thumbnail storage plus a `thumbnail_url` column; support multipart uploads or a separate upload flow.
- [ ] Decide how a custom category obtains shelf-life values for automatic expiry estimation.
- [ ] Add authenticated `POST /food-types` with category ownership/visibility rules and `{ food_type }` response.
- [ ] Decide whether custom catalog entries are global, household-owned, or user-owned; the current tables have no owner column.
- [ ] Create a transaction endpoint if category + food type + inventory item must succeed or fail together.
