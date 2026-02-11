#!/usr/bin/env bash
#
# Post-deployment smoke test for Draft Room.
# Usage: ./scripts/smoke-test.sh [qa|prod]
#
set -euo pipefail

ENV="${1:-prod}"

if [ "$ENV" = "qa" ]; then
  SUPABASE_URL="https://goyzyylpthhqotjdsmjn.supabase.co"
  ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdveXp5eWxwdGhocW90amRzbWpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNTM5NzQsImV4cCI6MjA4NTkyOTk3NH0.grQJqGEqe401avepbeU63JXOIw4xUU4u6vVr1pc2aZU"
  FRONTEND_URL="${QA_FRONTEND_URL:-https://draft-room-7vluzk23p-avis-projects-58313b0f.vercel.app}"
elif [ "$ENV" = "prod" ]; then
  SUPABASE_URL="https://ghjakbnibbxwlbujwsse.supabase.co"
  ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoamFrYm5pYmJ4d2xidWp3c3NlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxNzIzMjgsImV4cCI6MjA4NTc0ODMyOH0.UlaXT_L46NciTz0rD5q2a8yiALeUBH7Sns3SuEmYyEA"
  FRONTEND_URL="https://draft-room-eta.vercel.app"
else
  echo "Usage: $0 [qa|prod]"
  exit 1
fi

PASSED=0
FAILED=0
TOTAL=0

pass() {
  PASSED=$((PASSED + 1))
  TOTAL=$((TOTAL + 1))
  echo "  [PASS] $1"
}

fail() {
  FAILED=$((FAILED + 1))
  TOTAL=$((TOTAL + 1))
  echo "  [FAIL] $1"
  if [ -n "${2:-}" ]; then
    echo "         $2"
  fi
}

REST_URL="$SUPABASE_URL/rest/v1"
AUTH_HEADERS="-H \"apikey: $ANON_KEY\" -H \"Authorization: Bearer $ANON_KEY\""

echo ""
echo "=== Draft Room Smoke Tests ($ENV) ==="
echo ""

# --- 1. Frontend loads ---
echo "Frontend:"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL")
if [ "$HTTP_CODE" = "200" ]; then
  pass "Frontend returns HTTP 200"
else
  fail "Frontend returns HTTP $HTTP_CODE (expected 200)"
fi

# --- 2. Token columns blocked ---
echo ""
echo "Token column security:"

# leagues.spectator_token should be blocked
LEAGUE_RESP=$(eval "curl -s '$REST_URL/leagues?select=spectator_token&limit=1' $AUTH_HEADERS")
if echo "$LEAGUE_RESP" | grep -qi "permission denied\|column.*not allowed\|permission.*spectator_token\|42501"; then
  pass "leagues.spectator_token blocked"
elif echo "$LEAGUE_RESP" | grep -qi "spectator_token"; then
  # If the response contains the key with a value, it's exposed
  if echo "$LEAGUE_RESP" | python3 -c "import sys,json; data=json.load(sys.stdin); sys.exit(0 if len(data)>0 and 'spectator_token' in data[0] else 1)" 2>/dev/null; then
    fail "leagues.spectator_token EXPOSED" "Response contains token data"
  else
    pass "leagues.spectator_token blocked (empty result)"
  fi
else
  pass "leagues.spectator_token blocked"
fi

# captains.access_token should be blocked
CAPTAIN_RESP=$(eval "curl -s '$REST_URL/captains?select=access_token&limit=1' $AUTH_HEADERS")
if echo "$CAPTAIN_RESP" | grep -qi "permission denied\|column.*not allowed\|42501"; then
  pass "captains.access_token blocked"
elif echo "$CAPTAIN_RESP" | python3 -c "import sys,json; data=json.load(sys.stdin); sys.exit(0 if len(data)>0 and 'access_token' in data[0] else 1)" 2>/dev/null; then
  fail "captains.access_token EXPOSED"
else
  pass "captains.access_token blocked"
fi

# players.edit_token should be blocked
PLAYER_RESP=$(eval "curl -s '$REST_URL/players?select=edit_token&limit=1' $AUTH_HEADERS")
if echo "$PLAYER_RESP" | grep -qi "permission denied\|column.*not allowed\|42501"; then
  pass "players.edit_token blocked"
elif echo "$PLAYER_RESP" | python3 -c "import sys,json; data=json.load(sys.stdin); sys.exit(0 if len(data)>0 and 'edit_token' in data[0] else 1)" 2>/dev/null; then
  fail "players.edit_token EXPOSED"
else
  pass "players.edit_token blocked"
fi

# --- 3. Non-token columns accessible ---
echo ""
echo "Data access:"

LEAGUE_DATA=$(eval "curl -s '$REST_URL/leagues?select=id,name,status&limit=1' $AUTH_HEADERS")
if echo "$LEAGUE_DATA" | python3 -c "import sys,json; data=json.load(sys.stdin); sys.exit(0 if len(data)>0 and 'id' in data[0] else 1)" 2>/dev/null; then
  pass "League non-token columns accessible"
