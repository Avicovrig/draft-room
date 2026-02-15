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
  FRONTEND_URL="${QA_FRONTEND_URL:-https://draft-room-git-main-avis-projects-58313b0f.vercel.app}"
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

# All 9 edge functions
EDGE_FUNCTIONS="make-pick auto-pick toggle-auto-pick update-player-profile update-captain-color restart-draft undo-pick copy-league manage-draft-queue"

# --- 1. Frontend loads ---
echo "Frontend:"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL")
if [ "$HTTP_CODE" = "200" ]; then
  pass "Frontend returns HTTP 200"
else
  fail "Frontend returns HTTP $HTTP_CODE (expected 200)"
fi

# --- 1b. Security headers ---
echo ""
echo "Security headers:"
HEADER_RESP=$(curl -s -D - -o /dev/null "$FRONTEND_URL" 2>&1)

for HEADER_NAME in "x-frame-options" "x-content-type-options" "strict-transport-security" "content-security-policy"; do
  if echo "$HEADER_RESP" | grep -qi "^$HEADER_NAME:"; then
    pass "$HEADER_NAME present"
  else
    fail "$HEADER_NAME missing"
  fi
done

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

# get_league_tokens requires authenticated manager — must not expose tokens to anon
TOKENS_BODY=$(eval "curl -s '$REST_URL/rpc/get_league_tokens' $AUTH_HEADERS -H 'Content-Type: application/json' -d '{\"p_league_id\":\"00000000-0000-0000-0000-000000000000\"}'")
if echo "$TOKENS_BODY" | grep -qi "access_token\|spectator_token\|edit_token"; then
  fail "get_league_tokens EXPOSED tokens to anon" "$TOKENS_BODY"
else
  pass "get_league_tokens blocks unauthenticated access"
fi

# --- 5. CORS ---
echo ""
echo "CORS headers:"

# Test with the current environment's frontend origin
CORS_ALLOWED=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "$SUPABASE_URL/functions/v1/make-pick" -H "Origin: $FRONTEND_URL" -H "Access-Control-Request-Method: POST")
if [ "$CORS_ALLOWED" = "204" ]; then
  pass "CORS preflight returns 204 for $ENV origin"
else
  fail "CORS preflight returned $CORS_ALLOWED for $ENV origin ($FRONTEND_URL)"
fi

# Always test prod origin too (it should always be allowed)
if [ "$ENV" = "qa" ]; then
  CORS_PROD=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "$SUPABASE_URL/functions/v1/make-pick" -H "Origin: https://draft-room-eta.vercel.app" -H "Access-Control-Request-Method: POST")
  if [ "$CORS_PROD" = "204" ]; then
    pass "CORS preflight returns 204 for prod origin"
  else
    fail "CORS preflight returned $CORS_PROD for prod origin"
  fi
fi

CORS_ORIGIN=$(curl -s -D - -o /dev/null -X OPTIONS "$SUPABASE_URL/functions/v1/make-pick" -H "Origin: https://evil-site.com" -H "Access-Control-Request-Method: POST" 2>&1 | grep -i "access-control-allow-origin" || echo "")
if echo "$CORS_ORIGIN" | grep -q "evil-site.com"; then
  fail "CORS allows evil-site.com"
else
  pass "CORS blocks unknown origins"
fi

# --- 6. Edge function liveness (all 9 functions) ---
echo ""
echo "Edge function liveness:"

for FN in $EDGE_FUNCTIONS; do
  FN_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "$SUPABASE_URL/functions/v1/$FN" -H "Origin: $FRONTEND_URL" -H "Access-Control-Request-Method: POST")
  if [ "$FN_CODE" = "204" ]; then
    pass "$FN deployed (OPTIONS 204)"
  else
    fail "$FN returned HTTP $FN_CODE (expected 204)"
  fi
done

# --- 7. Edge function request validation ---
echo ""
echo "Edge function validation:"

UUID_RESP=$(curl -s "$SUPABASE_URL/functions/v1/make-pick" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" -H "Content-Type: application/json" -d '{"leagueId":"not-a-uuid","captainId":"also-bad","playerId":"nope"}')
if echo "$UUID_RESP" | grep -qi "invalid.*uuid\|invalid.*id\|invalid.*field\|invalid.*format"; then
  pass "Edge function rejects invalid UUIDs"
else
  fail "Edge function UUID validation" "$UUID_RESP"
fi

# Content-Type enforcement (requireJson rejects non-JSON with 415)
CT_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$SUPABASE_URL/functions/v1/make-pick" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" -H "Content-Type: text/plain" -H "Origin: $FRONTEND_URL" -d 'not json')
if [ "$CT_CODE" = "415" ]; then
  pass "Edge function rejects non-JSON Content-Type (415)"
else
  fail "Edge function Content-Type enforcement returned $CT_CODE (expected 415)"
fi

# HTTP method enforcement (requirePost rejects GET with 405)
METHOD_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$SUPABASE_URL/functions/v1/make-pick" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" -H "Origin: $FRONTEND_URL")
if [ "$METHOD_CODE" = "405" ]; then
  pass "Edge function rejects GET method (405)"
else
  fail "Edge function method enforcement returned $METHOD_CODE (expected 405)"
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
