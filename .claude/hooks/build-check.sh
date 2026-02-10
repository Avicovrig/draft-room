#!/bin/bash
# Stop hook: Run TypeScript type-check after Claude finishes responding.
# Exit 2 with stderr feedback if errors found (Claude sees them and should fix).
# Exit 0 if clean.

# Read stdin (required by hook protocol, discard it)
cat > /dev/null

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_DIR" || exit 0

# Run TypeScript type-check only (faster than full vite build)
output=$(npx tsc -b --noEmit 2>&1)
exit_code=$?

if [ $exit_code -ne 0 ]; then
    error_count=$(echo "$output" | grep -c "error TS" || true)

    if [ "$error_count" -eq 0 ]; then
        # tsc failed but no TS errors found in output (maybe config issue)
        exit 0
    fi

    echo "" >&2
    echo "--- BUILD CHECK ---" >&2
    echo "TypeScript errors found: $error_count" >&2
    echo "" >&2
    echo "$output" | grep "error TS" | head -20 >&2
    if [ "$error_count" -gt 20 ]; then
        echo "" >&2
        echo "... and $((error_count - 20)) more errors. Run 'npm run build' for full output." >&2
    fi
    echo "--- END BUILD CHECK ---" >&2

    # Exit 2 = feedback to Claude (blocks stop, Claude should fix errors)
    exit 2
fi

exit 0
