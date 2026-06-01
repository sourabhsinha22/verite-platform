-- Row Level Security policies for Vérité Platform
-- Prototype: any authenticated user can read/write everything
-- (Add org-based tenancy later when selling to other firms)

-- Enable RLS on all tables
alter table companies      enable row level security;
alter table contacts       enable row level security;
alter table engagements    enable row level security;
alter table tasks          enable row level security;
alter table revenue_items  enable row level security;
alter table invoices       enable row level security;
alter table team_members   enable row level security;

-- Companies: authenticated users have full access
create policy "auth_all_companies" on companies
  for all to authenticated using (true) with check (true);

-- Contacts: authenticated users have full access
create policy "auth_all_contacts" on contacts
  for all to authenticated using (true) with check (true);

-- Engagements: authenticated users have full access
create policy "auth_all_engagements" on engagements
  for all to authenticated using (true) with check (true);

-- Tasks: authenticated users have full access
create policy "auth_all_tasks" on tasks
  for all to authenticated using (true) with check (true);

-- Revenue items: authenticated users have full access
create policy "auth_all_revenue_items" on revenue_items
  for all to authenticated using (true) with check (true);

-- Invoices: authenticated users have full access
create policy "auth_all_invoices" on invoices
  for all to authenticated using (true) with check (true);

-- Team members: authenticated users have full access
create policy "auth_all_team_members" on team_members
  for all to authenticated using (true) with check (true);
