-- Grant SELECT on the new consecutive_timeout_picks column to anon and authenticated roles.
-- Column-level grants (migration 014) require explicit grants for every new column.

GRANT SELECT (consecutive_timeout_picks) ON captains TO anon, authenticated;
