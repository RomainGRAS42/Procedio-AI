-- Migration: RSS Feeds System
-- Description: Adds a table to store RSS feed sources with role-based visibility.

-- 1. Create RSS Feeds Table
CREATE TABLE IF NOT EXISTS public.rss_feeds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    title TEXT NOT NULL,
    icon TEXT DEFAULT 'fa-rss',
    is_global BOOLEAN DEFAULT false, -- If true, visible to everyone
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. RLS Policies
ALTER TABLE public.rss_feeds ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can see global feeds
CREATE POLICY "Everyone can view global feeds"
ON public.rss_feeds FOR SELECT
USING (is_global = true);

-- Policy: Users can view their own feeds
CREATE POLICY "Users can view their own feeds"
ON public.rss_feeds FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can insert their own feeds
CREATE POLICY "Users can insert their own feeds"
ON public.rss_feeds FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own feeds
CREATE POLICY "Users can update their own feeds"
ON public.rss_feeds FOR UPDATE
USING (auth.uid() = user_id);

-- Policy: Users can delete their own feeds (except if global and not manager)
CREATE POLICY "Users can delete their own feeds"
ON public.rss_feeds FOR DELETE
USING (auth.uid() = user_id);

-- Special policy for Managers to manage global feeds
CREATE POLICY "Managers can manage any global feed"
ON public.rss_feeds FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE id = auth.uid() AND role = 'MANAGER'
  )
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_rss_feeds_user ON public.rss_feeds(user_id);
CREATE INDEX IF NOT EXISTS idx_rss_feeds_global ON public.rss_feeds(is_global);
