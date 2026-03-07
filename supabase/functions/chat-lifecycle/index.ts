import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

Deno.serve(async (req) => {
  try {
    const now = new Date();
    
    // 1. WARNING: J+13 Days of inactivity
    const warningThreshold = new Date();
    warningThreshold.setDate(now.getDate() - 13);
    
    // Find the latest message for each open thread that hasn't been warned
    // We'll use a RPC or a clever query if possible, but let's stay simple with a select
    // and filter in JS if needed, or better, query messages older than 13 days 
    // where no newer message exists in that same thread.
    const { data: messagesToWarn, error: warnError } = await supabase
      .from("direct_messages")
      .select("*, procedure:procedure_id(title)")
      .eq("is_resolved", false)
      .lt("last_activity_at", warningThreshold.toISOString())
      .is("metadata->warning_sent", null);

    if (warnError) throw warnError;

    if (messagesToWarn && messagesToWarn.length > 0) {
      // Group by thread (sender/recipient/procedure) to avoid spam
      const uniqueThreads = new Map();
      messagesToWarn.forEach(m => {
        const key = [m.sender_id, m.recipient_id, m.procedure_id].sort().join(':');
        if (!uniqueThreads.has(key)) uniqueThreads.set(key, m);
      });

      for (const thread of uniqueThreads.values()) {
        // Insert System Message
        await supabase.from("direct_messages").insert({
          sender_id: thread.recipient_id,
          recipient_id: thread.sender_id,
          content: "Cette discussion est inactive. Sans réponse de votre part, elle sera clôturée automatiquement dans 2 jours.",
          procedure_id: thread.procedure_id,
          last_activity_at: now.toISOString(),
          metadata: { is_system: true }
        });

        // Insert Notification in Activity Feed for the "other" person (technically both should know)
        // Usually, it's the technician who needs the nudge
        await supabase.from("notes").insert({
          user_id: thread.sender_id,
          title: "Discussion inactive",
          content: `Votre discussion sur "${thread.procedure?.title || 'une procédure'}" va bientôt être clôturée.`,
          tags: ["système", "rappel"],
          status: "public"
        });

        // Mark ALL messages in this thread as warned to avoid repeat warns
        await supabase.from("direct_messages")
          .update({ metadata: { warning_sent: true } })
          .eq("is_resolved", false)
          .or(`and(sender_id.eq.${thread.sender_id},recipient_id.eq.${thread.recipient_id}),and(sender_id.eq.${thread.recipient_id},recipient_id.eq.${thread.sender_id})`)
          .eq(thread.procedure_id ? 'procedure_id' : 'procedure_id', thread.procedure_id);
      }
    }

    // 2. CLOSURE: J+15 Days of inactivity
    const closureThreshold = new Date();
    closureThreshold.setDate(now.getDate() - 15);

    const { error: closureError } = await supabase
      .from("direct_messages")
      .update({ is_resolved: true })
      .eq("is_resolved", false)
      .lt("last_activity_at", closureThreshold.toISOString());

    if (closureError) throw closureError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
