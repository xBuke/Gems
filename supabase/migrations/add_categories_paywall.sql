-- Run separately in Supabase SQL editor

ALTER TABLE gems ADD COLUMN IF NOT EXISTS subcategory text;
ALTER TABLE gems ADD COLUMN IF NOT EXISTS tags text[];

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_premium boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_categories text[] DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_completed_onboarding boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;
