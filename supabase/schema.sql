-- Vérité Platform — Database Schema
-- Run this in your Supabase SQL editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────
-- COMPANIES (CRM top-level record)
-- ─────────────────────────────────────────
create table companies (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  tag         text not null default 'prospect' check (tag in ('current','prospect','past')),
  industry    text,
  size        text,
  website     text,
  address     text,
  notes       text,
  account_owner text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ─────────────────────────────────────────
-- CONTACTS (belong to companies)
-- ─────────────────────────────────────────
create table contacts (
  id           uuid primary key default uuid_generate_v4(),
  company_id   uuid references companies(id) on delete cascade,
  name         text not null default '',
  title        text default '',
  department   text default '',
  email        text default '',
  phone        text default '',
  linkedin     text default '',
  notes        text default '',
  is_primary   boolean default false,
  created_at   timestamptz default now()
);

-- ─────────────────────────────────────────
-- ENGAGEMENTS
-- ─────────────────────────────────────────
create table engagements (
  id                uuid primary key default uuid_generate_v4(),
  company_id        uuid references companies(id) on delete cascade,
  name              text not null,
  engagement_type   text not null check (engagement_type in ('opportunity','project-based','sales-growth','care-model')),
  stage             text not null default 'active' check (stage in ('lead','opportunity','active','paused','closed')),
  lead              text default '',
  start_date        date,
  end_date          date,
  contract_value    numeric(12,2),
  revenue_type      text check (revenue_type in ('retainer','revenue-share','project','hourly')),
  revenue_share_pct numeric(5,2),
  notes             text default '',
  health            text default 'green' check (health in ('green','yellow','red')),
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- ─────────────────────────────────────────
-- TASKS
-- ─────────────────────────────────────────
create table tasks (
  id             uuid primary key default uuid_generate_v4(),
  engagement_id  uuid references engagements(id) on delete cascade,
  title          text not null,
  owner          text default '',
  due_date       date,
  status         text not null default 'not-started' check (status in ('not-started','in-progress','blocked','done')),
  priority       text default 'medium' check (priority in ('low','medium','high')),
  notes          text default '',
  task_group     text not null default 'project' check (task_group in ('sales','project','custom')),
  sort_order     integer default 0,
  created_at     timestamptz default now()
);

-- ─────────────────────────────────────────
-- REVENUE ITEMS (forecast + actuals)
-- ─────────────────────────────────────────
create table revenue_items (
  id               uuid primary key default uuid_generate_v4(),
  engagement_id    uuid references engagements(id) on delete cascade,
  label            text not null default '',
  month            text,          -- YYYY-MM format
  milestone        text,
  forecast_amount  numeric(12,2) not null default 0,
  actual_amount    numeric(12,2),
  notes            text default '',
  sort_order       integer default 0,
  created_at       timestamptz default now()
);

-- ─────────────────────────────────────────
-- INVOICES
-- ─────────────────────────────────────────
create table invoices (
  id              uuid primary key default uuid_generate_v4(),
  engagement_id   uuid references engagements(id) on delete cascade,
  company_id      uuid references companies(id),
  invoice_number  text not null,
  amount          numeric(12,2) not null,
  date_sent       date,
  due_date        date,
  paid_date       date,
  status          text not null default 'draft' check (status in ('draft','sent','paid','overdue')),
  notes           text default '',
  created_at      timestamptz default now()
);

-- ─────────────────────────────────────────
-- TEAM MEMBERS (app-level, not auth users)
-- ─────────────────────────────────────────
create table team_members (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  email      text,
  role       text default '',
  created_at timestamptz default now()
);

-- ─────────────────────────────────────────
-- UPDATED_AT triggers
-- ─────────────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger companies_updated_at before update on companies
  for each row execute function update_updated_at();

create trigger engagements_updated_at before update on engagements
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────
-- SEED DATA — Vérité Health Collective
-- ─────────────────────────────────────────

-- Team members
insert into team_members (name, email, role) values
  ('Tana Whitt', 'tana@veritehealth.com', 'Partner'),
  ('Shannon Chema', 'shannon@veritehealth.com', 'Partner'),
  ('Charissa Duffy', 'charissa@veritehealth.com', 'Partner');

-- Companies
insert into companies (id, name, tag, industry, account_owner) values
  ('11111111-0000-0000-0000-000000000001', 'PHA — Psych Health Associates', 'current', 'Behavioral Health', 'Tana Whitt'),
  ('11111111-0000-0000-0000-000000000002', 'ViaQuest', 'current', 'Behavioral Health / IDD', 'Charissa Duffy'),
  ('11111111-0000-0000-0000-000000000003', 'Alliance Medical Team', 'current', 'Post-Acute Care', 'Charissa Duffy'),
  ('11111111-0000-0000-0000-000000000004', 'eMerge Senior Care', 'current', 'Senior Care', 'Shannon Chema'),
  ('11111111-0000-0000-0000-000000000005', 'QuickMed', 'current', 'Healthcare', 'Tana Whitt'),
  ('11111111-0000-0000-0000-000000000006', 'PsychNow', 'prospect', 'Behavioral Health', 'Tana Whitt'),
  ('11111111-0000-0000-0000-000000000007', 'Senior Care Therapy', 'prospect', 'Senior Care', 'Tana Whitt'),
  ('11111111-0000-0000-0000-000000000008', 'Black Hills Post Acute Care', 'prospect', 'Post-Acute Care', 'Charissa Duffy'),
  ('11111111-0000-0000-0000-000000000009', 'Bespoke', 'prospect', 'Healthcare', 'Tana Whitt'),
  ('11111111-0000-0000-0000-000000000010', 'Novenza', 'prospect', 'Healthcare', 'Tana Whitt');

-- PHA Contacts
insert into contacts (company_id, name, title, email) values
  ('11111111-0000-0000-0000-000000000001', 'Jim Laidly', 'CSTO', ''),
  ('11111111-0000-0000-0000-000000000001', 'Susannah Lich', 'Director of BHI', ''),
  ('11111111-0000-0000-0000-000000000001', 'Shannon Abbott', 'CEO', ''),
  ('11111111-0000-0000-0000-000000000001', 'Luisa Vega', 'President', '');

-- ViaQuest Contacts
insert into contacts (company_id, name, title) values
  ('11111111-0000-0000-0000-000000000002', 'Kayla Bell', 'CGO'),
  ('11111111-0000-0000-0000-000000000002', 'Michael Bell', 'COO'),
  ('11111111-0000-0000-0000-000000000002', 'Anne Nash', 'CCO');

-- Alliance Contacts
insert into contacts (company_id, name, title) values
  ('11111111-0000-0000-0000-000000000003', 'Dr. Wesam Moustafa', 'Physician'),
  ('11111111-0000-0000-0000-000000000003', 'Nowman Karram', ''),
  ('11111111-0000-0000-0000-000000000003', 'Mona Moussa', '');

-- Engagements
insert into engagements (id, company_id, name, engagement_type, stage, lead, start_date, revenue_type, notes) values
  ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'PHA — Care Model', 'care-model', 'active', 'Tana Whitt', '2026-01-01', 'retainer', 'BHI/BHCM rollout. Currently in active phase.'),
  ('22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001', 'PHA — IRH Model of Care', 'project-based', 'active', 'Shannon Chema', '2026-01-01', 'project', 'IRH manual and workflow updates in progress.'),
  ('22222222-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000001', 'PHA — Telehealth Model', 'project-based', 'active', 'Tana Whitt', '2026-01-01', 'project', 'Carebrain contract pending.'),
  ('22222222-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000002', 'ViaQuest — Care Model', 'care-model', 'active', 'Tana Whitt', '2026-04-01', 'revenue-share', 'Currently in Pilot phase. 15% Vérité revenue share.'),
  ('22222222-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000002', 'ViaQuest — Psychological Testing', 'project-based', 'active', 'Charissa Duffy', '2026-05-01', 'project', 'Contract signed.'),
  ('22222222-0000-0000-0000-000000000006', '11111111-0000-0000-0000-000000000003', 'Alliance Medical — Majestic Care Sales', 'sales-growth', 'active', 'Charissa Duffy', '2026-05-01', 'project', ''),
  ('22222222-0000-0000-0000-000000000007', '11111111-0000-0000-0000-000000000003', 'Alliance Medical — Saber Sales', 'sales-growth', 'active', 'Charissa Duffy', '2026-05-01', 'project', ''),
  ('22222222-0000-0000-0000-000000000008', '11111111-0000-0000-0000-000000000004', 'eMerge — Fractional CPO', 'project-based', 'active', 'Shannon Chema', '2026-04-01', 'project', '120-day engagement.'),
  ('22222222-0000-0000-0000-000000000009', '11111111-0000-0000-0000-000000000004', 'eMerge — Advisory Retainer', 'sales-growth', 'active', 'Shannon Chema', '2026-04-01', 'retainer', '$5K/mo advisory.'),
  ('22222222-0000-0000-0000-000000000010', '11111111-0000-0000-0000-000000000006', 'PsychNow', 'care-model', 'opportunity', 'Tana Whitt', '2026-05-01', 'retainer', 'Pending contract.');

-- Tasks — PHA Care Model
insert into tasks (engagement_id, title, task_group, status, owner, sort_order) values
  ('22222222-0000-0000-0000-000000000001', 'Initial kickoff', 'sales', 'done', 'Tana Whitt', 1),
  ('22222222-0000-0000-0000-000000000001', 'Contract signed', 'sales', 'done', 'Tana Whitt', 2),
  ('22222222-0000-0000-0000-000000000001', 'Rollout — active', 'project', 'in-progress', 'Tana Whitt', 1),
  ('22222222-0000-0000-0000-000000000001', 'Consent packets — verify at all facilities', 'project', 'blocked', 'Shannon Chema', 2),
  ('22222222-0000-0000-0000-000000000001', 'BHI Training program', 'project', 'not-started', 'Charissa Duffy', 3),
  ('22222222-0000-0000-0000-000000000001', 'BHCM Training program', 'project', 'not-started', 'Charissa Duffy', 4),
  ('22222222-0000-0000-0000-000000000001', 'Tagging all facilities', 'project', 'in-progress', 'Tana Whitt', 5),
  ('22222222-0000-0000-0000-000000000001', 'Reports — weekly from Nitan team', 'project', 'in-progress', 'Tana Whitt', 6),
  ('22222222-0000-0000-0000-000000000001', 'Billing numbers — weekly from Max', 'project', 'in-progress', 'Tana Whitt', 7),
  ('22222222-0000-0000-0000-000000000001', 'Recruitment', 'project', 'in-progress', 'Shannon Chema', 8);

-- Tasks — ViaQuest Care Model
insert into tasks (engagement_id, title, task_group, status, owner, sort_order) values
  ('22222222-0000-0000-0000-000000000004', 'Initial kickoff', 'sales', 'done', 'Tana Whitt', 1),
  ('22222222-0000-0000-0000-000000000004', 'Contract signed', 'sales', 'done', 'Tana Whitt', 2),
  ('22222222-0000-0000-0000-000000000004', 'Territory analysis & rollout planning', 'project', 'in-progress', 'Tana Whitt', 1),
  ('22222222-0000-0000-0000-000000000004', 'EHR setup', 'project', 'in-progress', 'Charissa Duffy', 2),
  ('22222222-0000-0000-0000-000000000004', 'Workflows', 'project', 'in-progress', 'Charissa Duffy', 3),
  ('22222222-0000-0000-0000-000000000004', 'Staff training', 'project', 'not-started', 'Charissa Duffy', 4),
  ('22222222-0000-0000-0000-000000000004', 'Data capture & reporting', 'project', 'not-started', 'Tana Whitt', 5),
  ('22222222-0000-0000-0000-000000000004', 'Weekly meetings (recurring)', 'project', 'in-progress', 'Tana Whitt', 6);

-- Tasks — ViaQuest Psych Testing
insert into tasks (engagement_id, title, task_group, status, owner, sort_order) values
  ('22222222-0000-0000-0000-000000000005', 'Contract signed', 'sales', 'done', 'Charissa Duffy', 1),
  ('22222222-0000-0000-0000-000000000005', 'Psychological Testing Process Manual', 'project', 'not-started', 'Charissa Duffy', 1),
  ('22222222-0000-0000-0000-000000000005', 'CPT coding sheet', 'project', 'not-started', 'Charissa Duffy', 2),
  ('22222222-0000-0000-0000-000000000005', 'Workflow', 'project', 'not-started', 'Charissa Duffy', 3),
  ('22222222-0000-0000-0000-000000000005', 'Referral process', 'project', 'not-started', 'Charissa Duffy', 4),
  ('22222222-0000-0000-0000-000000000005', 'Documentation', 'project', 'not-started', 'Charissa Duffy', 5);

-- Revenue items — ViaQuest Care Model
insert into revenue_items (engagement_id, label, month, forecast_amount, actual_amount, sort_order) values
  ('22222222-0000-0000-0000-000000000004', 'Pilot Launch', '2026-05', 6204, null, 1),
  ('22222222-0000-0000-0000-000000000004', 'Pilot Expansion', '2026-06', 16062, null, 2),
  ('22222222-0000-0000-0000-000000000004', 'Phase 1 Roll out', '2026-07', 29574, null, 3),
  ('22222222-0000-0000-0000-000000000004', 'Phase 2 Roll out', '2026-08', 51840, null, 4),
  ('22222222-0000-0000-0000-000000000004', 'Phase 3 Roll out', '2026-09', 80310, null, 5);

-- Revenue items — PHA Care Model
insert into revenue_items (engagement_id, label, month, forecast_amount, actual_amount, sort_order) values
  ('22222222-0000-0000-0000-000000000001', 'Retainer — Jan 2026', '2026-01', 30000, 30000, 1),
  ('22222222-0000-0000-0000-000000000001', 'Retainer — Feb 2026', '2026-02', 30000, 30000, 2),
  ('22222222-0000-0000-0000-000000000001', 'Retainer — Mar 2026', '2026-03', 30000, 30000, 3),
  ('22222222-0000-0000-0000-000000000001', 'Retainer — Apr 2026', '2026-04', 30000, 30000, 4),
  ('22222222-0000-0000-0000-000000000001', 'Retainer — May 2026', '2026-05', 30000, null, 5),
  ('22222222-0000-0000-0000-000000000001', 'Retainer — Jun 2026', '2026-06', 30000, null, 6);
