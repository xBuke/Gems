ALTER TABLE profiles ADD COLUMN IF NOT EXISTS home_town text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS home_lat double precision;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS home_lng double precision;
ALTER TABLE gems ADD COLUMN IF NOT EXISTS is_local_pick boolean DEFAULT false;
