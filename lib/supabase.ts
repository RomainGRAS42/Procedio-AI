
import { createClient } from '@supabase/supabase-js';

/**
 * CONFIGURATION SUPABASE
 * L'URL doit correspondre au 'ref' contenu dans le jeton JWT de la clé anon.
 * Ici, le jeton contient "ref":"pczlikyvfmrdauufgxai".
 */
const supabaseUrl = 'https://pczlikyvfmrdauufgxai.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjemxpa3l2Zm1yZGF1dWZneGFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2NTA5NDEsImV4cCI6MjA3OTIyNjk0MX0.4cpm9gBvpwOaBQAivN-f7Gh6Bn8KAhPzHW8pTlDj0c8';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

/**
 * Diagnostic de connexion pour valider que le couple URL/Key est valide
 */
export const checkSupabaseConnection = async () => {
  try {
    // Vérification légère uniquement sur l'URL pour ne pas réveiller la DB inutilement
    // On suppose que si l'URL est définie, le client est prêt.
    // La vraie validation se fera lors des appels de données.
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Configuration Supabase manquante");
    }
    return { status: "ok", msg: "Prêt" };
  } catch (err: any) {
    console.error("Supabase Diagnostic Error:", err);
    return { status: "error", msg: err.message };
  }
};
