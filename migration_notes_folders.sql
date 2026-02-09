-- Migration: Note Folders System
-- Description: Adds a dedicated table for note folders and links notes to them.

-- 1. Create Folder Table
CREATE TABLE IF NOT EXISTS public.note_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    icon TEXT DEFAULT 'fa-folder',
    mode TEXT NOT NULL DEFAULT 'personal', -- 'personal' or 'flash'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Add folder_id to Notes
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES public.note_folders(id) ON DELETE SET NULL;

-- 3. RLS Policies for Folders
ALTER TABLE public.note_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own folders" 
ON public.note_folders 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Special policy for Flash Note folders: Managers can see/manage them
CREATE POLICY "Managers can manage flash folders"
ON public.note_folders
FOR ALL
USING (
  mode = 'flash' AND (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND role = 'MANAGER'
    )
  )
)
WITH CHECK (
  mode = 'flash' AND (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND role = 'MANAGER'
    )
  )
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_note_folders_user ON public.note_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_folder ON public.notes(folder_id);
