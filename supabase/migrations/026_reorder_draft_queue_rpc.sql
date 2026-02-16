-- Atomic reorder of captain draft queue entries.
-- Uses a single UPDATE with array_position to avoid the two-phase
-- negative-temp pattern that risked partial failures and corrupted positions.
CREATE OR REPLACE FUNCTION reorder_draft_queue(
  p_captain_id uuid,
  p_entry_ids uuid[]
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int;
BEGIN
  UPDATE public.captain_draft_queues
  SET position = array_position(p_entry_ids, id) - 1
  WHERE id = ANY(p_entry_ids)
    AND captain_id = p_captain_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated != array_length(p_entry_ids, 1) THEN
    RAISE EXCEPTION 'Not all entries belong to this captain (expected %, updated %)',
      array_length(p_entry_ids, 1), v_updated;
  END IF;
END;
$$;
