import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-supabase-client-platform, x-supabase-client-version",
};

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { procedure_id } = await req.json();

    if (!procedure_id) {
      return new Response(JSON.stringify({ error: "Missing procedure_id in request body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY")?.trim();

    if (!MISTRAL_API_KEY) {
      console.error("Configuration Error: Missing MISTRAL_API_KEY");
      throw new Error("Server Configuration Error: Missing AI Key");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Fetch Procedure Content (Chunks)
    console.log(`🔍 Fetching content for procedure: ${procedure_id}`);
    const { data: documents, error: fetchError } = await supabase
      .from("documents")
      .select("content")
      .eq("file_id", procedure_id)
      .limit(15); 

    if (fetchError) {
      console.error("Database Error:", fetchError);
      throw new Error("Failed to fetch procedure content from database");
    }

    let fullText = "";
    if (documents && documents.length > 0) {
      fullText = documents.map(d => d.content).join("\n\n");
      console.log(`📄 Retrieved ${fullText.length} characters of context from documents.`);
    } else {
      console.warn(`⚠️ No documents found for file_id: ${procedure_id}. Attempting to fetch procedure metadata.`);
      // Fallback: Try to get procedure info as context if content is missing
      const { data: procedure, error: procError } = await supabase
        .from("procedures")
        .select("title, category")
        .eq("uuid", procedure_id)
        .single();
      
      if (procError || !procedure) {
        return new Response(JSON.stringify({ error: "Procedure not found and no content available." }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      fullText = `Titre: ${procedure.title}\nCatégorie: ${procedure.category}`;
      console.log(`📄 Using procedure metadata as fallback context: "${procedure.title}"`);
    }

    // 2. Call Mistral AI to Generate Quiz
    console.log("🧠 Sending request to Mistral AI...");
    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        model: "open-mistral-nemo", 
        messages: [
          {
            role: "system",
            content: `Tu es un expert en formation technique et pédagogie. 
Ta mission est de créer un examen de validation des acquis basé EXCLUSIVEMENT sur le texte fourni.
Génère 5 questions à choix multiples (QCM).

Format de sortie JSON ATTENDU :
{
  "questions": [
    {
      "question": "L'intitulé de la question ?",
      "options": ["Choix A", "Choix B", "Choix C", "Choix D"],
      "correctAnswer": 0,
      "explanation": "Courte explication de la réponse."
    }
  ]
}

Règles :
- Les questions doivent être pertinentes et tester la compréhension réelle.
- Une seule bonne réponse par question.
- 4 choix possibles par question.
- Langue : Français.`
          },
          {
            role: "user",
            content: `PROCÉDURE SOURCE :\n${fullText}`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Mistral API Error Status:", response.status, "Body:", errText);
      throw new Error(`AI Provider Error: ${response.statusText}`);
    }

    const aiData = await response.json();
    const rawContent = aiData.choices[0].message.content;
    console.log("📥 AI Response Raw Content received.");
    
    // 3. Parse and Validate JSON
    let questions;
    try {
      const parsed = JSON.parse(rawContent);
      questions = parsed.questions || parsed; 
      
      if (!Array.isArray(questions)) {
        throw new Error("Parsed content is not an array of questions");
      }
    } catch (e: any) {
      console.error("JSON Parse Error:", e.message, "Raw Content:", rawContent);
      throw new Error("Failed to parse AI generated quiz structure.");
    }

    console.log(`✅ Successfully generated ${questions.length} questions.`);

    return new Response(JSON.stringify(questions), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("🔥 Edge Function Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
