-- Add field_options JSONB column to league_field_schemas
-- Stores type-specific configuration:
--   number: { "unit": "lbs" }
--   date: { "includeTime": true }
--   dropdown: { "options": ["Forward", "Defense", "Goalie"] }
--   checkbox: { "label": "Has prior experience" }
--   text: null

ALTER TABLE league_field_schemas
  ADD COLUMN IF NOT EXISTS field_options jsonb DEFAULT NULL;
