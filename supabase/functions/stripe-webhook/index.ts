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

type EntitlementOptions = {
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: string | null;
};

function toIsoFromUnix(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return new Date(value * 1000).toISOString();
}

function resolvePeriodEndIso(subscription: Record<string, unknown>): string | null {
  const topLevel = toIsoFromUnix(subscription.current_period_end);
  if (topLevel) return topLevel;

  const cancelAt = toIsoFromUnix(subscription.cancel_at);
  if (cancelAt) return cancelAt;

  const items = subscription.items as { data?: Array<Record<string, unknown>> } | undefined;
  if (!items?.data || !Array.isArray(items.data)) return null;

  let maxTs = 0;
  for (const item of items.data) {
    const ts = typeof item?.current_period_end === "number" ? item.current_period_end : 0;
    if (Number.isFinite(ts) && ts > maxTs) maxTs = ts;
  }
  return toIsoFromUnix(maxTs);
}

async function applyEntitlementForCustomer(
  customerId: string,
  status: "active" | "inactive",
  options: EntitlementOptions = {},
) {
  const planTier = status === "active" ? "pro" : "free";
  const now = new Date().toISOString();
  const cancelAtPeriodEnd = options.cancelAtPeriodEnd === true;
  const currentPeriodEnd = options.currentPeriodEnd || null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (profileError || !profile?.id) {
    throw new Error(`Profile lookup failed for customer ${customerId}`);
  }

  const userId = profile.id;

  const { error: profileUpdateError } = await supabase
    .from("profiles")
    .update({
      subscription_status: status,
      plan_tier: planTier,
      trial_ends_at: null,
      trial_used: true,
      cancel_at_period_end: cancelAtPeriodEnd,
      current_period_end: currentPeriodEnd,
    })
    .eq("id", userId);

  if (profileUpdateError) {
    throw new Error(`Profile update failed for ${customerId}: ${profileUpdateError.message}`);
  }

  const { error: deviceUpdateError } = await supabase
    .from("device_links")
    .update({
      subscription_status: status,
      plan_tier: planTier,
      trial_ends_at: null,
      cancel_at_period_end: cancelAtPeriodEnd,
      current_period_end: currentPeriodEnd,
      updated_at: now,
      last_seen_at: now,
    })
    .eq("user_id", userId);

  if (deviceUpdateError) {
    throw new Error(`Device links update failed for ${customerId}: ${deviceUpdateError.message}`);
  }
}

serve(async (req: Request) => {
  const signature = req.headers.get("stripe-signature");

  try {
    const body = await req.text();
    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature || "",
      Deno.env.get("STRIPE_WEBHOOK_SECRET") || "",
      undefined,
      Stripe.createSubtleCryptoProvider()
    );

    console.log(`[THE TOLL] Webhook受信: ${event.type}`);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const customerId = typeof session.customer === "string" ? session.customer : "";
      if (!customerId) throw new Error("Missing customer id in checkout.session.completed");
      let periodEnd: string | null = null;
      if (typeof session.subscription === "string" && session.subscription) {
        const sub = await stripe.subscriptions.retrieve(session.subscription);
        if (typeof sub.current_period_end === "number") {
          periodEnd = new Date(sub.current_period_end * 1000).toISOString();
        }
      }

      await applyEntitlementForCustomer(customerId, "active", {
        cancelAtPeriodEnd: false,
        currentPeriodEnd: periodEnd,
      });

      console.log(`[THE TOLL] サブスクリプション有効化: ${customerId}`);
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as unknown as Record<string, unknown>;
      const customerId = typeof subscription.customer === "string" ? subscription.customer : "";
      if (!customerId) throw new Error("Missing customer id in customer.subscription.deleted");
      const periodEnd = resolvePeriodEndIso(subscription);

      await applyEntitlementForCustomer(customerId, "inactive", {
        cancelAtPeriodEnd: false,
        currentPeriodEnd: periodEnd,
      });

      console.log(`[THE TOLL] サブスクリプション無効化: ${customerId}`);
    }

    if (event.type === "customer.subscription.updated") {
      const subscription = event.data.object as unknown as Record<string, unknown>;
      const customerId = typeof subscription.customer === "string" ? subscription.customer : "";
      const status = String(subscription.status || "").toLowerCase();
      const isActiveLike = ["active", "trialing", "past_due"].includes(status);
      if (!customerId) throw new Error("Missing customer id in customer.subscription.updated");
      const periodEnd = resolvePeriodEndIso(subscription);
      const cancelAtPeriodEnd = subscription.cancel_at_period_end === true;

      await applyEntitlementForCustomer(customerId, isActiveLike ? "active" : "inactive", {
        cancelAtPeriodEnd: isActiveLike ? cancelAtPeriodEnd : false,
        currentPeriodEnd: periodEnd,
      });

      console.log(`[THE TOLL] サブスクリプション状態更新: ${customerId} => ${status}`);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[THE TOLL] Webhookエラー: ${message}`);
    return new Response(`Webhook Error: ${message}`, { status: 400 });
  }
});
