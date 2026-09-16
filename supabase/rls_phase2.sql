-- =============================================================
-- Phase 2: Multi-tenant RLS policies
-- Uses my_org_ids() and is_super_admin() from Phase 1
-- Associates cannot access finance tables
-- =============================================================

-- Helper: get caller's role within a specific org
CREATE OR REPLACE FUNCTION my_role_in_org(org uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM org_members WHERE org_id = org AND user_id = auth.uid()
$$;

-- ─────────────────────────────────────────
-- GENERAL ORG-SCOPED TABLES
-- Policy: any member of the org can read/write
-- ─────────────────────────────────────────

-- engagements
DROP POLICY IF EXISTS "auth_all_engagements" ON engagements;
CREATE POLICY "org_scoped_engagements" ON engagements
  FOR ALL TO authenticated
  USING (is_super_admin() OR org_id = ANY(my_org_ids()))
  WITH CHECK (is_super_admin() OR org_id = ANY(my_org_ids()));

-- companies
DROP POLICY IF EXISTS "auth_all_companies" ON companies;
CREATE POLICY "org_scoped_companies" ON companies
  FOR ALL TO authenticated
  USING (is_super_admin() OR org_id = ANY(my_org_ids()))
  WITH CHECK (is_super_admin() OR org_id = ANY(my_org_ids()));

-- tasks
DROP POLICY IF EXISTS "auth_all_tasks" ON tasks;
CREATE POLICY "org_scoped_tasks" ON tasks
  FOR ALL TO authenticated
  USING (is_super_admin() OR org_id = ANY(my_org_ids()))
  WITH CHECK (is_super_admin() OR org_id = ANY(my_org_ids()));

-- team_members
DROP POLICY IF EXISTS "auth_all_team_members" ON team_members;
CREATE POLICY "org_scoped_team_members" ON team_members
  FOR ALL TO authenticated
  USING (is_super_admin() OR org_id = ANY(my_org_ids()))
  WITH CHECK (is_super_admin() OR org_id = ANY(my_org_ids()));

-- contacts
DROP POLICY IF EXISTS "auth_all_contacts" ON contacts;
CREATE POLICY "org_scoped_contacts" ON contacts
  FOR ALL TO authenticated
  USING (is_super_admin() OR org_id = ANY(my_org_ids()))
  WITH CHECK (is_super_admin() OR org_id = ANY(my_org_ids()));

-- activity_log
DROP POLICY IF EXISTS "auth_all_activity_log" ON activity_log;
CREATE POLICY "org_scoped_activity_log" ON activity_log
  FOR ALL TO authenticated
  USING (is_super_admin() OR org_id = ANY(my_org_ids()))
  WITH CHECK (is_super_admin() OR org_id = ANY(my_org_ids()));

-- documents
DROP POLICY IF EXISTS "auth_all_documents" ON documents;
CREATE POLICY "org_scoped_documents" ON documents
  FOR ALL TO authenticated
  USING (is_super_admin() OR org_id = ANY(my_org_ids()))
  WITH CHECK (is_super_admin() OR org_id = ANY(my_org_ids()));

-- sows
DROP POLICY IF EXISTS "auth_all_sows" ON sows;
CREATE POLICY "org_scoped_sows" ON sows
  FOR ALL TO authenticated
  USING (is_super_admin() OR org_id = ANY(my_org_ids()))
  WITH CHECK (is_super_admin() OR org_id = ANY(my_org_ids()));

-- contractors
DROP POLICY IF EXISTS "auth_all_contractors" ON contractors;
CREATE POLICY "org_scoped_contractors" ON contractors
  FOR ALL TO authenticated
  USING (is_super_admin() OR org_id = ANY(my_org_ids()))
  WITH CHECK (is_super_admin() OR org_id = ANY(my_org_ids()));

-- sow_phases (scoped through parent sow)
DROP POLICY IF EXISTS "auth_all_sow_phases" ON sow_phases;
CREATE POLICY "org_scoped_sow_phases" ON sow_phases
  FOR ALL TO authenticated
  USING (is_super_admin() OR EXISTS (
    SELECT 1 FROM sows WHERE sows.id = sow_phases.sow_id AND sows.org_id = ANY(my_org_ids())
  ))
  WITH CHECK (is_super_admin() OR EXISTS (
    SELECT 1 FROM sows WHERE sows.id = sow_phases.sow_id AND sows.org_id = ANY(my_org_ids())
  ));

-- sow_deliverables (scoped through parent sow)
DROP POLICY IF EXISTS "auth_all_sow_deliverables" ON sow_deliverables;
CREATE POLICY "org_scoped_sow_deliverables" ON sow_deliverables
  FOR ALL TO authenticated
  USING (is_super_admin() OR EXISTS (
    SELECT 1 FROM sows WHERE sows.id = sow_deliverables.sow_id AND sows.org_id = ANY(my_org_ids())
  ))
  WITH CHECK (is_super_admin() OR EXISTS (
    SELECT 1 FROM sows WHERE sows.id = sow_deliverables.sow_id AND sows.org_id = ANY(my_org_ids())
  ));

-- ─────────────────────────────────────────
-- FINANCE TABLES: Admin + Partner only
-- Associates are blocked entirely
-- ─────────────────────────────────────────

-- invoices
DROP POLICY IF EXISTS "auth_all_invoices" ON invoices;
CREATE POLICY "finance_invoices" ON invoices
  FOR ALL TO authenticated
  USING (
    is_super_admin() OR (
      org_id = ANY(my_org_ids()) AND
      my_role_in_org(org_id) IN ('Admin', 'Partner')
    )
  )
  WITH CHECK (
    is_super_admin() OR (
      org_id = ANY(my_org_ids()) AND
      my_role_in_org(org_id) IN ('Admin', 'Partner')
    )
  );

-- expenses
DROP POLICY IF EXISTS "auth_all_expenses" ON expenses;
CREATE POLICY "finance_expenses" ON expenses
  FOR ALL TO authenticated
  USING (
    is_super_admin() OR (
      org_id = ANY(my_org_ids()) AND
      my_role_in_org(org_id) IN ('Admin', 'Partner')
    )
  )
  WITH CHECK (
    is_super_admin() OR (
      org_id = ANY(my_org_ids()) AND
      my_role_in_org(org_id) IN ('Admin', 'Partner')
    )
  );

-- revenue_items (no org_id yet — restrict to Admin/Partner by auth only for now)
DROP POLICY IF EXISTS "auth_all_revenue_items" ON revenue_items;
CREATE POLICY "finance_revenue_items" ON revenue_items
  FOR ALL TO authenticated
  USING (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM org_members
      WHERE user_id = auth.uid() AND role IN ('Admin', 'Partner')
    )
  )
  WITH CHECK (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM org_members
      WHERE user_id = auth.uid() AND role IN ('Admin', 'Partner')
    )
  );

