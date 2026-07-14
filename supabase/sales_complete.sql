-- Complete sales cycle schema

-- Engagement categorization (for scoping onboarding templates)
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS engagement_category text DEFAULT 'verite_client'
  CHECK (engagement_category IN ('nouvelleed', 'verite_client', 'other'));

-- Demo tracking
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS demo_date date;
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS demo_outcome text DEFAULT ''
  CHECK (demo_outcome IN ('','positive','neutral','negative','no_show'));
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS demo_notes text DEFAULT '';

-- Reference call tracking
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS reference_call_agreed boolean DEFAULT false;
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS reference_call_contact text DEFAULT '';

-- Enhanced win/loss
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS competitor_name text DEFAULT '';

-- Signature reminder tracking
ALTER TABLE sows ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

-- Backfill stage_history for existing deals based on created_at and current stage
UPDATE engagements
SET stage_history = jsonb_build_object(stage, created_at::date::text)
WHERE stage_history = '{}' OR stage_history IS NULL;
