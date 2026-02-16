import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    
    // Build-time validation: ensures the production bundle is never broken
    if (mode === 'production' && (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY)) {
      const missingVars = [];
      if (!env.VITE_SUPABASE_URL) missingVars.push('VITE_SUPABASE_URL');
      if (!env.VITE_SUPABASE_ANON_KEY) missingVars.push('VITE_SUPABASE_ANON_KEY');
      
      throw new Error(`\n\n❌ ERROR: Supabase environment variables are missing in your environment!
Missing: ${missingVars.join(', ')}
Building without these will break the app. Please ensure they are set in .env.local or your deployment environment.\n\n`);
    }

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        '__CONFIG__': JSON.stringify({
          SUPABASE_URL: env.VITE_SUPABASE_URL,
          SUPABASE_KEY: env.VITE_SUPABASE_ANON_KEY
        })
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