else
  fail "League non-token columns not accessible" "$LEAGUE_DATA"
fi

CAPTAIN_DATA=$(eval "curl -s '$REST_URL/captains?select=id,name,draft_position&limit=1' $AUTH_HEADERS")
if echo "$CAPTAIN_DATA" | python3 -c "import sys,json; data=json.load(sys.stdin); sys.exit(0 if len(data)>0 and 'id' in data[0] else 1)" 2>/dev/null; then
  pass "Captain non-token columns accessible"
else
  fail "Captain non-token columns not accessible" "$CAPTAIN_DATA"
fi

PLAYER_DATA=$(eval "curl -s '$REST_URL/players?select=id,name,bio&limit=1' $AUTH_HEADERS")
if echo "$PLAYER_DATA" | python3 -c "import sys,json; data=json.load(sys.stdin); sys.exit(0 if len(data)>0 and 'id' in data[0] else 1)" 2>/dev/null; then
  pass "Player non-token columns accessible"
else
  fail "Player non-token columns not accessible" "$PLAYER_DATA"
fi

# --- 4. RPCs work ---
echo ""
echo "RPC validation:"

# validate_spectator_token with invalid token
SPEC_INVALID=$(eval "curl -s '$REST_URL/rpc/validate_spectator_token' $AUTH_HEADERS -H 'Content-Type: application/json' -d '{\"p_league_id\":\"00000000-0000-0000-0000-000000000000\",\"p_token\":\"00000000-0000-0000-0000-000000000000\"}'")
if [ "$SPEC_INVALID" = "false" ]; then
  pass "validate_spectator_token rejects invalid token"
else
  fail "validate_spectator_token unexpected response" "$SPEC_INVALID"
fi

# validate_captain_token with invalid token
CAPT_INVALID=$(eval "curl -s '$REST_URL/rpc/validate_captain_token' $AUTH_HEADERS -H 'Content-Type: application/json' -d '{\"p_league_id\":\"00000000-0000-0000-0000-000000000000\",\"p_token\":\"00000000-0000-0000-0000-000000000000\"}'")
if [ "$CAPT_INVALID" = "null" ]; then
  pass "validate_captain_token rejects invalid token"
else
  fail "validate_captain_token unexpected response" "$CAPT_INVALID"
fi

# validate_player_edit_token with invalid token
PLAYER_INVALID=$(eval "curl -s '$REST_URL/rpc/validate_player_edit_token' $AUTH_HEADERS -H 'Content-Type: application/json' -d '{\"p_player_id\":\"00000000-0000-0000-0000-000000000000\",\"p_token\":\"00000000-0000-0000-0000-000000000000\"}'")
if [ "$PLAYER_INVALID" = "null" ]; then
  pass "validate_player_edit_token rejects invalid token"
else
  fail "validate_player_edit_token unexpected response" "$PLAYER_INVALID"
fi

# --- 5. CORS ---
echo ""
echo "CORS headers:"

CORS_ALLOWED=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "$SUPABASE_URL/functions/v1/make-pick" -H "Origin: https://draft-room-eta.vercel.app" -H "Access-Control-Request-Method: POST")
if [ "$CORS_ALLOWED" = "204" ]; then
  pass "CORS preflight returns 204 for allowed origin"
else
  fail "CORS preflight returned $CORS_ALLOWED for allowed origin"
fi

CORS_ORIGIN=$(curl -s -D - -o /dev/null -X OPTIONS "$SUPABASE_URL/functions/v1/make-pick" -H "Origin: https://evil-site.com" -H "Access-Control-Request-Method: POST" 2>&1 | grep -i "access-control-allow-origin" || echo "")
if echo "$CORS_ORIGIN" | grep -q "evil-site.com"; then
  fail "CORS allows evil-site.com"
else
  pass "CORS blocks unknown origins"
fi

# --- 6. Edge function UUID validation ---
echo ""
echo "Edge function validation:"

UUID_RESP=$(curl -s "$SUPABASE_URL/functions/v1/make-pick" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" -H "Content-Type: application/json" -d '{"leagueId":"not-a-uuid","captainId":"also-bad","playerId":"nope"}')
if echo "$UUID_RESP" | grep -qi "invalid.*uuid\|invalid.*id\|invalid.*field\|invalid.*format"; then
  pass "Edge function rejects invalid UUIDs"
else
  fail "Edge function UUID validation" "$UUID_RESP"
fi

# --- Summary ---
echo ""
echo "==================================="
echo "  Results: $PASSED/$TOTAL passed"
if [ "$FAILED" -gt 0 ]; then
  echo "  $FAILED FAILED"
  echo "==================================="
  exit 1
else
  echo "  All checks passed!"
  echo "==================================="
  exit 0
fi
