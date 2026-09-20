-- SOW e-signing columns
ALTER TABLE sows ADD COLUMN IF NOT EXISTS signed_pdf_url text;
ALTER TABLE sows ADD COLUMN IF NOT EXISTS signing_token uuid DEFAULT gen_random_uuid();
ALTER TABLE sows ADD COLUMN IF NOT EXISTS internal_signed_at timestamptz;
ALTER TABLE sows ADD COLUMN IF NOT EXISTS client_signed_at timestamptz;
