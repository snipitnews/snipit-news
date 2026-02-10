-- Draft summaries table for admin review workflow
-- AI generates drafts at 8 PM EST, editors review/approve, approved drafts sent at 6:45 AM EST

CREATE TABLE IF NOT EXISTS draft_summaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  topic TEXT NOT NULL,
  send_date DATE NOT NULL,
  is_paid BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'rejected')),
  original_summaries JSONB NOT NULL,   -- AI-generated (immutable after creation)
  edited_summaries JSONB NOT NULL,     -- Starts as copy of original, edits go here
  is_edited BOOLEAN NOT NULL DEFAULT FALSE,
  edited_by TEXT,
  approved_by TEXT,
  internal_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(topic, send_date, is_paid)
);

CREATE TABLE IF NOT EXISTS draft_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO draft_settings (key, value) VALUES ('unapproved_fallback', 'exclude');

CREATE INDEX idx_draft_summaries_send_date ON draft_summaries(send_date DESC);
CREATE INDEX idx_draft_summaries_status ON draft_summaries(status);
CREATE INDEX idx_draft_summaries_send_date_status ON draft_summaries(send_date, status);

ALTER TABLE draft_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on drafts" ON draft_summaries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on draft_settings" ON draft_settings FOR ALL USING (true) WITH CHECK (true);
