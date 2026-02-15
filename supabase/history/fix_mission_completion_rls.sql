CREATE OR REPLACE FUNCTION public.check_badge_eligibility()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    badge_record RECORD;
    cat_score integer;
BEGIN
    FOR badge_record IN SELECT * FROM public.badges WHERE type = 'auto' LOOP
        
        -- Critère sur l'XP Globale
        IF badge_record.criteria_type = 'total_xp' THEN
            IF NEW.xp_points >= badge_record.criteria_value THEN
                INSERT INTO public.user_badges (user_id, badge_id)
                VALUES (NEW.id, badge_record.id)
                ON CONFLICT (user_id, badge_id) DO NOTHING;
            END IF;
        END IF;

        -- Critère sur l'Expertise (Catégorie spécifique)
        IF badge_record.criteria_type = 'category_xp' THEN
            -- Extraire le score de la catégorie du JSONB stats_by_category
            cat_score := (NEW.stats_by_category->>badge_record.category)::integer;
            
            IF cat_score IS NOT NULL AND cat_score >= badge_record.criteria_value THEN
                INSERT INTO public.user_badges (user_id, badge_id)
                VALUES (NEW.id, badge_record.id)
                ON CONFLICT (user_id, badge_id) DO NOTHING;
            END IF;
        END IF;

    END LOOP;
    
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.award_mission_xp()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Si le statut passe à 'completed'
  IF (OLD.status != 'completed' AND NEW.status = 'completed') THEN
    -- Mettre à jour l'XP de l'assigné
    UPDATE public.user_profiles 
    SET 
      xp_points = xp_points + NEW.xp_reward,
      level = floor((xp_points + NEW.xp_reward) / 100) + 1
    WHERE id = NEW.assigned_to;
    
    -- Optionnel : Loguer l'activité dans les notes de log
    INSERT INTO public.notes (title, content, user_id, status)
    VALUES (
      'LOG_MISSION_COMPLETED', 
      '✅ Mission accomplie : ' || NEW.title || ' (+' || NEW.xp_reward || ' XP)', 
      NEW.assigned_to,
      'private'
    );
  END IF;
  RETURN NEW;
END;
$function$;
