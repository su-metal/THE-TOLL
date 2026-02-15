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
    const deviceId = typeof body.device_id === "string" ? body.device_id.trim() : "";
    const planRaw = typeof body.plan === "string" ? body.plan.toLowerCase() : "yearly";
    const currencyRaw = typeof body.currency === "string" ? body.currency.toLowerCase() : "usd";
    const langRaw = typeof body.lang === "string" ? body.lang.toLowerCase() : "en";
    const sourceRaw = typeof body.source === "string" ? body.source.toLowerCase() : "app";

    if (!deviceId) throw new Error("Missing device_id");

    const plan = planRaw === "monthly" ? "monthly" : "yearly";
    const currency = currencyRaw === "jpy" ? "jpy" : "usd";
    const lang = langRaw === "ja" ? "ja" : "en";
    const source = sourceRaw === "extension" ? "extension" : "app";
    const envKey = `STRIPE_PRICE_ID_${currency.toUpperCase()}_${plan.toUpperCase()}`;
    const priceId = Deno.env.get(envKey);
    if (!priceId) throw new Error(`Missing secret: ${envKey}`);

    const { data: linkRow, error: linkError } = await supabase
      .from("device_links")
      .select("user_id")
      .eq("device_id", deviceId)
      .single();
    if (linkError || !linkRow?.user_id) {
      throw new Error("Device is not linked to an account");
    }

    const userId = linkRow.user_id;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", userId)
      .single();
    if (profileError) {
      throw new Error(`Profile fetch failed: ${profileError.message}`);
    }

    let customerId = profile?.stripe_customer_id || null;

    if (!customerId) {
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
      if (userError || !userData?.user?.email) {
        throw new Error("Failed to resolve account email");
      }
      const customer = await stripe.customers.create({
        email: userData.user.email,
        metadata: { supabase_user_id: userId, device_id: deviceId },
      });
      customerId = customer.id;

      await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", userId);
    }

    const appUrl = Deno.env.get("PUBLIC_APP_URL") || "https://smartphone-app-pi.vercel.app";
    const returnParams = new URLSearchParams({
      device: deviceId,
      lang,
      source,
    });
    const successUrl = `${appUrl}/billing-return.html?${returnParams.toString()}&checkout=success`;
    const cancelUrl = `${appUrl}/billing-return.html?${returnParams.toString()}&checkout=cancel`;

    const existingSubs = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 20,
    });
    const hasActiveLikeSub = existingSubs.data.some((sub) =>
      ["active", "trialing", "past_due", "unpaid"].includes(sub.status)
    );
    if (hasActiveLikeSub) {
      const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${appUrl}/billing-return.html?${returnParams.toString()}&portal=return`,
      });
      return new Response(JSON.stringify({
        url: portal.url,
        mode: "portal",
        reason: "already_subscribed",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      metadata: {
        plan,
        currency,
        supabase_user_id: userId,
        device_id: deviceId,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
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
