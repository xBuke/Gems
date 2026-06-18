ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_private boolean default false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS language text default 'en';
