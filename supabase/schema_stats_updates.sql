-- 1. Table pour traquer les recherches sans résultats (Search Gaps)
-- Cette table permettra d'alimenter le module "Opportunités Manquées"
CREATE TABLE IF NOT EXISTS search_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    query TEXT NOT NULL,
    results_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Index pour les performances de requête
CREATE INDEX idx_search_logs_created_at ON search_logs(created_at);
CREATE INDEX idx_search_logs_query ON search_logs(query);


-- 2. Table pour les statistiques de vue des procédures (Top & Flop)
-- Permet de calculer le temps moyen de lecture et le taux de rebond (< 10s)
CREATE TABLE IF NOT EXISTS procedure_views (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    procedure_id UUID REFERENCES procedures(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    duration_seconds INTEGER, -- Temps passé sur la page
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);


-- 3. Vue matérialisée ou requête pour le "Santé de la Base" (Health Check)
-- Pas besoin de nouvelle table, mais on s'assure que la table 'procedures' a bien 'updated_at'
-- ALTER TABLE procedures ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());


-- 4. Suivi des suggestions (Engagement)
-- Déjà géré si vous avez une table 'suggestions' ou 'comments'
-- Assurez-vous d'avoir 'user_id' et 'status' (accepted/rejected/pending)
