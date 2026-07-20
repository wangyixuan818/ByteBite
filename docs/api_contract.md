# ByteBite API Contract: Milestone 3

### Global conventions

- Base URL (dev): `http://localhost:5001/api/v1`
- Request and response bodies are JSON unless explicitly stated otherwise.
- Protected endpoints require header: `Authorization: Bearer <jwt>`
- Dates use ISO 8601 strings: `"2026-06-15"` for dates, `"2026-06-15T08:30:00Z"` for timestamps.
- Error responses use:
  `{ "error": { "code": "STRING_CODE", "message": "human-readable text" } }`
- CORS: backend allows origin `http://localhost:5173` in dev.

## Auth

### POST /auth/signup  (public)

Create an account. The server auto-creates a default household for the new user and adds them as owner.

- Request: `{ "email": string, "password": string, "display_name": string }`
- 201: `{ "user": { "id", "email", "display_name" }, "token": string }`
- Errors: 400 `VALIDATION_ERROR`, 409 `EMAIL_ALREADY_EXISTS`

### POST /auth/login  (public)

- Request: `{ "email": string, "password": string }`
- 200: `{ "user": { "id", "email", "display_name" }, "token": string }`
- Errors: 400 `VALIDATION_ERROR`, 401 `INVALID_USER`, `INVALID_PASSWORD`

### POST /auth/logout  (auth required)

For pure-JWT, the client just discards the token; this endpoint exists for symmetry/future revocation.

- 204 No Content

### GET /auth/me  (auth required)

- 200: `{ "user": { "id", "email", "display_name" } }`
- Errors: 401 `UNAUTHENTICATED`

## Catalog  (reference data for add-item flow, auto-expiry, and filtering)

The catalog hierarchy is:

`categories -> food_types -> brand_products`

Each tier may carry per-storage shelf-life values:

- `pantry_days`
- `fridge_days`
- `freezer_days`
- `default_storage`

When an item is created without a manual `expiry_date`, the backend tries to estimate expiry from the most specific matching catalog row first:

1. brand product
2. food type
3. category

Every catalog tier is two-layered. A row with `household_id: null` is a public, verified entry visible to all households; a row with a `household_id` is private to that household. All catalog reads return the public layer plus the caller's own entries, never another household's.

### GET /categories  (auth required)

List all food categories.

- 200: `[ <category>, ... ]`

### POST /categories  (auth required)

Create a custom category, private to the caller's household. If a category with the same name already exists (public, or already in this household), the existing row is returned instead of creating a duplicate. Current frontend sends name only; thumbnail is held for a later version.

- Request: `{ "name": string, "default_storage"?: "fridge" | "freezer" | "pantry" | "fridge door" | "fresh zone" }`
- 201: `{ "category": <category> }` — a new private category was created
- 200: `{ "category": <category> }` — an existing public or household category was reused
- Errors: 400 `VALIDATION_ERROR`, 409 `CATEGORY_ALREADY_EXISTS`

### GET /food-types  (auth required)

List food categories visible to the caller: public entries plus the household's own.

- Optional query param: `?category_id=N` may be supported by frontend filtering, but current backend returns all rows.
- 200: `[ <food_type>, ... ]`

### POST /food-types  (auth required)

Create a custom food type under a category, private to the caller's household. If a food type with the same name already exists (public, or already in this household), the existing row is returned instead of creating a duplicate.

- Request: `{ "name": string, "category_id": number, "default_storage"?: "fridge" | "freezer" | "pantry" | "fridge door" | "fresh zone", "pantry_days"?: number | null, "fridge_days"?: number | null, "freezer_days"?: number | null }`
- 201: `{ "food_type": <food_type> }` — a new private food type was created
- 200: `{ "food_type": <food_type> }` — an existing public or household food type was reused
- Errors: 400 `VALIDATION_ERROR`, 409 `FOOD_TYPE_ALREADY_EXISTS`

### GET /brand-products  (auth required)

