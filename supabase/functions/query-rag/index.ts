import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { question, file_id } = await req.json();
    const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY");
    if (!MISTRAL_API_KEY) throw new Error("MISTRAL_API_KEY is not set");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Generate Embedding for query
    const embedResponse = await fetch("https://api.mistral.ai/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        model: "mistral-embed",
        input: [question],
      }),
    });

    if (!embedResponse.ok) throw new Error("Embedding failed");
    const { data: embedData } = await embedResponse.json();
    const embedding = embedData[0].embedding;

    // 2. Vector Search
    const { data: documents, error: matchError } = await supabase.rpc("match_documents", {
      query_embedding: embedding,
      match_count: 5,
      filter: file_id ? { file_id } : {}, 
    });

    if (matchError) throw matchError;

    const context = documents.map((d: any) => d.content).join("\n\n---\n\n");
    
    // 3. Answer Generation
    const chatResponse = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
        messages: [
          { role: "system", content: "Tu es un assistant expert pour la plateforme Procedio. Réponds aux questions de l'utilisateur en français de manière concise et professionnelle, en te basant UNIQUEMENT sur le contexte fourni. Si la réponse n'est pas dans le contexte, dis que tu ne sais pas." },
          { role: "user", content: `Contexte :\n${context}\n\nQuestion : ${question}` }
        ],
      }),
    });

    if (!chatResponse.ok) throw new Error("Chat completion failed");
    const chatData = await chatResponse.json();
    
    return new Response(JSON.stringify({ 
      output: chatData.choices[0].message.content,
      procedures: [] 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in query-rag:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
