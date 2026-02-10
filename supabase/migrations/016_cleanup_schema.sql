-- Drop orphaned phone_number column (added in 003, never used, not in SELECT grants).
ALTER TABLE players DROP COLUMN IF EXISTS phone_number;

-- Add CHECK constraint on field_type to enforce valid values.
ALTER TABLE league_field_schemas
ADD CONSTRAINT league_field_schemas_field_type_check
CHECK (field_type IN ('text', 'number', 'date', 'dropdown', 'checkbox'));
