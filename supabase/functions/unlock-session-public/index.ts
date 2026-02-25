import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const sessionId = typeof body.session_id === "string" ? body.session_id.trim().toUpperCase() : "";

    if (!sessionId) throw new Error("Missing session_id");
    if (!/^[A-Z0-9-]{4,32}$/.test(sessionId)) throw new Error("Invalid session_id");

    const { data, error } = await supabase
      .from("squat_sessions")
      .update({ unlocked: true })
      .eq("id", sessionId)
      .eq("unlocked", false)
      .select("id")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data?.id) {
      return new Response(JSON.stringify({ success: false, reason: "not_found_or_already_unlocked" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ success: true, session_id: data.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ success: false, error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
