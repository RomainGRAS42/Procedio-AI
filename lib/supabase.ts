
import { createClient } from '@supabase/supabase-js';

// Utilisation directe des clés car import.meta.env est undefined dans cet environnement
const supabaseUrl = 'https://hdiccjotkraavpqybabn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjemxpa3l2Zm1yZGF1dWZneGFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2NTA5NDEsImV4cCI6MjA3OTIyNjk0MX0.4cpm9gBvpwOaBQAivN-f7Gh6Bn8KAhPzHW8pTlDj0c8';

export const supabase = createClient(supabaseUrl, supabaseKey);
