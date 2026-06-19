CREATE TABLE IF NOT EXISTS mystery_gem_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  gem_id uuid NOT NULL REFERENCES gems(id) ON DELETE CASCADE,
  week_start date NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE mystery_gem_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read mystery gem history"
  ON mystery_gem_history FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert mystery gem history"
  ON mystery_gem_history FOR INSERT
  WITH CHECK (true);
