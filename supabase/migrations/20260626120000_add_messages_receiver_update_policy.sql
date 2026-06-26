-- messages had RLS enabled with SELECT/INSERT only; UPDATE was denied for all roles,
-- so mark-as-read silently affected 0 rows.
CREATE POLICY "messages_receiver_mark_read"
ON public.messages
FOR UPDATE
USING (
  (auth.uid() = receiver_id)
  AND (NOT is_blocked_either_way(sender_id, receiver_id))
)
WITH CHECK (
  (auth.uid() = receiver_id)
  AND (NOT is_blocked_either_way(sender_id, receiver_id))
);
