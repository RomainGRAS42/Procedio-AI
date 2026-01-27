-- Ajout des colonnes type et priority à la table procedure_suggestions

ALTER TABLE procedure_suggestions 
ADD COLUMN IF NOT EXISTS type TEXT CHECK (type IN ('correction', 'update', 'add_step')),
ADD COLUMN IF NOT EXISTS priority TEXT CHECK (priority IN ('low', 'medium', 'high'));

-- Mettre à jour les enregistrements existants si nécessaire (optionnel)
UPDATE procedure_suggestions SET type = 'correction', priority = 'medium' WHERE type IS NULL;
