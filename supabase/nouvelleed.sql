-- NouvelleED enrollment tracking (snapshot history per client)
CREATE TABLE IF NOT EXISTS nouvelleed_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id uuid REFERENCES engagements(id) ON DELETE CASCADE,
  report_date date NOT NULL DEFAULT CURRENT_DATE,
  total_enrolled integer DEFAULT 0,
  active_learners integer DEFAULT 0,
  completions_this_month integer DEFAULT 0,
  total_completions integer DEFAULT 0,
  ce_certs_issued integer DEFAULT 0,
  modules_live integer DEFAULT 0,
  avg_completion_pct numeric(5,2) DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE nouvelleed_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_nouvelleed" ON nouvelleed_enrollments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Weekly client status email opt-in per engagement
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS status_email_enabled boolean DEFAULT false;
