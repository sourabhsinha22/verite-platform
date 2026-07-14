create table if not exists sow_templates (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  description text default '',
  engagement_type text default 'project-based',
  objectives  text default '',
  scope_of_work text default '',
  out_of_scope  text default '',
  assumptions   text default '',
  client_responsibilities text default '',
  payment_terms text default 'Net 30',
  billing_frequency text default 'monthly',
  revenue_type  text default 'retainer',
  phases        jsonb default '[]',
  is_active     boolean default true,
  created_at    timestamptz default now()
);

alter table sow_templates enable row level security;
create policy "auth_all_sow_templates" on sow_templates
  for all to authenticated using (true) with check (true);

-- Seed 4 templates
insert into sow_templates (name, description, engagement_type, objectives, scope_of_work, out_of_scope, assumptions, client_responsibilities, payment_terms, billing_frequency, revenue_type, phases) values
(
  'NouvelleED Platform Onboarding',
  'Standard 90-day onboarding for NouvelleED AI healthcare education platform',
  'project-based',
  'Successfully onboard the client organization onto the NouvelleED platform, configure their learning environment, and ensure staff competency.',
  '1. Platform configuration and white-labeling\n2. AI Competency Studio setup and module creation\n3. Staff training sessions (2x)\n4. ANCC CE certification setup\n5. 30-day post-launch support',
  'Custom curriculum development beyond initial module set\nIntegration with third-party LMS systems\nOn-site training (virtual only)',
  'Client will provide timely access to subject matter experts\nClient has a designated project champion\nVérité will have access to client branding assets within 5 business days of contract execution',
  'Assign a project champion\nProvide branding assets (logo, colors, fonts)\nComplete staff onboarding survey within 10 days\nEnsure staff attend training sessions',
  'Net 30',
  'milestone',
  'project',
  '[{"title":"Discovery & Configuration","description":"Platform setup, white-labeling, and initial module build","duration_weeks":3},{"title":"Training & Launch","description":"Staff training sessions and platform go-live","duration_weeks":3},{"title":"Stabilization & CE Setup","description":"ANCC CE certification and post-launch support","duration_weeks":4}]'
),
(
  'Monthly Retainer — Revenue & Operations',
  'Ongoing monthly retainer for revenue cycle and operations consulting',
  'project-based',
  'Provide ongoing strategic advisory and hands-on support for revenue cycle optimization and operational improvement.',
  '1. Weekly strategy calls (60 min)\n2. Monthly KPI review and reporting\n3. Revenue cycle process audits (quarterly)\n4. Ad-hoc analysis and recommendations (up to 8 hours/month)\n5. Stakeholder presentation prep',
  'Implementation of recommendations (billed separately)\nStaffing or hiring decisions\nLegal or compliance advice',
  'Client team will be available for weekly calls\nData and reports will be provided within 48 hours of request',
  'Designate a primary point of contact\nProvide access to relevant data systems\nAttend weekly strategy calls',
  'Net 30',
  'monthly',
  'retainer',
  '[]'
),
(
  'Sales & Growth Strategy',
  'Structured 6-month sales enablement and growth strategy engagement',
  'sales-growth',
  'Develop and execute a go-to-market strategy to grow revenue by identifying new opportunities, improving sales processes, and building pipeline.',
  '1. Current state assessment and opportunity analysis\n2. ICP (Ideal Customer Profile) definition\n3. Sales playbook development\n4. Pipeline build and outreach campaign (Apollo)\n5. Monthly pipeline reviews\n6. Sales team coaching (bi-weekly)',
  'Direct sales execution (client team handles outreach)\nMarketing content production\nCRM implementation',
  'Client sales team will be engaged and responsive\nAccess to existing sales data and CRM will be provided',
  'Provide access to existing pipeline and sales data\nEnsure sales team participation in coaching sessions\nImplement agreed playbook changes',
  'Net 30',
  'monthly',
  'retainer',
  '[{"title":"Assessment & Strategy","description":"Current state analysis and go-to-market strategy development","duration_weeks":6},{"title":"Execution & Coaching","description":"Playbook rollout, pipeline build, and ongoing coaching","duration_weeks":18}]'
),
(
  'Care Model Redesign',
  'Comprehensive care model transformation project',
  'care-model',
  'Redesign the client care model to improve patient outcomes, staff satisfaction, and operational efficiency.',
  '1. Current state assessment and patient journey mapping\n2. Care model redesign workshop series (3 sessions)\n3. Implementation roadmap development\n4. Staff change management support\n5. 60-day post-implementation review',
  'Clinical staffing decisions\nElectronic health record (EHR) configuration\nRegulatory filings',
  'Leadership is committed to the redesign process\nFront-line staff will be available for workshops\nData on current patient outcomes will be provided',
  'Executive sponsor participation in workshops\nAssign a clinical champion\nProvide outcomes data (de-identified)',
  'Net 30',
  'milestone',
  'project',
  '[{"title":"Discovery","description":"Current state assessment, stakeholder interviews, journey mapping","duration_weeks":4},{"title":"Design","description":"Care model redesign workshops and future state definition","duration_weeks":6},{"title":"Roadmap & Handoff","description":"Implementation roadmap, change management plan, final presentation","duration_weeks":4}]'
),
(
  'NouvelleED — Behavioral Health & Psychiatry',
  'NouvelleED onboarding tailored for psychiatric practices, behavioral health orgs, and mental health networks',
  'project-based',
  'Deploy NouvelleED across the clinical team with psychiatry-specific competency modules, ANCC-approved psychiatric nursing CE, and ongoing staff development pathways aligned with behavioral health standards.',
  '1. Platform configuration and psychiatric practice white-labeling
2. Behavioral health competency module build (AI Competency Studio):
   - Psychiatric assessment and documentation
   - Trauma-informed care practices
   - Medication management and psychopharmacology
   - Crisis intervention and de-escalation
   - Co-occurring disorders
3. ANCC CE certification setup (psychiatric-mental health nursing specialty)
4. Staff onboarding and training sessions (2x virtual, 1x recorded)
5. Clinical champion enablement — train-the-trainer session
6. 30-day post-launch support and optimization
7. Completion and CE issuance reporting',
  'Development of proprietary clinical protocols or practice-specific clinical guidelines
Integration with EHR/EMR systems (Epic, Cerner, etc.)
On-site training (virtual delivery only)
Joint Commission or CARF accreditation preparation
Legal or billing compliance advice',
  'Client designates a clinical champion with authority to drive staff adoption
Vérité receives branding assets within 5 business days of contract execution
Client provides a list of target staff roles and approximate headcount within 10 days
Subject matter experts (psychiatrists, NPs, or senior clinicians) available for 2–3 hours during module review',
  'Assign a clinical champion as primary point of contact
Provide staff roster with roles and email addresses for platform provisioning
Ensure clinical staff complete onboarding survey within 10 days
Schedule and promote training sessions to clinical team
Approve module content within 5 business days of review submission',
  'Net 30',
  'milestone',
  'project',
  '[{"title":"Discovery & Configuration","description":"Platform setup, white-labeling, and psychiatric practice configuration. Staff roster provisioning and baseline competency assessment.","duration_weeks":2},{"title":"Module Development","description":"Build behavioral health competency modules in AI Competency Studio. Clinical champion review and content approval cycle.","duration_weeks":4},{"title":"Training & Launch","description":"Staff training sessions (virtual). Platform go-live with full team access. ANCC CE pathway activation.","duration_weeks":3},{"title":"CE Certification & Optimization","description":"ANCC CE certificates issued for completed modules. Post-launch support, completion tracking, and 30-day optimization review.","duration_weeks":3}]'
);
