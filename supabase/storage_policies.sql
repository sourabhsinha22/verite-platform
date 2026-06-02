create policy "auth_doc_select" on storage.objects for select to authenticated using (bucket_id = 'documents');
create policy "auth_doc_insert" on storage.objects for insert to authenticated with check (bucket_id = 'documents');
create policy "auth_doc_update" on storage.objects for update to authenticated using (bucket_id = 'documents');
create policy "auth_doc_delete" on storage.objects for delete to authenticated using (bucket_id = 'documents');
