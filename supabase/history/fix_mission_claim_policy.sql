-- Allow claiming OPEN missions
DROP POLICY IF EXISTS "Authenticated users can claim open missions" ON public.missions;

CREATE POLICY "Authenticated users can claim open missions"
ON public.missions
FOR UPDATE
TO authenticated
USING (
  status = 'open'
)
WITH CHECK (
  status = 'assigned' AND assigned_to = auth.uid()
);

-- Allow INSERTing notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert notifications" ON public.notifications;

CREATE POLICY "Users can insert notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  true 
);

-- Ensure users can only see their OWN notifications
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;

CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
);

-- Allow users to update/delete their own notifications
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;

CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
)
WITH CHECK (
  auth.uid() = user_id
);
