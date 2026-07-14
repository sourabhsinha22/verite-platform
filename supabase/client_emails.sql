ALTER TABLE engagements ADD COLUMN IF NOT EXISTS status_email_enabled boolean DEFAULT false;
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS status_email_day text DEFAULT 'friday';
