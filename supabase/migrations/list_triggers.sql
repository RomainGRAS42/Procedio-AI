
DO $$
DECLARE
    t_name text;
    trg_name text;
BEGIN
    FOR t_name, trg_name IN 
        SELECT event_object_table, trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_table = 'missions'
    LOOP
        RAISE NOTICE 'Trigger on %: %', t_name, trg_name;
    END LOOP;
END $$;
