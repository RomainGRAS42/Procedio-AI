-- Enable RLS on notifications if not already enabled
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own notifications
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications"
ON notifications FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can update their own notifications (to mark as read)
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications"
ON notifications FOR UPDATE
USING (auth.uid() = user_id);

-- Function to handle new chat messages in missions
CREATE OR REPLACE FUNCTION handle_new_mission_message()
RETURNS TRIGGER AS $$
DECLARE
    mission_record RECORD;
    recipient_id UUID;
    sender_name TEXT;
BEGIN
    -- Get mission details
    SELECT * INTO mission_record FROM missions WHERE id = NEW.mission_id;
    
    -- Get sender name
    SELECT CONCAT(first_name, ' ', last_name) INTO sender_name FROM user_profiles WHERE id = NEW.user_id;
    
    -- Determine recipients
    -- If sender is the creator, notify the assignee
    IF NEW.user_id = mission_record.created_by AND mission_record.assigned_to IS NOT NULL THEN
        INSERT INTO notifications (user_id, type, title, content, link, read)
        VALUES (
            mission_record.assigned_to,
            'chat_message',
            'Nouveau message',
            sender_name || ' a envoyé un message sur la mission "' || mission_record.title || '"',
            '/missions?id=' || NEW.mission_id,
            false
        );
    END IF;

    -- If sender is the assignee, notify the creator
    IF NEW.user_id = mission_record.assigned_to THEN
        INSERT INTO notifications (user_id, type, title, content, link, read)
        VALUES (
            mission_record.created_by,
            'chat_message',
            'Nouveau message',
            sender_name || ' a envoyé un message sur la mission "' || mission_record.title || '"',
            '/missions?id=' || NEW.mission_id,
            false
        );
    END IF;
    
    -- Also check mission_participants table for other participants (excluding sender)
    FOR recipient_id IN 
        SELECT user_id FROM mission_participants 
        WHERE mission_id = NEW.mission_id 
        AND user_id != NEW.user_id
        -- Avoid duplicates if they are already creator or assignee (though logic above handles distinct insert)
        AND user_id != mission_record.created_by
        AND (mission_record.assigned_to IS NULL OR user_id != mission_record.assigned_to)
    LOOP
        INSERT INTO notifications (user_id, type, title, content, link, read)
        VALUES (
            recipient_id,
            'chat_message',
            'Nouveau message',
            sender_name || ' a envoyé un message sur la mission "' || mission_record.title || '"',
            '/missions?id=' || NEW.mission_id,
            false
        );
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new chat messages
DROP TRIGGER IF EXISTS on_new_mission_message ON mission_messages;
CREATE TRIGGER on_new_mission_message
AFTER INSERT ON mission_messages
FOR EACH ROW
EXECUTE FUNCTION handle_new_mission_message();


-- Function to handle mission assignment
CREATE OR REPLACE FUNCTION handle_mission_assignment()
RETURNS TRIGGER AS $$
DECLARE
    creator_name TEXT;
BEGIN
    -- Only proceed if assigned_to has changed and is not null
    IF (OLD.assigned_to IS NULL AND NEW.assigned_to IS NOT NULL) OR (OLD.assigned_to != NEW.assigned_to AND NEW.assigned_to IS NOT NULL) THEN
        
        -- Get creator name
        SELECT CONCAT(first_name, ' ', last_name) INTO creator_name FROM user_profiles WHERE id = NEW.created_by;

        INSERT INTO notifications (user_id, type, title, content, link, read)
        VALUES (
            NEW.assigned_to,
            'mission_assigned',
            'Nouvelle mission',
            'Vous avez été assigné à la mission "' || NEW.title || '" par ' || COALESCE(creator_name, 'un manager'),
            '/missions?id=' || NEW.id,
            false
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for mission assignment
DROP TRIGGER IF EXISTS on_mission_assignment ON missions;
CREATE TRIGGER on_mission_assignment
AFTER INSERT OR UPDATE ON missions
FOR EACH ROW
EXECUTE FUNCTION handle_mission_assignment();


-- Function to handle mission status changes
CREATE OR REPLACE FUNCTION handle_mission_status_change()
RETURNS TRIGGER AS $$
DECLARE
    user_name TEXT;
BEGIN
    -- Only proceed if status has changed
    IF OLD.status != NEW.status THEN
        
        -- Case 1: Technician submits for validation (in_progress -> awaiting_validation)
        IF NEW.status = 'awaiting_validation' THEN
             -- Get assignee name (assuming assignee triggered this)
            SELECT CONCAT(first_name, ' ', last_name) INTO user_name FROM user_profiles WHERE id = NEW.assigned_to;
            
            INSERT INTO notifications (user_id, type, title, content, link, read)
            VALUES (
                NEW.created_by,
                'mission_status',
                'Validation requise',
                COALESCE(user_name, 'Le technicien') || ' a terminé la mission "' || NEW.title || '"',
                '/missions?id=' || NEW.id,
                false
            );
        END IF;

        -- Case 2: Manager validates (awaiting_validation -> completed)
        IF NEW.status = 'completed' AND NEW.assigned_to IS NOT NULL THEN
             -- Get manager name (assuming creator triggered this)
            SELECT CONCAT(first_name, ' ', last_name) INTO user_name FROM user_profiles WHERE id = NEW.created_by;

            INSERT INTO notifications (user_id, type, title, content, link, read)
            VALUES (
                NEW.assigned_to,
                'mission_status',
                'Mission validée',
                'La mission "' || NEW.title || '" a été validée !',
                '/missions?id=' || NEW.id,
                false
            );
        END IF;

        -- Case 3: Manager requests changes (awaiting_validation -> in_progress)
        IF OLD.status = 'awaiting_validation' AND NEW.status = 'in_progress' AND NEW.assigned_to IS NOT NULL THEN
             -- Get manager name
            SELECT CONCAT(first_name, ' ', last_name) INTO user_name FROM user_profiles WHERE id = NEW.created_by;

            INSERT INTO notifications (user_id, type, title, content, link, read)
            VALUES (
                NEW.assigned_to,
                'mission_status',
                'Retour sur mission',
                'La mission "' || NEW.title || '" nécessite des corrections.',
                '/missions?id=' || NEW.id,
                false
            );
        END IF;

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for mission status change
DROP TRIGGER IF EXISTS on_mission_status_change ON missions;
CREATE TRIGGER on_mission_status_change
AFTER UPDATE ON missions
FOR EACH ROW
EXECUTE FUNCTION handle_mission_status_change();
