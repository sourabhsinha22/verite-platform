-- Outreach schema: extended pipeline stages + source attribution + Apollo fields

-- ─────────────────────────────────────────
-- Extend engagement stage constraint
-- ─────────────────────────────────────────
-- Add new pre-contract stages: prospect → engaged → qualified → proposal_sent
-- These precede the existing: active, paused, closed

ALTER TABLE engagements DROP CONSTRAINT IF EXISTS engagements_stage_check;
ALTER TABLE engagements ADD CONSTRAINT engagements_stage_check
  CHECK (stage IN (
    'prospect',      -- In Apollo sequence, no response yet
    'engaged',       -- Replied, clicked, or showed interest
    'qualified',     -- Discovery call done, fit confirmed
    'proposal_sent', -- Founding partner agreement / SOW sent
    'lead',          -- Legacy (keep for backward compat)
    'opportunity',   -- Legacy
    'active',
    'paused',
    'closed'
  ));

-- ─────────────────────────────────────────
-- Source attribution on engagements
-- ─────────────────────────────────────────
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS source text DEFAULT 'unknown'
  CHECK (source IN ('apollo_sequence','conference','inbound','referral','founder_network','unknown'));

ALTER TABLE engagements ADD COLUMN IF NOT EXISTS source_detail text DEFAULT '';

-- ─────────────────────────────────────────
-- Apollo-specific fields on engagements
-- ─────────────────────────────────────────
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS apollo_contact_id   text DEFAULT '';
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS apollo_sequence_id  text DEFAULT '';
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS apollo_sequence_name text DEFAULT '';
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS prospect_email      text DEFAULT '';
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS prospect_title      text DEFAULT '';

-- ─────────────────────────────────────────
-- Apollo integration settings (one row per org)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS integrations (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider      text NOT NULL UNIQUE,  -- 'apollo', 'quickbooks', etc.
  api_key       text DEFAULT '',
  webhook_secret text DEFAULT '',
  config        jsonb DEFAULT '{}',
  connected_at  timestamptz,
  last_sync_at  timestamptz,
  status        text DEFAULT 'disconnected' CHECK (status IN ('connected','disconnected','error')),
  error_message text DEFAULT '',
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_integrations" ON integrations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed Apollo integration row
INSERT INTO integrations (provider, status) VALUES ('apollo', 'disconnected')
  ON CONFLICT (provider) DO NOTHING;

-- ─────────────────────────────────────────
-- Webhook event log (for debugging/audit)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhook_events (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider     text NOT NULL,
  event_type   text NOT NULL,
  payload      jsonb NOT NULL DEFAULT '{}',
  processed    boolean DEFAULT false,
  result       text DEFAULT '',
  received_at  timestamptz DEFAULT now()
);

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_webhook_events" ON webhook_events
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
