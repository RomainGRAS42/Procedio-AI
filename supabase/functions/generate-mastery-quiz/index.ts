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
      throw new Error("Missing procedure_id in request body");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY")?.trim();

    if (!MISTRAL_API_KEY) {
      throw new Error("Missing MISTRAL_API_KEY configuration");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Fetch Procedure Content (Chunks)
    console.log(`🔍 Fetching content for procedure: ${procedure_id}`);
    const { data: documents, error: fetchError } = await supabase
      .from("documents")
      .select("content")
      .eq("file_id", procedure_id)
      .limit(10); // Limit to first 10 chunks to check context size

    if (fetchError) {
      console.error("Database Error:", fetchError);
      throw new Error("Failed to fetch procedure content");
    }

    if (!documents || documents.length === 0) {
      throw new Error("No content found for this procedure. Ensure it has been processed.");
    }

    const fullText = documents.map(d => d.content).join("\n\n");
    console.log(`📄 Retrieved ${fullText.length} characters of context.`);

    // 2. Call Mistral AI to Generate Quiz
    console.log("🧠 Sending request to Mistral AI...");
    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        model: "mistral-large-latest",
        messages: [
          {
            role: "system",
            content: `Tu es un expert en formation technique et pédagogie. 
Ta mission est de créer un examen de validation des acquis (CM) basé EXCLUSIVEMENT sur le texte fourni.
Génère 5 questions à choix multiples (QCM).

Format de sortie JSON ATTENDU (Strictement ce format, pas de texte avant/après) :
[
  {
    "question": "L'intitulé de la question ?",
    "options": ["Choix A", "Choix B", "Choix C", "Choix D"],
    "correctAnswer": 0, // Index du bon choix (0 pour A, 1 pour B...)
    "explanation": "Courte explication de la réponse."
  },
  ...
]

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
        temperature: 0.3
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Mistral API Error:", errText);
      throw new Error(`Mistral API Error: ${response.statusText}`);
    }

    const aiData = await response.json();
    const rawContent = aiData.choices[0].message.content;
    
    // 3. Parse and Validate JSON
    let questions;
    try {
      // Sometimes models wrap JSON in markdown blocks like ```json ... ```
      const cleanJson = rawContent.replace(/```json/g, "").replace(/```/g, "").trim();
      questions = JSON.parse(cleanJson);
      
      // Wrap in case the model returns an object { questions: [...] } instead of array directly
      if (!Array.isArray(questions) && questions.questions) {
        questions = questions.questions;
      }
    } catch (e) {
      console.error("JSON Parse Error:", e, "Raw Content:", rawContent);
      throw new Error("Failed to parse AI generated quiz.");
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
