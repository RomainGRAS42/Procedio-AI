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
    console.log(`🧐 [V6] Question: ${question}`);

    const MISTRAL_API_KEY = Deno.env.get('MISTRAL_API_KEY')?.trim();
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Generate embedding
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

    // 2. Search relevant chunks
    const { data: chunks, error: matchError } = await supabase.rpc('match_documents', {
      query_embedding: embedding,
      match_count: 5,
    });

    if (matchError) throw matchError;

    const topScore = chunks && chunks.length > 0 ? chunks[0].similarity : 0;
    
    // Threshold Logic
    if (topScore > 0.82) {
      // EXPERT Mode
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
              content: `Tu es le Copilote Procedio. Aide ${userName}. Réponse courte et précise. CONTEXTE:\n${context}`,
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
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } 
    
    if (topScore >= 0.50) { 
      // EXPLORER Mode
      const titles = Array.from(new Set(chunks.map((c: any) => c.metadata?.title))).join(', ');
      const chunksToLabel = chunks.map((c: any, i: number) => `ID:${i} | ${c.content.substring(0, 300)}`).join('\n\n');

      const discoveryRes = await fetch('https://api.mistral.ai/v1/chat/completions', {
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
              content: `Tu es le Copilote Procedio. Analyse ces extraits pour répondre à: "${question}".
              RENVOIE UNIQUEMENT DU JSON : 
              {
                "summary": "Une seule phrase très courte qui introduit les documents. Ex: 'Voici des procédures pour configurer Outlook.'",
                "labels": ["Nom court et explicite de ce qui est dit dans l'extrait ID:0", "Extrait ID:1", ...]
              }`,
            },
            { role: 'user', content: chunksToLabel },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
        }),
      });
      
      const discoveryData = await discoveryRes.json();
      const { summary, labels } = JSON.parse(discoveryData.choices[0].message.content);

      const groupedMap = new Map();
      chunks.forEach((c: any, i: number) => {
        const docTitle = c.metadata?.title || "Document";
        if (!groupedMap.has(docTitle)) {
          groupedMap.set(docTitle, {
            title: docTitle,
            path: c.metadata?.storage_path,
            chunks: []
          });
        }
        groupedMap.get(docTitle).chunks.push({
          label: labels?.[i] || "Détails essentiels",
          content: c.content,
          score: c.similarity
        });
      });

      return new Response(JSON.stringify({ 
        type: 'explorer',
        output: summary || `J'ai trouvé des pistes intéressantes dans ${titles}.`,
        groupedSuggestions: Array.from(groupedMap.values())
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // UNCERTAIN
    return new Response(JSON.stringify({ 
      type: 'uncertain',
      output: "Je n'ai pas trouvé de procédure correspondante dans la base. Voulez-vous notifier un manager ?",
      score: topScore
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error("❌ Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
