ByteBite API Contract: Milestone 2

### Global conventions
- Base URL (dev): `http://localhost:5001/api/v1`
- Request & response bodies are JSON. Send `Content-Type: application/json`.
- Protected endpoints require header: `Authorization: Bearer <jwt>`
- Dates use ISO 8601 strings: `"2026-06-15"` for dates, `"2026-06-15T08:30:00Z"` for timestamps.
- Error responses (any non-2xx) have shape:
  `{ "error": { "code": "STRING_CODE", "message": "human-readable text" } }`
- CORS: backend allows origin `http://localhost:5173` (Vite default) in dev.

## Auth

### POST /auth/signup  (public)
Create an account. The server auto-creates a default household for the new user and adds them as owner.
- Request: `{ "email": string, "password": string (min 8 chars), "display_name": string }`
- 201: `{ "user": { "id", "email", "display_name" }, "token": string }`
- Errors: 400 `VALIDATION_ERROR`, 409 `EMAIL_ALREADY_EXISTS`

### POST /auth/login  (public)
- Request: `{ "email": string, "password": string }`
- 200: `{ "user": { "id", "email", "display_name" }, "token": string }`
- Errors: 401 `INVALID_USER`, `INVALID_PASSWORD`
400 `VALIDATION_ERROR`

### POST /auth/logout  (auth required)
For pure-JWT, the client just discards the token; this endpoint exists for symmetry/future revocation.
- 204 No Content

### GET /auth/me  (auth required)
Returns the currently logged-in user.
- 200: `{ "user": { "id", "email", "display_name" } }`
- Errors: 401 `UNAUTHENTICATED`



## Catalog  (reference data — powers cascading auto-expiry & category filtering)

The catalog is a three-tier hierarchy: **categories > food_types (products) > brand_products (brand variants)**. Each tier carries per-storage shelf-life values (`pantry_days`, `fridge_days`, `freezer_days`) and an optional `default_storage` suggesting where the item is typically kept. The POST /items handler cascades through the tiers (brand > product > category) when computing auto-expiry.

### GET /categories  (auth required)
List all food categories. Used by the frontend to populate the category dropdown.
- 200: `[ <category>, ... ]`

### GET /food-types  (auth required)
List all food types (products). Used by the frontend to populate the food-type dropdown.
- Optional query param: `?category_id=N` to filter by category.
- 200: `[ <food_type>, ... ]`

### GET /brand-products  (auth required)
List all brand variants. Used by the frontend to populate the brand dropdown.
- Optional query param: `?food_type_id=N` to filter by product.
- 200: `[ <brand_product>, ... ]`


## Food Items  (scoped to current user's household — determined server-side)

### GET /items  (auth required)
List items in the user's household.
- Optional query params: `?status=active` (default = all active), `?sort=expiry_asc|expiry_desc|added_desc` (default = expiry_asc)
- 200: `[ <item>, ... ]`

### POST /items  (auth required)
Add an item. If `expiry_date` is omitted, the server runs a **cascading auto-expiry lookup** across the catalog hierarchy: it tries the brand_products tier first (most specific), then falls back to food_types (product), then to categories (most general). On any match it computes `expiry_date = added_date + shelf_life_days` (picking the right `pantry_days` / `fridge_days` / `freezer_days` based on `storage`) and sets `expiry_is_estimated=true`. On no match, `expiry_date` stays null. If `storage` is omitted, the server fills it in from the matched catalog row's `default_storage`. The matched `brand_product_id` and/or `food_type_id` are persisted on the item.
- Request: `{ "name": string (required), "food_type_id"?: number, "brand_product_id"?: number, "category_id"?: number, "brand"?: string, "quantity"?: number, "unit"?: string, "added_date"?: ISO date (default today), "expiry_date"?: ISO date, "storage"?: "fridge" | "freezer" | "pantry" | "fridge door" | "fresh zone" }`
- 201: `{ "item": <item> }`
- Errors: 400 `VALIDATION_ERROR`

### GET /items/:id  (auth required)
- 	200: `{ "item": <item> }`
- Errors: 404 `NOT_FOUND` (also if the item belongs to a different household)

### PATCH /items/:id  (auth required)
Update any subset of fields. Accepts the same fields as POST (`name`, `food_type_id`, `brand_product_id`, `category_id`, `brand`, `quantity`, `unit`, `added_date`, `expiry_date`, `storage`), plus `"status": "active" | "consumed" | "removed" | "expired"`. Manually setting `expiry_date` flips `expiry_is_estimated` to `false`.
- 200: `{ "item": <item> }`
- Errors: 404 `NOT_FOUND`

### DELETE /items/:id  (auth required)
Hard delete (we'll revisit if Usage Analytics gets added).
- 204 No Content

## The `<item>` object
```json
{
  "id": 42,
  "household_id": 1,
  "name": "HL Milk",
  "food_type_id": 12,
  "brand_product_id": 5,
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

`brand_product_id` is the catalog row that matched the user's input, or `null` if the auto-expiry didn't find a brand-specific match (only a product or category match). Persisting it makes future features (filter by brand, brand-specific analytics) possible.

## The `<category>` object
```json
{
  "id": 1,
  "name": "Dairy",
  "default_storage": "fridge",
  "pantry_days": null,
  "fridge_days": 7,
  "freezer_days": 180
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
  "freezer_days": 90
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
  "freezer_days": 90
}
```

The per-storage `*_days` fields may be `null` if that storage location isn't applicable for the food (e.g. milk has no `pantry_days`). When all three are null on a row, the cascade falls through to the next tier in the hierarchy.




