CREATE OR REPLACE FUNCTION public.award_mission_xp()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  new_xp integer;
  new_level integer;
BEGIN
  -- Si le statut passe à 'completed'
  IF (OLD.status != 'completed' AND NEW.status = 'completed') THEN
    
    -- Calcul du nouveau XP total
    SELECT xp_points + NEW.xp_reward INTO new_xp
    FROM public.user_profiles
    WHERE id = NEW.assigned_to;

    -- Calcul du Niveau selon la courbe "HARDCORE" (10 Paliers fixes)
    IF new_xp < 200 THEN new_level := 1;      -- Vagabond
    ELSIF new_xp < 800 THEN new_level := 2;   -- Explorateur
    ELSIF new_xp < 2400 THEN new_level := 3;  -- Initié
    ELSIF new_xp < 6000 THEN new_level := 4;  -- Adepte
    ELSIF new_xp < 15000 THEN new_level := 5; -- Praticien
    ELSIF new_xp < 30000 THEN new_level := 6; -- EXPERT (Le Mur)
    ELSIF new_xp < 60000 THEN new_level := 7; -- Virtuose
    ELSIF new_xp < 120000 THEN new_level := 8; -- Maître
    ELSIF new_xp < 250000 THEN new_level := 9; -- Grand Maître
    ELSE new_level := 10;                     -- Légende Vivante
    END IF;

    -- Mise à jour du profil
    UPDATE public.user_profiles 
    SET 
      xp_points = xp_points + NEW.xp_reward,
      level = new_level
    WHERE id = NEW.assigned_to;
    
    -- Log
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

-- Recalculer les niveaux existants
DO $$
DECLARE
  r RECORD;
  lvl integer;
BEGIN
  FOR r IN SELECT id, xp_points FROM public.user_profiles LOOP
    IF r.xp_points < 200 THEN lvl := 1;
    ELSIF r.xp_points < 800 THEN lvl := 2;
    ELSIF r.xp_points < 2400 THEN lvl := 3;
    ELSIF r.xp_points < 6000 THEN lvl := 4;
    ELSIF r.xp_points < 15000 THEN lvl := 5;
    ELSIF r.xp_points < 30000 THEN lvl := 6;
    ELSIF r.xp_points < 60000 THEN lvl := 7;
    ELSIF r.xp_points < 120000 THEN lvl := 8;
    ELSIF r.xp_points < 250000 THEN lvl := 9;
    ELSE lvl := 10;
    END IF;

    UPDATE public.user_profiles SET level = lvl WHERE id = r.id;
  END LOOP;
END $$;