List brand variants visible to the caller: public entries plus the household's own.

- Optional query param: `?food_type_id=N` filters brands for one food type.
- 200: `[ <brand_product>, ... ]`


## Food Items  (scoped to current user's household)

### GET /items  (auth required)

List active items in the user's household, sorted by expiry date (soonest first, items without an expiry date last). Items whose `status` is not `active` (consumed, removed, expired) are excluded from this view but kept in the database for analytics.

Each item is returned with two server-computed fields to support the frontend's "expiring soon" highlighting:
- `days_until_expiry`: signed integer number of days from today to the item's `expiry_date`. Negative for items already past expiry, zero for today, `null` when `expiry_date` is `null`.
- `expiry_status`: a bucket label derived from `days_until_expiry`. One of:
  - `no_date` — `expiry_date` is null
  - `expired` — already past
  - `expiring_today` — zero days away
  - `expiring_soon` — 1 to 3 days away
  - `expiring_this_week` — 4 to 7 days away
  - `ok` — more than 7 days away

- 200: `[ <item>, ... ]`
{
  "id": 42,
  ...
  "days_until_expiry": 3,
  "expiry_status": "expiring_soon"
}

### POST /items  (auth required)

Add an item. If `expiry_date` is omitted, the server runs a **cascading auto-expiry lookup** across the catalog hierarchy: it tries the brand_products tier first (most specific), then falls back to food_types (product), then to categories (most general). On any match it computes `expiry_date = added_date + shelf_life_days` (picking the right `pantry_days` / `fridge_days` / `freezer_days` based on `storage`) and sets `expiry_is_estimated=true`. On no match, `expiry_date` stays null. If `storage` is omitted, the server fills it in from the matched catalog row's `default_storage`. The matched `brand_product_id` and/or `food_type_id` are persisted on the item.

Brand handling runs before the expiry cascade. If `brand` is supplied as free text together with a `food_type_id` and no `brand_product_id`, the server matches it against brands visible to the household and creates a new private brand when there is no match, so a typed brand is never discarded even when `expiry_date` is also provided. A `brand_product_id` belonging to another household is rejected and stored as null.

- Request: `{ "name": string, "food_type_id"?: number, "brand_product_id"?: number, "category_id"?: number, "brand"?: string, "quantity"?: number, "unit"?: string, "added_date"?: ISO date, "expiry_date"?: ISO date, "storage"?: "fridge" | "freezer" | "pantry" | "fridge door" | "fresh zone" }`
- 201: `{ "item": <item> }`
- Errors: 400 `VALIDATION_ERROR`

### GET /items/:id  (auth required)

- 200: `{ "item": <item> }`
- Errors: 404 `NOT_FOUND`

### PATCH /items/:id  (auth required)

Update any subset of item fields. This endpoint is also used to mark an item as consumed.

- Request: `{ "name"?: string, "food_type_id"?: number, "brand_product_id"?: number, "quantity"?: number, "unit"?: string, "added_date"?: ISO date, "expiry_date"?: ISO date, "storage"?: "fridge" | "freezer" | "pantry" | "fridge door" | "fresh zone", "status"?: "active" | "consumed" | "removed" | "expired" }`
- 200: `{ "item": <item> }`
- Errors: 400 `VALIDATION_ERROR`, 404 `NOT_FOUND`

### DELETE /items/:id  (auth required)

