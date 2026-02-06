import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-supabase-client-platform, x-supabase-client-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const title = formData.get("title");
    const file_id = formData.get("file_id");
    const category = formData.get("category");

    if (!file) throw new Error("No file uploaded");

    const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY");
    if (!MISTRAL_API_KEY) throw new Error("MISTRAL_API_KEY is not set in Supabase Secrets");

    console.log(`Processing file: ${file.name} for procedure: ${title}`);

    // 1. Call Mistral OCR
    const ocrFormData = new FormData();
    ocrFormData.append("file", file);
    ocrFormData.append("model", "mistral-ocr-latest");

    const ocrResponse = await fetch("https://api.mistral.ai/v1/ocr", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MISTRAL_API_KEY}`,
      },
      body: ocrFormData,
    });

    if (!ocrResponse.ok) {
      const error = await ocrResponse.text();
      throw new Error(`Mistral OCR error: ${error}`);
    }

    const ocrData = await ocrResponse.json();
    const fullMarkdown = ocrData.pages.map((p: any) => p.markdown).join("\n\n");

    // 2. Chunking
    const paragraphs = fullMarkdown.split(/\n\n+/);
    const chunks: string[] = [];
    let currentChunk = "";
    for (const p of paragraphs) {
      if ((currentChunk + p).length > 1000) {
        if (currentChunk) chunks.push(currentChunk);
        currentChunk = p;
      } else {
        currentChunk += (currentChunk ? "\n\n" : "") + p;
      }
    }
    if (currentChunk) chunks.push(currentChunk);

    console.log(`Document chunked into ${chunks.length} sections.`);

    // 3. Generate Embeddings & Store
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    for (const chunk of chunks) {
      const embedResponse = await fetch("https://api.mistral.ai/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${MISTRAL_API_KEY}`,
        },
        body: JSON.stringify({
          model: "mistral-embed",
          input: [chunk],
        }),
      });

      if (!embedResponse.ok) throw new Error("Embedding failed");
      const { data } = await embedResponse.json();
      const embedding = data[0].embedding;

      const { error: insertError } = await supabase.from("documents").insert({
        content: chunk,
        embedding: embedding,
        file_id: file_id,
        metadata: {
          title,
          category,
          source: file.name,
        },
      });

      if (insertError) throw insertError;
    }

    return new Response(JSON.stringify({ success: true, chunks: chunks.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in process-pdf:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
