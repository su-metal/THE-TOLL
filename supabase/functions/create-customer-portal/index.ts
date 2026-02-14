import { serve } from "std/http/server";
import Stripe from "stripe";
import { createClient } from "supabase";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) throw new Error("Invalid token");

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    if (profileError) throw new Error(`Profile fetch failed: ${profileError.message}`);

    const customerId = profile?.stripe_customer_id;
    if (!customerId) throw new Error("No Stripe customer found for this account");

    const requestedReturnUrl = typeof body.return_url === "string" ? body.return_url.trim() : "";
    const origin = req.headers.get("origin") || "";
    const appUrl = Deno.env.get("PUBLIC_APP_URL") || "https://smartphone-app-pi.vercel.app";
    const returnUrl = /^https?:\/\//.test(requestedReturnUrl)
      ? requestedReturnUrl
      : (/^https?:\/\//.test(origin) ? `${origin}/?portal=return` : `${appUrl}/?portal=return`);

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
