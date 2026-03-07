import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

Deno.serve(async (req) => {
  try {
    // 1. WARNING: J+13 Days of inactivity
    // Find open threads where last_activity_at is between 13 and 14 days ago and no warning sent yet
    const warningThreshold = new Date();
    warningThreshold.setDate(warningThreshold.getDate() - 13);
    
    const { data: threadsToWarn } = await supabase
      .from("direct_messages")
      .select("*, sender:sender_id(first_name), recipient:recipient_id(first_name)")
      .eq("is_resolved", false)
      .lt("last_activity_at", warningThreshold.toISOString())
      // We could use a metadata flag to avoid double warning
      .is("metadata->warning_sent", null);

    if (threadsToWarn) {
      for (const thread of threadsToWarn) {
        // Insert System Message
        await supabase.from("direct_messages").insert({
          sender_id: thread.recipient_id, // System message masquerading or use a system ID
          recipient_id: thread.sender_id,
          content: "Cette discussion est inactive. Sans réponse de votre part, elle sera clôturée automatiquement dans 2 jours.",
          procedure_id: thread.procedure_id,
          metadata: { is_system: true }
        });

        // Insert Notification in Activity Feed (notes table)
        await supabase.from("notes").insert({
          user_id: thread.sender_id,
          title: "Discussion inactive",
          content: `Votre discussion sur "${thread.procedure?.title || 'la procédure'}" va bientôt être clôturée.`,
          tags: ["système", "rappel"],
          status: "public"
        });

        // Mark as warned
        await supabase.from("direct_messages")
          .update({ metadata: { ...thread.metadata, warning_sent: true } })
          .eq("id", thread.id);
      }
    }

    // 2. CLOSURE: J+15 Days of inactivity
    const closureThreshold = new Date();
    closureThreshold.setDate(closureThreshold.getDate() - 15);

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
