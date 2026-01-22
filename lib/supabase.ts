
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
    // Une simple requête sur l'auth ou une table publique pour tester la validité de la clé
    const { error } = await supabase.from('user_profiles').select('id').limit(1);
    
    if (error) {
      // Si la table n'existe pas, la clé est quand même valide (erreur 42P01 ou PGRST116)
      if (error.code === 'PGRST116' || error.code === '42P01') {
        return { status: 'ok', msg: 'Connecté (Clé valide)' };
      }
      // Si l'erreur est "Invalid API key", on le capture ici
      if (error.message.includes('apiKey') || error.message.includes('Invalid API key')) {
        throw new Error('Clé API ou URL invalide');
      }
      throw error;
    }
    return { status: 'ok', msg: 'Opérationnel' };
  } catch (err: any) {
    console.error('Supabase Diagnostic Error:', err);
    return { status: 'error', msg: err.message };
  }
};
