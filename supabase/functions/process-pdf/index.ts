import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-supabase-client-platform, x-supabase-client-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const title = formData.get("title") || "Document";
    const file_id = formData.get("file_id");
    const category = formData.get("category") || "AUTRE";

    const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY")?.trim();
    if (!MISTRAL_API_KEY) throw new Error("MISTRAL_API_KEY manquante");

    // 1. Archivage dans Supabase Storage (Nouveau)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log(`📂 Archivage Storage: procedures/${category}/${file.name}...`);
    const { error: storageError } = await supabase.storage
      .from('procedures')
      .upload(`${category}/${file.name}`, file, {
        contentType: file.type,
        upsert: true
      });

    if (storageError) {
        console.error("⚠️ Erreur Storage (non-bloquante):", storageError);
    } else {
        console.log("✅ Fichier archivé dans le bucket procedures.");
    }

    // 2. Upload vers Mistral pour OCR
    console.log(`📤 Upload Mistral: ${file.name}...`);
    const uploadFormData = new FormData();
    uploadFormData.append("file", file);
    uploadFormData.append("purpose", "ocr");

    const uploadResponse = await fetch("https://api.mistral.ai/v1/files", {
      method: "POST",
      headers: { "Authorization": `Bearer ${MISTRAL_API_KEY}` },
      body: uploadFormData,
    });

    const uploadData = await uploadResponse.json();
    if (!uploadResponse.ok) throw new Error(`Upload Mistral échoué: ${JSON.stringify(uploadData)}`);
    
    const mistralFileId = uploadData.id;

    // 3. Appel OCR
    console.log("📡 Lancement de l'OCR Mistral...");
    const ocrResponse = await fetch("https://api.mistral.ai/v1/ocr", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        model: "mistral-ocr-latest",
        document: {
          type: "file",
          file_id: mistralFileId,
        },
      }),
    });

    const ocrData = await ocrResponse.json();
    if (!ocrResponse.ok) throw new Error(`OCR échoué: ${JSON.stringify(ocrData)}`);
    
    const fullMarkdown = ocrData.pages?.map((p: any) => p.markdown).join("\n\n") || "Vide";
    console.log("✅ OCR terminé.");

    // 4. Chunking & Embeddings
    const chunks = fullMarkdown.match(/[\s\S]{1,2000}/g) || [fullMarkdown];
    
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedRes = await fetch("https://api.mistral.ai/v1/embeddings", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${MISTRAL_API_KEY}` },
            body: JSON.stringify({ model: "mistral-embed", input: [chunk] }),
        });
        const embedResult = await embedRes.json();
        
        await supabase.from("documents").insert({
            content: chunk,
            embedding: embedResult.data[0].embedding,
            file_id: file_id,
            metadata: { title, category, source: file.name, chunk_index: i },
        });
    }

    // Nettoyage Mistral
    fetch(`https://api.mistral.ai/v1/files/${mistralFileId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${MISTRAL_API_KEY}` }
    }).catch(() => {});

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("🔥 ERREUR :", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
