-- Create a dedicated notifications table for missions and other system alerts
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'mission', 'badge', 'system', etc.
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    link TEXT, -- Optional path for navigation (e.g. '/missions')
    read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only see and update their own notifications
CREATE POLICY "Users can view their own notifications"
    ON public.notifications FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
    ON public.notifications FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications"
    ON public.notifications FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Explicit policy for Service Role or Managers if needed, 
-- but normally the app (acting as authenticated user) or a trigger handles inserts.
-- For now, allow authenticated users to insert (so the manager can notify the technician)
CREATE POLICY "Authenticated users can insert notifications"
    ON public.notifications FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, read);
