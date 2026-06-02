@AGENTS.md

# Vérité Platform — Project Context

## Stack
- Next.js 14 App Router, TypeScript, Supabase (Postgres + Auth), Vercel (hosting)
- Inline styles throughout — no Tailwind classes
- CSS variables defined in globals.css (--wine, --navy, --indigo, --blush, etc.)
- Cormorant Garamond for headings, Inter for body

## Live URLs
- Production: https://verite-platform.vercel.app
- Supabase project: glfnxzilgwtfvnrxzsxn (East US)
- GitHub: https://github.com/sourabhsinha22/verite-platform

## Team accounts
| Name | Email | Password |
|---|---|---|
| Tana Whitt | tana@veritehealth.com | Verite2026!Tana |
| Shannon Chema | shannon@veritehealth.com | Verite2026!Shannon |
| Charissa Duffy | charissa@veritehealth.com | Verite2026!Charissa |
| Demo | demo@veritehealth.com | Demo2026! |

## Critical rules
- NEVER add onMouseEnter/onMouseLeave/onClick to server components — causes runtime crash
- Use CSS .hover-row class + <style> tag for hover effects in server pages
- All server pages need `export const dynamic = 'force-dynamic'` at top
- Run fix-encoding.js after any agent writes files (prevents mojibake + BOM issues)
- Always build locally before deploying: `npm run build`

## What's built (as of Jun 2026)
- Dashboard, Directory (CRM), Engagements, Pipeline (Kanban), Forecast
- Revenue, Bank Balance, Distributions, Reimbursements, Contractors (1099)
- Invoices + payment links (/pay/[id]), SOW editor + PDF, Proposal PDF
- Activity log per engagement, Multi-user auth (3 partner accounts)
- Email notification infrastructure (Resend — needs RESEND_API_KEY in Vercel)
- Settings, Notifications preferences, Reports (printable)

---

## Pending feature decisions — check with Tana

These were discussed but not yet prioritized. Need Tana's input on which to build next.

### Highest value (immediate ROI)
1. **Recurring invoice automation** — retainer clients (PHA $30K/mo, ViaQuest $15K/mo) currently require manual invoice creation each month. A recurring flag auto-generates the next invoice on schedule.
2. **Client-facing portal** — read-only login for clients to view their engagement, tasks, invoices. Eliminates status update emails, raises credibility.
3. **Document management** — upload PDFs/Word/Excel, attach to engagement or client, version history. Replaces shared drive for contracts, SOWs, training materials.

### CRM completeness
4. **Weekly digest email** — Monday morning summary per partner: tasks due this week, overdue invoices, blocked items, upcoming close dates.
5. **Email integration** — BCC a special address to auto-log emails to the right engagement activity log.
6. **Lead capture form** — shareable link that creates a new Lead in the CRM when someone fills it out.
7. **Meeting scheduler** — embed booking link per team member, discovery call creates Opportunity automatically.

### Analytics and intelligence
8. **Engagement health scoring** — auto red/yellow/green based on overdue tasks, days since last contact, invoice aging. Prevents relationship surprises.
9. **Revenue recognition calendar** — month-by-month visual of expected cash hits. Good for accountant conversations.
10. **Partner equity dashboard** — each partner's ownership stake, cumulative distributions, what they're owed.

### Operational
11. **Task templates (richer)** — full SOW + tasks + revenue schedule pre-filled per engagement type. New Care Model onboarded in < 5 minutes.
12. **Approval workflows** — invoice requires second-partner approval before sending. SOW gets a review flag.
13. **Time tracking** — log hours per engagement, utilization per team member, over-budget alerts.
14. **Mobile responsive layout** — current app is desktop-only. PWA manifest so it installs on mobile.

### Sellability (when going to market)
15. **White-labeling** — other firms replace Vérité branding with their own.
16. **Audit log** — every data change logged with who/when. Required for compliance-conscious buyers.
17. **Zapier/Make integration** — webhooks to connect with Google Sheets, Slack, etc.
18. **Stripe subscription billing** — free trial → paid plans for multi-tenant launch.

### Priority ranking for Vérité specifically
1. Recurring invoices (saves 2+ hrs/month immediately)
2. Client portal (biggest credibility upgrade)
3. Document management (consolidates scattered files)
4. Weekly digest email (replaces manual status checking)
5. Mobile responsive (needed for on-site visits)
6. Time tracking (justifies rates, feeds invoicing)
7. Health scoring (prevents client relationship surprises)