-- distributions
DROP POLICY IF EXISTS "auth_all_distributions" ON distributions;
CREATE POLICY "finance_distributions" ON distributions
  FOR ALL TO authenticated
  USING (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM org_members
      WHERE user_id = auth.uid() AND role IN ('Admin', 'Partner')
    )
  )
  WITH CHECK (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM org_members
      WHERE user_id = auth.uid() AND role IN ('Admin', 'Partner')
    )
  );

-- contractor_payments
DROP POLICY IF EXISTS "auth_all_contractor_payments" ON contractor_payments;
CREATE POLICY "finance_contractor_payments" ON contractor_payments
  FOR ALL TO authenticated
  USING (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM org_members
      WHERE user_id = auth.uid() AND role IN ('Admin', 'Partner')
    )
  )
  WITH CHECK (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM org_members
      WHERE user_id = auth.uid() AND role IN ('Admin', 'Partner')
    )
  );

-- reimbursements
DROP POLICY IF EXISTS "auth_all_reimbursements" ON reimbursements;
CREATE POLICY "finance_reimbursements" ON reimbursements
  FOR ALL TO authenticated
  USING (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM org_members
      WHERE user_id = auth.uid() AND role IN ('Admin', 'Partner')
    )
  )
  WITH CHECK (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM org_members
      WHERE user_id = auth.uid() AND role IN ('Admin', 'Partner')
    )
  );

