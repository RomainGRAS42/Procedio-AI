-- Remplacer la fonction de notification d'assignation pour gérer l'auto-assignation
CREATE OR REPLACE FUNCTION handle_mission_assignment()
RETURNS TRIGGER AS $$
DECLARE
    creator_name TEXT;
    current_user_id UUID;
BEGIN
    -- Only proceed if assigned_to has changed and is not null
    IF (OLD.assigned_to IS NULL AND NEW.assigned_to IS NOT NULL) OR (OLD.assigned_to != NEW.assigned_to AND NEW.assigned_to IS NOT NULL) THEN
        
        -- Get current user ID (who triggered the action)
        current_user_id := auth.uid();
        
        -- Get creator name
        SELECT CONCAT(first_name, ' ', last_name) INTO creator_name FROM user_profiles WHERE id = NEW.created_by;

        -- Check if it's self-assignment
        IF current_user_id = NEW.assigned_to THEN
            -- Self-assignment: "Vous avez pris en charge..."
            INSERT INTO notifications (user_id, type, title, content, link, is_read)
            VALUES (
                NEW.assigned_to,
                'mission_status', -- Changed type to status instead of assigned for self-action
                'Mission acceptée ✅',
                'Vous avez pris en charge la mission "' || NEW.title || '". Bon courage !',
                '/missions?id=' || NEW.id,
                false
            );
        ELSE
            -- Manager assignment: "Vous avez été assigné..."
            INSERT INTO notifications (user_id, type, title, content, link, is_read)
            VALUES (
                NEW.assigned_to,
                'mission_assigned',
                'Nouvelle mission',
                'Vous avez été assigné à la mission "' || NEW.title || '" par ' || COALESCE(creator_name, 'un manager'),
                '/missions?id=' || NEW.id,
                false
            );
        END IF;

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
