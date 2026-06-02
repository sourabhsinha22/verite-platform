-- Financial features from Revenue HTML
-- Bank balance, distributions, contractors, reimbursements

-- ─────────────────────────────────────────
-- BANK BALANCE (single row per org — upsert)
-- ─────────────────────────────────────────
create table bank_balance (
  id          uuid primary key default uuid_generate_v4(),
  balance     numeric(14,2) not null,
  as_of_date  date not null,
  notes       text default '',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table bank_balance enable row level security;
create policy "auth_all_bank_balance" on bank_balance
  for all to authenticated using (true) with check (true);

-- ─────────────────────────────────────────
-- DISTRIBUTIONS (partner payouts)
-- ─────────────────────────────────────────
create table distributions (
  id          uuid primary key default uuid_generate_v4(),
  recipient   text not null,
  amount      numeric(12,2) not null,
  date        date not null,
  notes       text default '',
  created_at  timestamptz default now()
);

alter table distributions enable row level security;
create policy "auth_all_distributions" on distributions
  for all to authenticated using (true) with check (true);

-- ─────────────────────────────────────────
-- CONTRACTORS (1099)
-- ─────────────────────────────────────────
create table contractors (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  role        text default '',
  email       text default '',
  phone       text default '',
  w9_on_file  boolean default false,
  notes       text default '',
  created_at  timestamptz default now()
);

alter table contractors enable row level security;
create policy "auth_all_contractors" on contractors
  for all to authenticated using (true) with check (true);

create table contractor_payments (
  id             uuid primary key default uuid_generate_v4(),
  contractor_id  uuid references contractors(id) on delete cascade,
  amount         numeric(12,2) not null,
  date           date not null,
  description    text default '',
  created_at     timestamptz default now()
);

alter table contractor_payments enable row level security;
create policy "auth_all_contractor_payments" on contractor_payments
  for all to authenticated using (true) with check (true);

-- ─────────────────────────────────────────
-- REIMBURSEMENTS (pass-through expenses)
-- ─────────────────────────────────────────
create table reimbursements (
  id           uuid primary key default uuid_generate_v4(),
  date         date not null,
  client       text default '',
  description  text not null,
  amount_out   numeric(12,2) not null,
  amount_in    numeric(12,2) default 0,
  status       text not null default 'pending'
                 check (status in ('pending','partial','received')),
  notes        text default '',
  created_at   timestamptz default now()
);

alter table reimbursements enable row level security;
create policy "auth_all_reimbursements" on reimbursements
  for all to authenticated using (true) with check (true);

-- ─────────────────────────────────────────
-- EXPENSES (OpEx / COGS — for P&L)
-- ─────────────────────────────────────────
create table expenses (
  id          uuid primary key default uuid_generate_v4(),
  month       text not null,  -- YYYY-MM
  category    text not null,
  description text default '',
  forecast    numeric(12,2) default 0,
  actual      numeric(12,2),
  created_at  timestamptz default now()
);

alter table expenses enable row level security;
create policy "auth_all_expenses" on expenses
  for all to authenticated using (true) with check (true);
