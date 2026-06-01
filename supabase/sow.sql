-- SOW (Statement of Work) schema
-- Run in Supabase SQL editor after schema.sql

-- ─────────────────────────────────────────
-- SOWs  (one per engagement, or multiple amendments)
-- ─────────────────────────────────────────
create table sows (
  id               uuid primary key default uuid_generate_v4(),
  engagement_id    uuid references engagements(id) on delete cascade,
  title            text not null default '',
  version          integer not null default 1,
  status           text not null default 'draft'
                     check (status in ('draft','sent','signed','active','expired','cancelled')),
  effective_date   date,
  expiry_date      date,
  signed_date      date,

  -- Scope fields (rich text stored as plain text for simplicity)
  objectives       text default '',
  scope_of_work    text default '',
  out_of_scope     text default '',
  assumptions      text default '',
  client_responsibilities text default '',

  -- Commercial
  total_value      numeric(12,2),
  revenue_type     text check (revenue_type in ('retainer','revenue-share','project','hourly')),
  revenue_share_pct numeric(5,2),
  payment_terms    text default 'Net 30',
  billing_frequency text default 'monthly'
                     check (billing_frequency in ('on-completion','monthly','milestone','weekly')),

  -- Vérité contacts
  verite_lead      text default '',
  client_signatory text default '',
  verite_signatory text default 'Tana Whitt',

  notes            text default '',
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- ─────────────────────────────────────────
-- SOW Phases  (e.g. "Phase 1 — Discovery")
-- ─────────────────────────────────────────
create table sow_phases (
  id          uuid primary key default uuid_generate_v4(),
  sow_id      uuid references sows(id) on delete cascade,
  title       text not null,
  description text default '',
  start_date  date,
  end_date    date,
  sort_order  integer default 0,
  created_at  timestamptz default now()
);

-- ─────────────────────────────────────────
-- SOW Deliverables  (billable milestones / outputs)
-- ─────────────────────────────────────────
create table sow_deliverables (
  id              uuid primary key default uuid_generate_v4(),
  sow_id          uuid references sows(id) on delete cascade,
  phase_id        uuid references sow_phases(id) on delete set null,
  title           text not null,
  description     text default '',
  due_date        date,
  payment_amount  numeric(12,2),
  payment_month   text,   -- YYYY-MM if recurring retainer
  is_milestone    boolean default false,  -- triggers invoice when marked complete
  sort_order      integer default 0,
  created_at      timestamptz default now()
);

-- ─────────────────────────────────────────
-- RLS policies (same as other tables)
-- ─────────────────────────────────────────
alter table sows             enable row level security;
alter table sow_phases       enable row level security;
alter table sow_deliverables enable row level security;

create policy "auth_all_sows"             on sows             for all to authenticated using (true) with check (true);
create policy "auth_all_sow_phases"       on sow_phases       for all to authenticated using (true) with check (true);
create policy "auth_all_sow_deliverables" on sow_deliverables for all to authenticated using (true) with check (true);

-- Updated_at trigger
create trigger sows_updated_at before update on sows
  for each row execute function update_updated_at();
