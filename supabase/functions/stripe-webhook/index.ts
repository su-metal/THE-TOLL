import { serve } from "std/http/server";
import Stripe from "stripe";
import { createClient } from "supabase";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2022-11-15",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

serve(async (req: Request) => {
  const signature = req.headers.get("stripe-signature");

  try {
    const body = await req.text();
    const event = stripe.webhooks.constructEvent(
      body,
      signature || "",
      Deno.env.get("STRIPE_WEBHOOK_SECRET") || ""
    );

    console.log(`[THE TOLL] Webhook受信: ${event.type}`);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const customerId = session.customer;
      
      await supabase
        .from("profiles")
        .update({ subscription_status: "active" })
        .eq("stripe_customer_id", customerId);
        
      console.log(`[THE TOLL] サブスクリプション有効化: ${customerId}`);
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      const customerId = subscription.customer;

      await supabase
        .from("profiles")
        .update({ subscription_status: "inactive" })
        .eq("stripe_customer_id", customerId);

      console.log(`[THE TOLL] サブスクリプション無効化: ${customerId}`);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[THE TOLL] Webhookエラー: ${message}`);
    return new Response(`Webhook Error: ${message}`, { status: 400 });
  }
});