Hard delete (we'll revisit if Usage Analytics gets added).
- 204 No Content


brand_product_id, food_type_id, and category_id are the catalog rows that matched the user's input via the auto-expiry cascade. Any of them may be null if the cascade didn't find a match at that tier. Persisting all three makes future features (filter by brand, filter by category, brand-specific analytics) possible without joins.


## Notifications (scoped to current user)

In-app notifications surfaced on the dashboard. Created automatically by a daily 8am background job for items entering the 3-day "expiring soon" window; never created via the API. Each notification ties a recipient to an item and is deduplicated per day so the job is safely re-runnable.


### GET /notifications  (auth required)
List the current user's notifications, unread first then most recent.
- 200: `[ <notification>, ... ]`
- Errors: 401 `UNAUTHENTICATED`

### PATCH /notifications/:id  (auth required)
Flip the read state of a notification. `read: true` sets `read_at` to now; `read: false` clears it back to null.
- Request: `{ "read": boolean }`
- 200: `{ "notification": <notification> }`
- Errors: 400 `VALIDATION_ERROR`, 404 `NOT_FOUND` (also when the id belongs to another user)


## Recipes

### GET /recipes  (auth required)

List recipes with required food type IDs.

- 200: `[ <recipe>, ... ]`

### GET /recipes/:id  (auth required)

Get one recipe with required food type IDs.

- 200: `{ "recipe": <recipe> }`
- Errors: 404 `NOT_FOUND`

## The `<item>` object

```json
{
  "id": 42,
  "household_id": 1,
  "name": "HL Milk",
  "food_type_id": 12,
  "brand_product_id": 5,
  "category_id": 1,
  "quantity": 1,
  "unit": "carton",
  "added_date": "2026-05-20",
  "expiry_date": "2026-05-25",
  "expiry_is_estimated": true,
  "status": "active",
  "storage": "fridge",
  "created_by": 3,
  "created_at": "2026-05-20T08:30:00Z",
  "updated_at": "2026-05-20T08:30:00Z"
}
```

brand_product_id, food_type_id, and category_id are the catalog rows that matched the user's input via the auto-expiry cascade. Any of them may be null if the cascade didn't find a match at that tier. Persisting all three makes future features (filter by brand, filter by category, brand-specific analytics) possible without joins.

## The `<category>` object
```json
{
  "id": 1,
  "name": "Dairy",
  "default_storage": "fridge",
  "pantry_days": null,
  "fridge_days": 7,
  "freezer_days": 180,
  "household_id": null
}
```


## The `<food_type>` object

```json
{
  "id": 12,
  "name": "Milk",
  "category_id": 1,
  "default_storage": "fridge",
  "pantry_days": null,
  "fridge_days": 7,
  "freezer_days": 90,
  "household_id": null
}
```

## The `<brand_product>` object

```json
{
  "id": 5,
  "brand": "HL",
  "food_type_id": 12,
  "default_storage": "fridge",
  "pantry_days": null,
  "fridge_days": 5,
  "freezer_days": 90,
  "household_id": null
}
```
The per-storage `*_days` fields may be `null` if that storage location isn't applicable for the food (e.g. milk has no `pantry_days`). When all three are null on a row, the cascade falls through to the next tier in the hierarchy.

`household_id` is `null` for public, verified entries and set to the owning household's id for private ones.


## The `<notification>` object

```json
{
  "id": 10,
  "item_id": 42,
  "type": "expiring_soon",
  "message": "HL Milk expires soon",
  "notification_date": "2026-06-26",
  "read_at": null,
  "created_at": "2026-06-26T08:30:00Z"
}
```
`type` is one of `expiring_today` or `expiring_soon`. `read_at` is `null` for unread, a timestamp when marked read. `notification_date` is the day the notification was created and underpins the per-day dedup.

## The `<recipe>` object

```json
{
  "id": 1,
  "name": "Milk French Toast",
  "description": "Simple breakfast recipe",
  "instructions": "Mix, soak, and pan-fry.",
  "food_types_required": [12, 18]
}
```

## The `<notification>` object
```json
{
  "id": 9,
  "item_id": 42,
  "type": "expiring_soon",
  "message": "Milk expires in 2 days",
  "notification_date": "2026-06-19",
  "read_at": null,
  "created_at": "2026-06-19T00:00:05Z"
}
```

`type` is one of `expiring_today` or `expiring_soon`. `read_at` is `null` for unread, a timestamp when marked read. `notification_date` is the day the notification was created.


