ByteBite API Contract — Milestone 1

### Global conventions
- Base URL (dev): `http://localhost:5001/api/v1`
- Request & response bodies are JSON. Send `Content-Type: application/json`.
- Protected endpoints require header: `Authorization: Bearer <jwt>`
- Dates use ISO 8601 strings: `"2026-06-15"` for dates, `"2026-06-15T08:30:00Z"` for timestamps.
- Error responses (any non-2xx) have shape:
  `{ "error": { "code": "STRING_CODE", "message": "human-readable text" } }`
- CORS: backend allows origin `http://localhost:5173` (Vite default) in dev.

## Auth

### POST /v1/auth/signup  (public)
Create an account. The server auto-creates a default household for the new user and adds them as owner.
- Request: `{ "email": string, "password": string (min 8 chars), "display_name": string }`
- 201: `{ "user": { "id", "email", "display_name" }, "token": string }`
- Errors: 400 `VALIDATION_ERROR`, 409 `EMAIL_ALREADY_EXISTS`

### POST /v1/auth/login  (public)
- Request: `{ "email": string, "password": string }`
- 200: `{ "user": { "id", "email", "display_name" }, "token": string }`
- Errors: 401 `INVALID_USER`, `INVALID_PASSWORD`
400 `VALIDATION_ERROR`

### POST /v1/auth/logout  (auth required)
For pure-JWT, the client just discards the token; this endpoint exists for symmetry/future revocation.
- 204 No Content

### GET /v1/auth/me  (auth required)
Returns the currently logged-in user.
- 200: `{ "user": { "id", "email", "display_name" } }`
- Errors: 401 `UNAUTHENTICATED`

## Food Types  (reference data — powers auto-expiry & category filtering)

### GET /food-types  (auth required)
- 200: `[ { "id", "name": "Milk", "category": "Dairy", "default_shelf_life_days": 7 }, ... ]`

## Food Items  (scoped to current user's household — determined server-side)

### GET /items  (auth required)
List items in the user's household.
- Optional query params: `?status=active` (default = all active), `?sort=expiry_asc|expiry_desc|added_desc` (default = expiry_asc)
- 200: `[ <item>, ... ]`

### POST /items  (auth required)
Add an item. If `expiry_date` is omitted, the server tries to auto-fill from `food_types` (matched by `food_type_id`, or by case-insensitive `name`). On match → sets `expiry_is_estimated=true`. On no match → `expiry_date` stays null.
- Request: `{ "name": string (required), "food_type_id"?: number, "quantity"?: number, "unit"?: string, "added_date"?: ISO date (default today), "expiry_date"?: ISO date, "storage"?: "fridge" | "pantry" | "freezer" }`
- 201: `{ "item": <item> }`
- Errors: 400 `VALIDATION_ERROR`

### GET /items/:id  (auth required)
- 200: `{ "item": <item> }`
- Errors: 404 `NOT_FOUND` (also if the item belongs to a different household)

### PATCH /items/:id  (auth required)
Update any subset of fields, plus `"status": "active" | "consumed" | "removed" | "expired"`.
- 200: `{ "item": <item> }`

### DELETE /items/:id  (auth required)
Hard delete (we'll revisit if Usage Analytics gets added).
- 204 No Content

## The `<item>` object
```json
{
  "id": 42,
  "household_id": 1,
  "name": "Milk",
  "food_type_id": 12,
  "quantity": 1,
  "unit": "carton",
  "added_date": "2026-05-20",
  "expiry_date": "2026-05-27",
  "expiry_is_estimated": true,
  "status": "active",
  "storage": "fridge",
  "fridge_id": 1,
  "created_by": 3,
  "created_at": "2026-05-20T08:30:00Z",
  "updated_at": "2026-05-20T08:30:00Z"
}




