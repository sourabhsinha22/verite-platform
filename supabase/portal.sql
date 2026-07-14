-- Client Portal token per company
ALTER TABLE companies ADD COLUMN IF NOT EXISTS portal_token uuid DEFAULT gen_random_uuid();
UPDATE companies SET portal_token = gen_random_uuid() WHERE portal_token IS NULL;
