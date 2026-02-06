import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, x-supabase-client-platform, x-supabase-client-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { question, userName, userId } = await req.json();

    if (!question) {
      return new Response(JSON.stringify({ error: 'Missing question' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const MISTRAL_API_KEY = Deno.env.get('MISTRAL_API_KEY')?.trim();
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Generate embedding for the question
    const embedRes = await fetch('https://api.mistral.ai/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'mistral-embed',
        input: [question],
      }),
    });

    const embedData = await embedRes.json();
    const embedding = embedData.data[0].embedding;

    // 2. Search relevant chunks across ALL documents
    const { data: chunks, error: matchError } = await supabase.rpc('match_documents', {
      query_embedding: embedding,
      match_count: 5,
    });

    if (matchError) throw matchError;

    const topScore = chunks && chunks.length > 0 ? chunks[0].similarity : 0;
    
    // Threshold Logic
    // 1. EXPERT (> 0.75)
    if (topScore > 0.75) {
      const context = chunks.map((c: any) => c.content).join('\n\n');
      const chatRes = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MISTRAL_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'mistral-large-latest',
          messages: [
            {
              role: 'system',
              content: `Tu es le Copilote Procedio. Aide l'utilisateur ${userName || ''} à résoudre son problème technique.
              Réponds de manière concise et pro en utilisant le CONTEXTE fourni. 
              Cite le titre du document source dans ta réponse.
              
              CONTEXTE :
              ${context}`,
            },
            { role: 'user', content: question },
          ],
          temperature: 0.1,
        }),
      });

      const chatData = await chatRes.json();
      return new Response(JSON.stringify({ 
        type: 'expert',
        output: chatData.choices[0].message.content,
        score: topScore,
        source: chunks[0].metadata?.title,
        sourcePath: chunks[0].metadata?.storage_path
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } 
    
    // 2. EXPLORER (0.50 - 0.75)
    if (topScore >= 0.50) {
      return new Response(JSON.stringify({ 
        type: 'explorer',
        output: "Je n'ai pas de réponse unique, mais voici les passages les plus pertinents qui pourraient vous aider :",
        suggestions: chunks.map((c: any) => ({
          title: c.metadata?.title,
          content: c.content,
          score: c.similarity,
          path: c.metadata?.storage_path
        }))
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. UNCERTAIN (< 0.50)
    return new Response(JSON.stringify({ 
      type: 'uncertain',
      output: "Désolé, je ne trouve pas de réponse évidente dans nos guides actuels.",
      score: topScore
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
