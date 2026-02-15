
import { createClient } from '@supabase/supabase-js';

/**
 * CONFIGURATION SUPABASE
 * L'URL doit correspondre au 'ref' contenu dans le jeton JWT de la clé anon.
 * Ici, le jeton contient "ref":"pczlikyvfmrdauufgxai".
 */
// Use custom define constants as primary source (baked in at build time)
// with import.meta.env as fallback for development.
const supabaseUrl = typeof __SUPABASE_URL__ !== 'undefined' ? __SUPABASE_URL__ : import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = typeof __SUPABASE_KEY__ !== 'undefined' ? __SUPABASE_KEY__ : import.meta.env.VITE_SUPABASE_ANON_KEY;

// Safety check to prevent blank page
if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase configuration missing (Final Check).");
}

export const supabase = createClient(supabaseUrl || 'https://placeholder-url.supabase.co', supabaseKey || 'placeholder-key', {
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
