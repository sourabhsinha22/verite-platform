# Vérité Platform — Setup Guide

## 1. Create a Supabase Project (free)

1. Go to https://supabase.com and sign up / sign in
2. Click **New Project**
   - Name: `verite-platform`
   - Region: pick closest to you (US East or Central)
   - Database password: save this somewhere
3. Wait ~2 minutes for it to provision

## 2. Run the database schema

1. In your Supabase project, go to **SQL Editor**
2. Open the file `supabase/schema.sql` from this project
3. Paste the entire contents into the SQL editor
4. Click **Run** — this creates all tables and seeds your initial data

## 3. Get your API keys

1. In Supabase, go to **Settings → API**
2. Copy:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **anon/public key** (long JWT string)

## 4. Create your .env.local file

In the `verite-platform` folder, create a file called `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

Replace the values with what you copied in step 3.

## 5. Run the app

Open a terminal in `C:\Development\verite-platform` and run:

```
npm run dev
```

Then open http://localhost:3000 in your browser.

## 6. Create your first user

1. Go to http://localhost:3000/login
2. Click "Sign up" and create an account with your email
3. Check your email to confirm (or disable email confirmation in Supabase Auth settings for development)
4. Sign in — you'll land on the dashboard with your seed data loaded

## Disable email confirmation (for local dev)

In Supabase: **Authentication → Email** → toggle off "Enable email confirmations"

## Deploy to Vercel (when ready)

1. Push this folder to a GitHub repo
2. Go to https://vercel.com → Import Project → select your repo
3. Add the same environment variables in Vercel's project settings
4. Deploy — it's live and free

---

## Project structure

```
src/
  app/
    (dashboard)/       — All main pages (protected)
      page.tsx         — Dashboard
      directory/       — Companies / CRM
      engagements/     — Engagements + detail
      revenue/         — Revenue forecast
      invoices/        — Invoice tracking
      tasks/           — My Tasks
      reports/         — Status reports
      settings/        — Team members
    login/             — Auth page
    auth/callback/     — OAuth callback
  components/
    Sidebar.tsx
    ui/                — Badge, StatCard
    directory/         — CompanyDetailClient
    engagements/       — EngagementsClient, EngagementDetailClient
    invoices/          — InvoicesClient
    tasks/             — TasksClient
    settings/          — SettingsClient
    reports/           — PrintButton
  lib/
    types.ts           — All TypeScript types
    supabase/          — Client + server helpers
supabase/
  schema.sql           — Full DB schema + seed data
```
