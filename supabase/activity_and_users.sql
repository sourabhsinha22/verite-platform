-- ─────────────────────────────────────────
-- STEP 1: Link auth users to team_members
-- ─────────────────────────────────────────
-- Add auth_user_id to team_members so we can map
-- a logged-in Supabase auth user → their team member profile
alter table team_members add column if not exists auth_user_id uuid references auth.users(id) on delete set null;
alter table team_members add column if not exists avatar_color text default '#e3bca6';
create unique index if not exists team_members_auth_user_id_idx on team_members(auth_user_id) where auth_user_id is not null;

-- ─────────────────────────────────────────
-- STEP 2: Activity log
-- ─────────────────────────────────────────
create table activity_log (
  id             uuid primary key default uuid_generate_v4(),
  engagement_id  uuid references engagements(id) on delete cascade,
  author         text not null default '',
  author_id      uuid references auth.users(id) on delete set null,
  entry_type     text not null default 'note'
                   check (entry_type in ('note','call','meeting','email','status','milestone')),
  content        text not null default '',
  metadata       jsonb default '{}',
  created_at     timestamptz default now()
);

create index activity_log_engagement_idx on activity_log(engagement_id, created_at desc);

-- RLS
alter table activity_log enable row level security;
create policy "auth_all_activity_log" on activity_log
  for all to authenticated using (true) with check (true);

-- ─────────────────────────────────────────
-- STEP 3: Notification preferences
-- ─────────────────────────────────────────
create table notification_settings (
  id              uuid primary key default uuid_generate_v4(),
  team_member_id  uuid references team_members(id) on delete cascade,
  notify_overdue_invoices  boolean default true,
  notify_tasks_due         boolean default true,
  notify_new_engagement    boolean default true,
  notify_task_assigned     boolean default true,
  email                    text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table notification_settings enable row level security;
create policy "auth_all_notification_settings" on notification_settings
  for all to authenticated using (true) with check (true);

-- Seed notification settings for existing team members
insert into notification_settings (team_member_id, email)
select id, email from team_members
on conflict do nothing;
