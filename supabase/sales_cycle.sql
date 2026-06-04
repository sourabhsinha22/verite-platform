-- Sales cycle improvements: next action, win/loss, outcomes, stage velocity, Calendly

-- Next action on engagements
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS next_action text DEFAULT '';
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS next_action_date date;

-- Win/loss capture when closing
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS win_loss_category text
  CHECK (win_loss_category IN ('won','price','timing','competitor','baa_required','no_budget','wrong_fit','champion_left','no_response',NULL));
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS win_loss_reason text DEFAULT '';

-- Outcomes tracking (for case studies)
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS outcomes jsonb DEFAULT '{}';
-- outcomes shape: { time_saved_hours, modules_created, ce_certs_issued, case_study_ready, outcome_notes }

-- Stage velocity tracking
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS stage_history jsonb DEFAULT '{}';
-- stage_history shape: { "prospect": "2026-06-01", "engaged": "2026-06-03", ... }
-- Populated when stage changes

-- Calendly URL per team member
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS calendly_url text DEFAULT '';

-- SOW signature tracking
ALTER TABLE sows ADD COLUMN IF NOT EXISTS signature_requested_at timestamptz;
ALTER TABLE sows ADD COLUMN IF NOT EXISTS signature_requested_to text DEFAULT '';
ALTER TABLE sows ADD COLUMN IF NOT EXISTS signature_link text DEFAULT '';
