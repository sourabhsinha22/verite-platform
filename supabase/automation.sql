-- Automation schema: recurring invoices + cron tracking

-- Add recurring fields to invoices
alter table invoices add column if not exists is_recurring boolean default false;
alter table invoices add column if not exists billing_frequency text default 'monthly'
  check (billing_frequency in ('monthly','quarterly','annually'));
alter table invoices add column if not exists next_billing_date date;
alter table invoices add column if not exists recurring_end_date date;
alter table invoices add column if not exists generated_from_id uuid references invoices(id) on delete set null;

-- Cron run log (so we know what ran and when, and can debug)
create table if not exists cron_log (
  id          uuid primary key default uuid_generate_v4(),
  job         text not null,
  status      text not null default 'ok' check (status in ('ok','error','skipped')),
  message     text default '',
  actions     integer default 0,
  ran_at      timestamptz default now()
);

alter table cron_log enable row level security;
create policy "auth_all_cron_log" on cron_log
  for all to authenticated using (true) with check (true);

-- Notification log (track what emails have been sent to avoid duplicates)
create table if not exists notification_log (
  id            uuid primary key default uuid_generate_v4(),
  recipient     text not null,
  type          text not null,
  ref_id        text,  -- invoice id, engagement id, etc.
  sent_at       timestamptz default now()
);

alter table notification_log enable row level security;
create policy "auth_all_notification_log" on notification_log
  for all to authenticated using (true) with check (true);
