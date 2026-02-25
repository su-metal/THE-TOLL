import { serve } from "std/http/server";
import Stripe from "stripe";
import { createClient } from "supabase";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function inferCurrencyFromGeo(req: Request): "jpy" | "usd" | null {
  const candidates = [
    req.headers.get("cf-ipcountry"),
    req.headers.get("x-vercel-ip-country"),
    req.headers.get("x-country-code"),
  ].map((v) => (v || "").trim().toUpperCase());
  if (candidates.includes("JP")) return "jpy";
  if (candidates.some((c) => c && c !== "JP")) return "usd";
  return null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const planRaw = typeof body.plan === "string" ? body.plan.toLowerCase() : "yearly";
    const currencyRaw = typeof body.currency === "string" ? body.currency.toLowerCase() : "";
    const langRaw = typeof body.lang === "string" ? body.lang.toLowerCase() : "en";
    const sourceRaw = typeof body.source === "string" ? body.source.toLowerCase() : "app";
    const deviceRaw = typeof body.device_id === "string" ? body.device_id.trim() : "";

    const plan = planRaw === "monthly" ? "monthly" : "yearly";
    const lang = langRaw === "ja" ? "ja" : "en";
    const source = sourceRaw === "extension" ? "extension" : "app";

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Invalid token");

    const userEmail = user.email;

    // Get or create Stripe customer
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id,billing_currency")
      .eq("id", user.id)
      .single();

    let customerId = profile?.stripe_customer_id;
    const lockedCurrency = profile?.billing_currency === "jpy" || profile?.billing_currency === "usd"
      ? profile.billing_currency
      : null;
    const requestedCurrency = currencyRaw === "jpy" || currencyRaw === "usd" ? currencyRaw : null;
    const geoCurrency = inferCurrencyFromGeo(req);
    const langCurrency = langRaw === "ja" ? "jpy" : "usd";
    const currency = lockedCurrency || requestedCurrency || geoCurrency || langCurrency || "usd";
    const envKey = `STRIPE_PRICE_ID_${currency.toUpperCase()}_${plan.toUpperCase()}`;
    const legacyEnvKey = `STRIPE_PRICE_ID_${plan.toUpperCase()}`;
    const priceId = Deno.env.get(envKey) || Deno.env.get(legacyEnvKey);
    if (!priceId) throw new Error(`Missing secret: ${envKey} (or ${legacyEnvKey})`);

    const createStripeCustomer = async () => {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: { supabase_user_id: user.id, billing_currency: currency },
      });
      customerId = customer.id;
      await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId, billing_currency: currency })
        .eq("id", user.id);
    };

    if (customerId) {
      try {
        await stripe.customers.retrieve(customerId);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes("No such customer")) throw e;
        await createStripeCustomer();
      }
    } else {
      await createStripeCustomer();
    }

    if (!customerId) {
      throw new Error("Failed to create Stripe customer");
    }

    if (!lockedCurrency) {
      await supabase
        .from("profiles")
        .update({ billing_currency: currency })
        .eq("id", user.id);
    }

    const origin = req.headers.get("origin") || "";
    const appUrl = /^https?:\/\//.test(origin)
      ? origin
      : (Deno.env.get("PUBLIC_APP_URL") || "https://smartphone-app-pi.vercel.app");
    const returnBase = source === "extension"
      ? `${appUrl}/pricing.html`
      : `${appUrl}/billing-return.html`;
    const returnParams = new URLSearchParams({
      lang,
      source,
    });
    if (deviceRaw) returnParams.set("device", deviceRaw);
    const successUrl = `${returnBase}?${returnParams.toString()}&checkout=success`;
    const cancelUrl = `${returnBase}?${returnParams.toString()}&checkout=cancel`;

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
        return_url: `${returnBase}?${returnParams.toString()}&portal=return`,
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

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      metadata: {
        plan,
        currency,
        supabase_user_id: user.id,
      },
      allow_promotion_codes: true,
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
