#!/usr/bin/env bash
#
# Deploy only the Supabase edge functions that have changed since the last deploy.
# Usage: ./scripts/deploy-functions.sh [qa|prod] [--all]
#
# Flags:
#   --all   Force deploy all functions regardless of changes
#
# The script stores the last-deployed commit SHA per environment in
# .last-deploy-<env> (gitignored). On first run or with --all, deploys everything.
#
set -euo pipefail

ENV="${1:-prod}"
FORCE_ALL=false
for arg in "$@"; do
  if [ "$arg" = "--all" ]; then
    FORCE_ALL=true
  fi
done

if [ "$ENV" = "qa" ]; then
  PROJECT_REF="goyzyylpthhqotjdsmjn"
elif [ "$ENV" = "prod" ]; then
  PROJECT_REF="ghjakbnibbxwlbujwsse"
else
  echo "Usage: $0 [qa|prod] [--all]"
  exit 1
fi

ALL_FUNCTIONS=(make-pick auto-pick toggle-auto-pick update-player-profile update-captain-color restart-draft undo-pick)
MARKER_FILE=".last-deploy-functions-${ENV}"
CURRENT_SHA=$(git rev-parse HEAD)

# Determine which functions need deploying
if [ "$FORCE_ALL" = true ]; then
  echo "Force deploying all functions to $ENV..."
  TO_DEPLOY=("${ALL_FUNCTIONS[@]}")
elif [ ! -f "$MARKER_FILE" ]; then
  echo "No previous deploy marker found for $ENV. Deploying all functions..."
  TO_DEPLOY=("${ALL_FUNCTIONS[@]}")
else
  LAST_SHA=$(cat "$MARKER_FILE")
  if [ "$LAST_SHA" = "$CURRENT_SHA" ]; then
    echo "No new commits since last deploy to $ENV ($CURRENT_SHA). Nothing to deploy."
    exit 0
  fi

  # Check if _shared/ changed (affects all functions)
  SHARED_CHANGED=$(git diff --name-only "$LAST_SHA" HEAD -- supabase/functions/_shared/ | head -1)
  if [ -n "$SHARED_CHANGED" ]; then
    echo "Shared utilities changed. Deploying all functions to $ENV..."
    TO_DEPLOY=("${ALL_FUNCTIONS[@]}")
  else
    # Check each function directory individually
    TO_DEPLOY=()
    for fn in "${ALL_FUNCTIONS[@]}"; do
      CHANGED=$(git diff --name-only "$LAST_SHA" HEAD -- "supabase/functions/${fn}/" | head -1)
      if [ -n "$CHANGED" ]; then
        TO_DEPLOY+=("$fn")
      fi
    done
  fi
fi

if [ ${#TO_DEPLOY[@]} -eq 0 ]; then
  echo "No edge function changes detected since last deploy to $ENV. Skipping."
  echo "$CURRENT_SHA" > "$MARKER_FILE"
  exit 0
fi

echo ""
echo "Deploying ${#TO_DEPLOY[@]} function(s) to $ENV: ${TO_DEPLOY[*]}"
echo ""

FAILED=0
for fn in "${TO_DEPLOY[@]}"; do
  echo "--- Deploying $fn ---"
  if supabase functions deploy "$fn" --no-verify-jwt --project-ref "$PROJECT_REF" 2>&1; then
    echo ""
  else
    echo "  FAILED to deploy $fn"
    FAILED=$((FAILED + 1))
  fi
done

if [ "$FAILED" -gt 0 ]; then
  echo "ERROR: $FAILED function(s) failed to deploy."
  exit 1
fi

# Record successful deploy
echo "$CURRENT_SHA" > "$MARKER_FILE"
echo "All functions deployed successfully to $ENV. Marker updated to $CURRENT_SHA."
