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
    // 1. Log Request Info
    console.log(`📥 Received ${req.method} request`);
    
    let procedure_id;
    let request_id;
    let manager_name = "Le Manager";
    
    try {
      const body = await req.json();
      procedure_id = body.procedure_id;
      request_id = body.request_id;
      manager_name = body.manager_name || manager_name;
      console.log("📦 Parsed Procedure ID:", procedure_id, "Request ID:", request_id);
    } catch (e: any) {
      console.error("❌ Failed to parse request JSON body:", e.message);
      return new Response(JSON.stringify({ error: "Invalid JSON body", details: e.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!procedure_id) {
      console.error("❌ Missing procedure_id in body");
      return new Response(JSON.stringify({ error: "Missing procedure_id in request body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY")?.trim();

    console.log(`🔧 Env Check: URL=${!!SUPABASE_URL}, Key=${!!MISTRAL_API_KEY}`);

    if (!MISTRAL_API_KEY) {
      console.error("❌ Configuration Error: Missing MISTRAL_API_KEY");
      throw new Error("Server Configuration Error: Missing AI Key");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Fetch Procedure Content (Chunks)
    console.log(`🔍 Fetching content for procedure: ${procedure_id}`);
    const { data: documents, error: fetchError } = await supabase
      .from("documents")
      .select("content")
      .eq("file_id", procedure_id)
      .limit(8); 

    if (fetchError) {
      console.error("❌ Database Error (documents):", fetchError);
      throw new Error("Failed to fetch procedure content from database");
    }

    let fullText = "";
    let procedureTitle = "Procédure";

    // Try to get procedure title regardless of content availability
    const { data: procedureData } = await supabase
      .from("procedures")
      .select("title, category")
      .eq("uuid", procedure_id)
      .single();
    
    if (procedureData) {
      procedureTitle = procedureData.title;
    }

    if (documents && documents.length > 0) {
      fullText = documents.map(d => d.content).join("\n\n");
      console.log(`📄 Retrieved ${fullText.length} characters of context.`);
    } else if (procedureData) {
      console.warn(`⚠️ No documents found. Falling back to procedure metadata.`);
      fullText = `Titre: ${procedureData.title}\nCatégorie: ${procedureData.category}`;
      console.log(`📄 Using procedure metadata as fallback: "${procedureData.title}"`);
    } else {
      console.error("❌ Procedure not found.");
      return new Response(JSON.stringify({ error: "Procedure not found." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Call Mistral AI to Generate Quiz
    console.log("🧠 Requesting Mistral AI...");
    const mistralResponse = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
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
      "q": "L'intitulé de la question ?",
      "options": ["Choix A", "Choix B", "Choix C", "Choix D"],
      "correct": 0,
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

    if (!mistralResponse.ok) {
      const errText = await mistralResponse.text();
      console.error("❌ Mistral API Error:", mistralResponse.status, errText);
      throw new Error(`AI Provider Error (${mistralResponse.status})`);
    }

    const aiData = await mistralResponse.json();
    const rawContent = aiData.choices[0].message.content;
    console.log("📥 AI Response Raw Content received.");
    
    // 3. Parse and Validate JSON
    let quizDataObject;
    try {
      const parsed = JSON.parse(rawContent);
      // Garantir que quiz_data contient une clé 'questions'
      if (Array.isArray(parsed)) {
        quizDataObject = { questions: parsed };
      } else if (parsed && Array.isArray(parsed.questions)) {
        quizDataObject = parsed;
      } else {
        throw new Error("Parsed content is not a valid quiz structure");
      }
    } catch (e: any) {
      console.error("❌ JSON Parse Error:", e.message, "Raw Content:", rawContent);
      throw new Error("Failed to parse AI generated quiz structure.");
    }

    console.log(`✅ Successfully generated ${quizDataObject.questions.length} questions.`);

    // 4. Background Persistence & Notifications (If request_id is present)
    if (request_id) {
      console.log(`💾 Persisting data for request: ${request_id}`);
      
      // Update the mastery request
      const { data: requestData, error: updateError } = await supabase
        .from('mastery_requests')
        .update({
          quiz_data: quizDataObject,
          status: 'approved' // Ensure it's approved after quiz generation
        })
        .eq('id', request_id)
        .select(`
          user_id,
          user_profiles:user_id (first_name)
        `)
        .single();
      
      if (updateError) {
        console.error("❌ Failed to update mastery_requests:", updateError);
      } else if (requestData) {
        const technicianName = requestData.user_profiles?.first_name || "le technicien";
        
        // Activity Log for Manager
        // Note: we don't have manager_id here easily without passing it, but let's assume request_id contains context or we use service role.
        await supabase.from("notes").insert({
          user_id: requestData.user_id, // For log feed, we can associate with technician or a manager id if passed.
          title: `LOG_MASTERY_APPROVED_${request_id}`,
          content: `L'examen pour "${procedureTitle}" demandé par ${technicianName} a été généré avec succès par l'IA.`,
          is_locked: false
        }).catch((e: any) => console.error("❌ Note log error:", e.message));

        // Notification for the Technician
        await supabase.from("notes").insert({
          user_id: requestData.user_id,
          title: `MASTERY_APPROVED_${request_id}`,
          content: `Bonne nouvelle ! Ton examen pour "${procedureTitle}" est prêt. Clique pour le lancer !`,
          is_locked: false,
          viewed: false
        }).catch((e: any) => console.error("❌ Note notif error:", e.message));
        
        console.log("🔔 Notifications pushed to technicians.");
      }
    }

    return new Response(JSON.stringify(quizDataObject), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("🔥 Global Function Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