-- bank_balance
DROP POLICY IF EXISTS "auth_all_bank_balance" ON bank_balance;
CREATE POLICY "finance_bank_balance" ON bank_balance
  FOR ALL TO authenticated
  USING (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM org_members
      WHERE user_id = auth.uid() AND role IN ('Admin', 'Partner')
    )
  )
  WITH CHECK (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM org_members
      WHERE user_id = auth.uid() AND role IN ('Admin', 'Partner')
    )
  );

-- ─────────────────────────────────────────
-- PLATFORM / UTILITY TABLES
-- Authenticated only (no org scope needed)
-- ─────────────────────────────────────────

-- sow_templates are global/shared — any org member can read
DROP POLICY IF EXISTS "auth_all_sow_templates" ON sow_templates;
CREATE POLICY "auth_sow_templates" ON sow_templates
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- notification_settings — user's own settings
DROP POLICY IF EXISTS "auth_all_notification_settings" ON notification_settings;
CREATE POLICY "own_notification_settings" ON notification_settings
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- notification_log
DROP POLICY IF EXISTS "auth_all_notification_log" ON notification_log;
CREATE POLICY "auth_notification_log" ON notification_log
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- webhook_events — platform-level
DROP POLICY IF EXISTS "auth_all_webhook_events" ON webhook_events;
CREATE POLICY "auth_webhook_events" ON webhook_events
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- cron_log — platform-level
DROP POLICY IF EXISTS "auth_all_cron_log" ON cron_log;
CREATE POLICY "auth_cron_log" ON cron_log
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- integrations — authenticated
DROP POLICY IF EXISTS "auth_all_integrations" ON integrations;
CREATE POLICY "auth_integrations" ON integrations
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────
-- TIGHTEN NEW TABLE POLICIES
-- ─────────────────────────────────────────

-- orgs: members can see their own orgs; super admin sees all
DROP POLICY IF EXISTS "super_admin_all_orgs" ON orgs;
CREATE POLICY "orgs_visibility" ON orgs
  FOR ALL TO authenticated
  USING (is_super_admin() OR id = ANY(my_org_ids()))
  WITH CHECK (is_super_admin());

-- org_members: members see their own org's roster; super admin sees all
DROP POLICY IF EXISTS "members_see_own_memberships" ON org_members;
CREATE POLICY "org_members_visibility" ON org_members
  FOR SELECT TO authenticated
  USING (is_super_admin() OR org_id = ANY(my_org_ids()));
CREATE POLICY "org_members_admin_write" ON org_members
  FOR ALL TO authenticated
  USING (is_super_admin() OR (org_id = ANY(my_org_ids()) AND my_role_in_org(org_id) = 'Admin'))
  WITH CHECK (is_super_admin() OR (org_id = ANY(my_org_ids()) AND my_role_in_org(org_id) = 'Admin'));

-- org_invites: org admins manage invites
DROP POLICY IF EXISTS "admins_manage_invites" ON org_invites;
CREATE POLICY "org_invites_policy" ON org_invites
  FOR ALL TO authenticated
  USING (is_super_admin() OR (org_id = ANY(my_org_ids()) AND my_role_in_org(org_id) = 'Admin'))
  WITH CHECK (is_super_admin() OR (org_id = ANY(my_org_ids()) AND my_role_in_org(org_id) = 'Admin'));

-- nouvelleed_enrollments (legacy — keep accessible for now)
DROP POLICY IF EXISTS "auth_all_nouvelleed" ON nouvelleed_enrollments;
CREATE POLICY "org_scoped_nouvelleed" ON nouvelleed_enrollments
  FOR ALL TO authenticated
  USING (is_super_admin() OR org_id = ANY(my_org_ids()))
  WITH CHECK (is_super_admin() OR org_id = ANY(my_org_ids()));
