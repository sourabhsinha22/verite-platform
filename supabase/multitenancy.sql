-- =============================================================
-- Multi-tenancy + White-label Migration
-- Phase 1: Schema creation + backfill (no RLS changes yet)
-- Run in Supabase SQL editor — safe to run on live data
-- =============================================================

-- ─────────────────────────────────────────
-- 1. ORGS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orgs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  slug       text UNIQUE NOT NULL,
  brand      jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE orgs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super_admin_all_orgs" ON orgs
  FOR ALL TO authenticated
  USING (true)   -- tightened in Phase 2
  WITH CHECK (true);

-- ─────────────────────────────────────────
-- 2. ORG MEMBERS (user ↔ org, with role)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS org_members (
  org_id     uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'Associate'
               CHECK (role IN ('Admin', 'Partner', 'Associate')),
  invited_by uuid REFERENCES auth.users(id),
  joined_at  timestamptz DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);

ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members_see_own_memberships" ON org_members
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─────────────────────────────────────────
-- 3. PLATFORM ADMINS (super admin flag)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_admins (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES auth.users(id),
  granted_at timestamptz DEFAULT now()
);

-- No RLS on platform_admins — service role only

-- ─────────────────────────────────────────
-- 4. ORG INVITES (pending invite tokens)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS org_invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  email       text NOT NULL,
  role        text NOT NULL DEFAULT 'Associate'
                CHECK (role IN ('Admin', 'Partner', 'Associate')),
  token       uuid UNIQUE DEFAULT gen_random_uuid(),
  expires_at  timestamptz DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  invited_by  uuid REFERENCES auth.users(id),
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE org_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_manage_invites" ON org_invites
  FOR ALL TO authenticated
  USING (true)   -- tightened in Phase 2
  WITH CHECK (true);

-- ─────────────────────────────────────────
-- 5. HELPER FUNCTIONS
-- ─────────────────────────────────────────

-- Returns all org_ids the current user belongs to
CREATE OR REPLACE FUNCTION my_org_ids()
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT ARRAY(
    SELECT org_id FROM org_members WHERE user_id = auth.uid()
  )
$$;

-- Returns true if the current user is a super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS(
    SELECT 1 FROM platform_admins WHERE user_id = auth.uid()
  )
$$;

-- ─────────────────────────────────────────
-- 6. SEED: first org (Vérité Health)
-- ─────────────────────────────────────────
INSERT INTO orgs (name, slug, brand)
VALUES (
  'Vérité Health Collective',
  'verite-health',
  '{
    "product_name": "Vérité Platform",
    "primary": "#2f2e4b",
    "accent": "#5f3e3f",
    "powered_by": true
  }'
)
ON CONFLICT (slug) DO NOTHING;

-- ─────────────────────────────────────────
-- 7. ADD org_id TO EXISTING TABLES
-- ─────────────────────────────────────────

ALTER TABLE engagements  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES orgs(id);
ALTER TABLE companies    ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES orgs(id);
ALTER TABLE invoices     ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES orgs(id);
ALTER TABLE tasks        ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES orgs(id);
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES orgs(id);
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE contacts     ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES orgs(id);
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES orgs(id);
ALTER TABLE documents    ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES orgs(id);
ALTER TABLE sows         ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES orgs(id);
ALTER TABLE contractors  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES orgs(id);
ALTER TABLE expenses     ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES orgs(id);

-- Conditionally add to tables that may or may not exist
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'nouvelleed_enrollments') THEN
    ALTER TABLE nouvelleed_enrollments ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES orgs(id);
  END IF;
END $$;

-- ─────────────────────────────────────────
-- 8. BACKFILL: set org_id on all existing rows
-- ─────────────────────────────────────────

DO $$
DECLARE
  verite_org_id uuid;
BEGIN
  SELECT id INTO verite_org_id FROM orgs WHERE slug = 'verite-health';

  UPDATE engagements  SET org_id = verite_org_id WHERE org_id IS NULL;
  UPDATE companies    SET org_id = verite_org_id WHERE org_id IS NULL;
  UPDATE invoices     SET org_id = verite_org_id WHERE org_id IS NULL;
  UPDATE tasks        SET org_id = verite_org_id WHERE org_id IS NULL;
  UPDATE team_members SET org_id = verite_org_id WHERE org_id IS NULL;
  UPDATE contacts     SET org_id = verite_org_id WHERE org_id IS NULL;
  UPDATE activity_log SET org_id = verite_org_id WHERE org_id IS NULL;
  UPDATE documents    SET org_id = verite_org_id WHERE org_id IS NULL;
  UPDATE sows         SET org_id = verite_org_id WHERE org_id IS NULL;
  UPDATE contractors  SET org_id = verite_org_id WHERE org_id IS NULL;
  UPDATE expenses     SET org_id = verite_org_id WHERE org_id IS NULL;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'nouvelleed_enrollments') THEN
    EXECUTE 'UPDATE nouvelleed_enrollments SET org_id = $1 WHERE org_id IS NULL' USING verite_org_id;
  END IF;

  RAISE NOTICE 'Backfill complete. Org ID: %', verite_org_id;
END $$;

-- ─────────────────────────────────────────
-- 9. ENFORCE NOT NULL after backfill
-- ─────────────────────────────────────────
ALTER TABLE engagements  ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE companies    ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE invoices     ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE tasks        ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE team_members ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE contacts     ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE documents    ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE sows         ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE contractors  ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE expenses     ALTER COLUMN org_id SET NOT NULL;

-- ─────────────────────────────────────────
-- 10. VERIFY (run this to confirm success)
-- ─────────────────────────────────────────
-- SELECT 'orgs' as tbl, count(*) FROM orgs
-- UNION ALL SELECT 'engagements without org_id', count(*) FROM engagements WHERE org_id IS NULL
-- UNION ALL SELECT 'companies without org_id', count(*) FROM companies WHERE org_id IS NULL
-- UNION ALL SELECT 'invoices without org_id', count(*) FROM invoices WHERE org_id IS NULL
-- UNION ALL SELECT 'tasks without org_id', count(*) FROM tasks WHERE org_id IS NULL;
