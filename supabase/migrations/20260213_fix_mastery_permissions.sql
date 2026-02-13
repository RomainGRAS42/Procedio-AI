-- Migration applied on 2026-02-13
-- Allow technicians to update their own mastery requests (status, score, completed_at)

CREATE POLICY "Users can update their own mastery requests"
ON public.mastery_requests
FOR UPDATE
TO public
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND status = 'completed');
