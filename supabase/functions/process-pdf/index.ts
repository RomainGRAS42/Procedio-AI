import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-supabase-client-platform, x-supabase-client-version",
};

// Nettoyage pour les chemins de fichiers (Supabase Storage)
// On autorise maintenant les espaces car ils seront gérés par l'API Storage
// Mais on enlève quand même les accents pour plus de sûreté
function sanitizePath(path: string) {
  return path
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Enleve les accents
    .replace(/[^a-zA-Z0-9.\-_/ ]/g, "_"); // Remplace spéciaux (sauf espace) par _
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const title = (formData.get("title") as string) || "Sans titre";
    const file_id = (formData.get("file_id") as string);
    const category = (formData.get("category") as string) || "AUTRE";
    const uploadDate = formData.get("upload_date");

    const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY")?.trim();
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 1. Archivage dans Storage
    const cleanTitle = sanitizePath(title);
    const storagePath = `${category}/${cleanTitle}.pdf`;
    
    console.log(`📂 Archivage: procedures/${storagePath}...`);
    const { error: storageError } = await supabase.storage
      .from('procedures')
      .upload(storagePath, file, { contentType: 'application/pdf', upsert: true });

    if (storageError) console.error("⚠️ Storage Error:", storageError);

    // 2. Synchronisation UI
    console.log("💾 Création de l'entrée Procédure...");
    const { error: procError } = await supabase.from('procedures').upsert({
      uuid: file_id, 
      title: title,
      Type: category,
      file_url: `https://pczlikyvfmrdauufgxai.supabase.co/storage/v1/object/public/procedures/${storagePath}`,
      file_id: file_id,
      created_at: uploadDate || new Date().toLocaleString('fr-FR'),
      updated_at: new Date().toISOString()
    });

    if (procError) console.error("❌ Erreur Base de données:", procError);

    // 3. Traitement Mistral OCR
    const uploadFormData = new FormData();
    uploadFormData.append("file", file);
    uploadFormData.append("purpose", "ocr");

    const uploadRes = await fetch("https://api.mistral.ai/v1/files", {
      method: "POST",
      headers: { "Authorization": `Bearer ${MISTRAL_API_KEY}` },
      body: uploadFormData,
    });
    const uploadData = await uploadRes.json();
    const mistralFileId = uploadData.id;

    const ocrRes = await fetch("https://api.mistral.ai/v1/ocr", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${MISTRAL_API_KEY}` },
      body: JSON.stringify({
        model: "mistral-ocr-latest",
        document: { type: "file", file_id: mistralFileId },
      }),
    });
    const ocrData = await ocrRes.json();
    const fullMarkdown = ocrData.pages?.map((p: any) => p.markdown).join("\n\n") || "";

    // 4. Chunking & Embeddings
    const chunks = fullMarkdown.match(/[\s\S]{1,2000}/g) || [fullMarkdown];
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedRes = await fetch("https://api.mistral.ai/v1/embeddings", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${MISTRAL_API_KEY}` },
            body: JSON.stringify({ model: "mistral-embed", input: [chunk] }),
        });
        const embedData = await embedRes.json();
        await supabase.from("documents").insert({
            content: chunk,
            embedding: embedData.data[0].embedding,
            file_id: file_id,
            metadata: { title, category, source: file.name, storage_path: storagePath, chunk_index: i },
        });
    }

    // Nettoyage
    fetch(`https://api.mistral.ai/v1/files/${mistralFileId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${MISTRAL_API_KEY}` }
    }).catch(() => {});

    return new Response(JSON.stringify({ success: true, title }), {
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
