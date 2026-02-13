import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, x-supabase-client-platform, x-supabase-client-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { question, file_id, userName, referentName, expertNames } = await req.json();

    if (!question || !file_id) {
      return new Response(JSON.stringify({ error: 'Missing question or file_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const MISTRAL_API_KEY = Deno.env.get('MISTRAL_API_KEY')?.trim();
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Prepare Expert Fallback Message
    let expertFallback = "";
    if (referentName) {
        expertFallback += `Tu peux contacter le référent officiel : **${referentName}**.`;
    }
    if (expertNames && Array.isArray(expertNames) && expertNames.length > 0) {
        expertFallback += `\nSinon, voici des collègues qui maîtrisent cette procédure : **${expertNames.join(", ")}**.`;
    }

    // 1. Generate embedding for the question
    console.log(`🧠 Generating embedding for question: "${question}"`);
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

    // 2. Search for relevant chunks in Supabase
    console.log(`🔍 Searching relevant chunks for file_id: ${file_id}`);
    const { data: chunks, error: matchError } = await supabase.rpc('match_procedure_chunks', {
      query_embedding: embedding,
      match_count: 5,
      p_file_id: file_id,
    });

    if (matchError) {
      console.error('❌ Match Error:', matchError);
      throw matchError;
    }

    const context = chunks?.map((c: any) => c.content).join('\n\n') || 'No context found.';

    // 3. Generate answer using Mistral Large
    console.log(`🤖 Generating answer with Mistral...`);
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
            content: `Tu es l'Expert Procedio, un assistant technique spécialisé. Ta mission est d'aider l'utilisateur ${userName || ''} en répondant à ses questions sur une procédure technique.
            
            CONSIGNES CRITIQUES :
            1. Réponds UNIQUEMENT en te basant sur le CONTEXTE fourni ci-dessous.
            2. Si la réponse n'est pas dans le contexte ou que l'information est manquante :
               - Dis poliment que tu n'as pas l'info précise dans le document.
               - ${expertFallback ? "Ensuite, suggère de contacter ces experts :\n" + expertFallback : "Suggère à l'utilisateur de cliquer sur 'Suggérer une modif' pour alerter le manager."}
            3. Sois précis, technique et professionnel.
            4. Utilise le Markdown pour la mise en forme (gras, listes, étapes).
            
            CONTEXTE DU DOCUMENT :
            ${context}`,
          },
          {
            role: 'user',
            content: question,
          },
        ],
        temperature: 0.1, // Low temperature for factual consistency
      }),
    });

    const chatData = await chatRes.json();
    const answer = chatData.choices[0].message.content;

    return new Response(JSON.stringify({ output: answer }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('🔥 ERREUR :', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
