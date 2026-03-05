-- Cleanup duplicate notifications
DELETE FROM notifications a USING notifications b
WHERE a.id < b.id
AND a.user_id = b.user_id
AND a.content = b.content
AND abs(extract(epoch from a.created_at - b.created_at)) < 5;
