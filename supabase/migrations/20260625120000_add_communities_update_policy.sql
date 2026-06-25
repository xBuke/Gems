DROP POLICY IF EXISTS "Creator can update own community" ON public.communities;

CREATE POLICY "Creator can update own community"
  ON public.communities
  FOR UPDATE
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);
