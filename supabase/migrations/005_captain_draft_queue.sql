-- Captain Draft Queue feature
-- Allows captains to maintain a private, ordered queue of players they want to draft

-- Add auto_pick_enabled column to captains table
ALTER TABLE captains ADD COLUMN IF NOT EXISTS auto_pick_enabled boolean DEFAULT false NOT NULL;

-- Create captain_draft_queues table
CREATE TABLE IF NOT EXISTS captain_draft_queues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  captain_id uuid REFERENCES captains(id) ON DELETE CASCADE NOT NULL,
  player_id uuid REFERENCES players(id) ON DELETE CASCADE NOT NULL,
  position integer NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(captain_id, player_id),
  UNIQUE(captain_id, position)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_captain_queues_captain ON captain_draft_queues(captain_id);
CREATE INDEX IF NOT EXISTS idx_captain_queues_player ON captain_draft_queues(player_id);

-- Enable RLS
ALTER TABLE captain_draft_queues ENABLE ROW LEVEL SECURITY;

-- RLS policy - allow all operations (edge functions need access, captains manage their own)
CREATE POLICY "Allow all operations on captain_draft_queues"
  ON captain_draft_queues FOR ALL USING (true) WITH CHECK (true);
