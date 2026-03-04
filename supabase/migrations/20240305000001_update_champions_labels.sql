DROP FUNCTION IF EXISTS get_weekly_champions();

CREATE OR REPLACE FUNCTION get_weekly_champions()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    start_date timestamptz := date_trunc('week', now());
    progression_champ json;
    expert_champ json;
    explorer_champ json;
BEGIN
    -- 1. TOP PERFORMANCE (Ex-Moteur) : Max XP gained this week
    SELECT row_to_json(t) INTO progression_champ
    FROM (
        SELECT 
            p.id as user_id,
            p.first_name,
            p.last_name,
            p.avatar_url,
            p.role,
            COALESCE(SUM(xh.amount), 0) as metric_value,
            'XP GÉNÉRÉS' as metric_label,
            'TOP PERFORMANCE' as badge_title,
            'fa-rocket' as badge_icon,
            'indigo' as badge_color
        FROM user_profiles p
        JOIN xp_history xh ON p.id = xh.user_id
        WHERE xh.created_at >= start_date
        GROUP BY p.id
        ORDER BY metric_value DESC
        LIMIT 1
    ) t;

    -- 2. TOP CONTRIBUTION (Ex-Expert) : Max approved suggestions
    SELECT row_to_json(t) INTO expert_champ
    FROM (
        SELECT 
            p.id as user_id,
            p.first_name,
            p.last_name,
            p.avatar_url,
            p.role,
            COUNT(s.id) as metric_value,
            'SUGGESTIONS VALIDÉES' as metric_label,
            'TOP CONTRIBUTION' as badge_title,
            'fa-gem' as badge_icon,
            'emerald' as badge_color
        FROM user_profiles p
        JOIN procedure_suggestions s ON p.id = s.user_id
        WHERE s.created_at >= start_date AND s.status = 'approved'
        GROUP BY p.id
        ORDER BY metric_value DESC
        LIMIT 1
    ) t;

    -- 3. TOP CURIOSITÉ (Ex-Explorateur) : Max unique procedures viewed
    SELECT row_to_json(t) INTO explorer_champ
    FROM (
        SELECT 
            p.id as user_id,
            p.first_name,
            p.last_name,
            p.avatar_url,
            p.role,
            COUNT(DISTINCT n.content) as metric_value, -- content stores procedure_id in consultation logs usually, or use title
            'PROCÉDURES CONSULTÉES' as metric_label,
            'TOP CURIOSITÉ' as badge_title,
            'fa-compass' as badge_icon,
            'amber' as badge_color
        FROM user_profiles p
        JOIN notes n ON p.id = n.user_id
        WHERE n.created_at >= start_date 
        AND n.title LIKE 'CONSULTATION_%'
        GROUP BY p.id
        ORDER BY metric_value DESC
        LIMIT 1
    ) t;

    RETURN json_build_object(
        'progression', progression_champ,
        'expert', expert_champ,
        'explorer', explorer_champ
    );
END;
$$;