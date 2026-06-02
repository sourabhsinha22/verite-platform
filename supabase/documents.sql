-- Documents table
create table documents (
  id             uuid primary key default uuid_generate_v4(),
  engagement_id  uuid references engagements(id) on delete cascade,
  company_id     uuid references companies(id) on delete cascade,
  name           text not null,
  file_path      text not null,   -- path inside storage bucket
  file_size      bigint,
  file_type      text,            -- MIME type
  uploaded_by    text default '',
  created_at     timestamptz default now()
);

alter table documents enable row level security;
create policy "auth_all_documents" on documents
  for all to authenticated using (true) with check (true);

-- Storage bucket (run separately in Supabase dashboard Storage tab if CLI doesn't support it)
-- insert into storage.buckets (id, name, public) values ('documents', 'documents', false);
