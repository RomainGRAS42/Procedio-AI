import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as mammoth from "https://esm.sh/mammoth@1.6.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-supabase-client-platform, x-supabase-client-version",
};

const sanitize = (str: string) => {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^a-z0-9]/gi, "_") // Replace non-alphanumeric with _
    .toLowerCase();
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const title = (formData.get("title") as string) || "Sans titre";
    const file_id = (formData.get("file_id") as string);
    const category = (formData.get("category") as string) || "AUTRE";
    const uploadDate = formData.get("upload_date");
    const source_id = formData.get("source_id") as string | null;

    const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY")?.trim();
    if (!MISTRAL_API_KEY) {
      throw new Error("La clé API Mistral (MISTRAL_API_KEY) est manquante dans les secrets.");
    }
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    console.log(`🔍 Traitement d'un fichier .${fileExtension} (ID: ${file_id})`);
    
    const isPDF = fileExtension === 'pdf';
    const isWord = fileExtension === 'docx';
    const isImage = ['jpg', 'jpeg', 'png'].includes(fileExtension || '');

    let fullMarkdown = "";
    
    // Path definition: CATEGORY / TITRE_SANI _ ID8 . EXT
    const sanitizedTitle = sanitize(title);
    const idSuffix = file_id.substring(0, 8);
    let storagePath = `${category}/${sanitizedTitle}_${idSuffix}.${fileExtension}`;

    // 1. EXTRACTION DU CONTENU (Soft Fail)
    try {
      if (isPDF || isImage) {
        console.log("📑 Extraction OCR Mistral...");
        const uploadFormData = new FormData();
        uploadFormData.append("file", file);
        uploadFormData.append("purpose", "ocr");

        // Timeout race for upload
        const uploadRes = await fetch("https://api.mistral.ai/v1/files", {
          method: "POST",
          headers: { "Authorization": `Bearer ${MISTRAL_API_KEY}` },
          body: uploadFormData,
        });

        if (uploadRes.ok) {
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
           
           if (ocrRes.ok) {
             const ocrData = await ocrRes.json();
             fullMarkdown = ocrData.pages?.map((p: any) => p.markdown).join("\n\n") || "";
             console.log(`✅ OCR terminé (${fullMarkdown.length} caractères)`);
           } else {
             console.warn(`⚠️ Erreur OCR Mistral: ${await ocrRes.text()}`);
           }

           // Cleanup
           fetch(`https://api.mistral.ai/v1/files/${mistralFileId}`, {
               method: "DELETE",
               headers: { "Authorization": `Bearer ${MISTRAL_API_KEY}` }
           }).catch(() => {});
        } else {
           console.warn(`⚠️ Erreur Upload Mistral: ${await uploadRes.text()}`);
        }

      } else if (isWord) {
        console.log("📑 Extraction texte Word (Mammoth)...");
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        fullMarkdown = result.value;
      }
    } catch (err) {
      console.error("⚠️ Erreur non-bloquante lors de l'extraction AI:", err);
      // On continue sans markdown, le fichier sera au moins stocké
    }

    // 2. RÉÉCRITURE IA (DESACTIVÉE)
    if (!isPDF && fullMarkdown.trim()) {
        storagePath = `${category}/${sanitizedTitle}_${idSuffix}.md`;
    }

    // 3. ARCHIVAGE DANS STORAGE
    console.log(`📂 Archivage: procedures/${storagePath}...`);
    const fileToUpload = !isPDF ? new Blob([fullMarkdown], { type: 'text/markdown' }) : file;
    
    const { error: storageError } = await supabase.storage
      .from('procedures')
      .upload(storagePath, fileToUpload, { 
        contentType: !isPDF ? 'text/markdown' : 'application/pdf', 
        upsert: true 
      });

    if (storageError) throw storageError;

    // 4. SYNCHRONISATION BDD
    console.log("💾 Mise à jour de l'entrée Procédure...");
    const { error: procError } = await supabase.from('procedures').upsert({
      uuid: file_id,
      file_id: file_id,
      title: title,
      Type: category,
      file_url: storagePath, // Stockage du chemin relatif (CATEGORY/FILE.ext)
      source_id: source_id || null,
      created_at: uploadDate || new Date().toLocaleString('fr-FR'),
      updated_at: new Date().toISOString()
    }, { onConflict: 'uuid' });

    if (procError) throw procError;

    // 5. CHUNKING & EMBEDDINGS (Pour le Chat Assistant)
    console.log("🧠 Génération des embeddings...");
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

    console.log("🚀 Succès total !");
    return new Response(JSON.stringify({ success: true, title, storagePath }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("🔥 ERREUR :", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
