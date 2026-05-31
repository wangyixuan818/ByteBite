#!/bin/bash

BASE="http://localhost:5001/api/v1"
EMAIL="test$(date +%s)@example.com"
PASS="password123"
TOKEN=""
BODY=""

# helper function to run API tests
api_test() {
  local label="$1"
  local expected="$2"
  local method="$3"
  local route="$4"
  local payload="$5"

  local args=(-s -X "$method" "$BASE$route" -H "Content-Type: application/json")
  [ -n "$TOKEN" ]   && args+=(-H "Authorization: Bearer $TOKEN")
  [ -n "$payload" ] && args+=(-d "$payload")

  # Run curl
  local raw_response=$(curl "${args[@]}" -w "%{http_code}")

  # Last 3 chars = HTTP status code. everything before = JSON body
  local status="${raw_response: -3}"
  BODY="${raw_response%???}"

  if [ "$status" == "$expected" ]; then
    echo "PASS - $label"
  else
    echo "FAIL - $label (Got $status, expected $expected)"
  fi
}



echo "--- HAPPY PATH ---"

api_test "Signup" "201" "POST" "/auth/signup" "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"display_name\":\"Basic Test\"}"

api_test "Login" "200" "POST" "/auth/login" "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}"
TOKEN=$(echo "$BODY" | python3 -c "import json,sys;print(json.load(sys.stdin)['token'])")

api_test "GET /auth/me" "200" "GET" "/auth/me" ""

api_test "GET /food-types" "200" "GET" "/food-types" ""
FT_ID=$(echo "$BODY" | python3 -c "import json,sys;print(json.load(sys.stdin)[0]['id'])")

api_test "POST /items" "201" "POST" "/items" "{\"name\":\"Milk\",\"food_type_id\":$FT_ID,\"quantity\":1,\"unit\":\"carton\",\"storage\":\"fridge\"}"
ITEM_ID=$(echo "$BODY" | python3 -c "import json,sys;print(json.load(sys.stdin)['item']['id'])")

api_test "GET /items (list)" "200" "GET" "/items" ""

api_test "GET /items/:id" "200" "GET" "/items/$ITEM_ID" ""

api_test "PATCH /items/:id" "200" "PATCH" "/items/$ITEM_ID" '{"quantity":2,"status":"consumed"}'

api_test "DELETE /items/:id" "204" "DELETE" "/items/$ITEM_ID" ""

api_test "GET /items (after delete)" "200" "GET" "/items" ""

api_test "POST /auth/logout" "204" "POST" "/auth/logout" ""


echo ""
echo "--- ERROR PATHS ---"

api_test "Duplicate signup" "409" "POST" "/auth/signup" "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"display_name\":\"Test\"}"

api_test "Wrong password" "401" "POST" "/auth/login" "{\"email\":\"$EMAIL\",\"password\":\"wrongPW\"}"

# temporarily clear token to genuinely test the "no header" path
TEMP_TOKEN=$TOKEN
TOKEN=""
api_test "No token access" "401" "GET" "/items" ""
TOKEN=$TEMP_TOKEN

api_test "Nonexistent item" "404" "GET" "/items/9999" ""

api_test "Empty body" "400" "POST" "/items" "{}"