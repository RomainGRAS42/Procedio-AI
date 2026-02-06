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

    const MISTRAL_API_KEY = Deno.env.get('MISTRAL_API_KEY')?.trim();
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Embedding
    const embedRes = await fetch('https://api.mistral.ai/v1/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${MISTRAL_API_KEY}` },
      body: JSON.stringify({ model: 'mistral-embed', input: [question] }),
    });

    const embedData = await embedRes.json();
    const embedding = embedData.data[0].embedding;

    // 2. Search
    const { data: chunks, error: matchError } = await supabase.rpc('match_documents', {
      query_embedding: embedding, match_count: 5,
    });
    if (matchError) throw matchError;

    const topScore = chunks && chunks.length > 0 ? chunks[0].similarity : 0;
    
    if (topScore > 0.82) {
      // EXPERT
      const context = chunks.map((c: any) => c.content).join('\n\n');
      const chatRes = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${MISTRAL_API_KEY}` },
        body: JSON.stringify({
          model: 'mistral-large-latest',
          messages: [
            { 
              role: 'system', 
              content: `Tu es le Copilote Procedio AI. Aide ${userName || 'l\'utilisateur'}. 
              Tes réponses doivent être précises, professionnelles et directes. 
              Utilise le contexte fourni pour répondre de manière concise.` 
            },
            { role: 'user', content: `CONTEXTE:\n${context}\n\nQUESTION: ${question}` },
          ],
          temperature: 0.1,
        }),
      });
      const chatData = await chatRes.json();
      return new Response(JSON.stringify({ 
        type: 'expert',
        output: chatData.choices[0].message.content,
        score: topScore, source: chunks[0].metadata?.title, sourcePath: chunks[0].metadata?.storage_path
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } 
    
    if (topScore >= 0.45) {
      // EXPLORER
      const discoveryRes = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${MISTRAL_API_KEY}` },
        body: JSON.stringify({
          model: 'mistral-large-latest',
          messages: [
            {
              role: 'system',
              content: `Tu es le Copilote Procedio. Analyse ces extraits pour répondre à: "${question}".
              RENVOIE UNIQUEMENT DU JSON : 
              {
                "summary": "Une réponse de 30 à 45 mots qui explique pourquoi ces documents sont pertinents et ce qu'ils couvrent globalement. Sois accueillant et informatif.",
                "labels": ["Libellé court et explicite de l'extrait", ...]
              }`,
            },
            { role: 'user', content: chunks.map((c: any, i:number) => `[${i}] ${c.content.substring(0, 400)}`).join('\n') },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
        }),
      });
      const discoveryData = await discoveryRes.json();
      const parsed = JSON.parse(discoveryData.choices[0].message.content);

      const groupedMap = new Map();
      chunks.forEach((c: any, i: number) => {
        const docTitle = c.metadata?.title || "Document";
        if (!groupedMap.has(docTitle)) {
          groupedMap.set(docTitle, { title: docTitle, path: c.metadata?.storage_path, chunks: [] });
        }
        groupedMap.get(docTitle).chunks.push({
          label: parsed.labels?.[i] || "Détails essentiels",
          content: c.content,
          score: c.similarity
        });
      });

      return new Response(JSON.stringify({ 
        type: 'explorer',
        output: parsed.summary || "J'ai identifié plusieurs passages dans la base de connaissance qui pourraient vous aider à résoudre votre problème.",
        groupedSuggestions: Array.from(groupedMap.values())
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ 
      type: 'uncertain',
      output: "Désolé, je ne trouve pas de procédure spécifique pour cette demande dans la base actuelle. Souhaitez-vous que j'en informe un administrateur ?", 
      score: topScore
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
