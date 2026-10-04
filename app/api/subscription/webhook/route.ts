import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const planCredits: Record<string, { plan: string; credits: number }> = {};

function getPlanCredits() {
  const map: Record<string, { plan: string; credits: number }> = {};
  if (process.env.STRIPE_PRICE_STARTER) {
    map[process.env.STRIPE_PRICE_STARTER] = { plan: "starter", credits: 60 };
  }
  if (process.env.STRIPE_PRICE_BUSINESS) {
    map[process.env.STRIPE_PRICE_BUSINESS] = { plan: "business", credits: 140 };
  }
  if (process.env.STRIPE_PRICE_PRO) {
    map[process.env.STRIPE_PRICE_PRO] = { plan: "pro", credits: 450 };
  }
  return map;
}

function verifyStripeSignature(payload: string, header: string, secret: string) {
  const parts = header.split(",");
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = parts
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3));

  if (!timestamp || signatures.length === 0) return false;

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");

  return signatures.some((signature) => {
    try {
      const a = Buffer.from(expected, "hex");
      const b = Buffer.from(signature, "hex");
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  });
}

async function stripeRequest(path: string, init?: RequestInit) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");

  const response = await fetch(`https://api.stripe.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || "Stripe request failed");
  }
  return data;
}

async function resetSubscriptionCredits(subscriptionId: string) {
  const subscription = await stripeRequest(`/v1/subscriptions/${subscriptionId}`);
  const priceId = subscription?.items?.data?.[0]?.price?.id;
  const plan = getPlanCredits()[priceId];
  if (!plan) return;

  const body = new URLSearchParams();
  body.set("metadata[timeease_plan]", plan.plan);
  body.set("metadata[credits_allowance]", String(plan.credits));
  body.set("metadata[credits_remaining]", String(plan.credits));
  body.set("metadata[credits_reset_at]", new Date().toISOString());

  await stripeRequest(`/v1/subscriptions/${subscriptionId}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  }

  const payload = await request.text();
  const signature = request.headers.get("stripe-signature") || "";

  if (!verifyStripeSignature(payload, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const event = JSON.parse(payload);
  const object = event?.data?.object;

  try {
    if (event.type === "checkout.session.completed" && object?.mode === "subscription") {
      const subscriptionId =
        typeof object.subscription === "string" ? object.subscription : object.subscription?.id;
      if (subscriptionId) await resetSubscriptionCredits(subscriptionId);
    }

    if (event.type === "invoice.paid") {
      const subscriptionId =
        typeof object?.subscription === "string"
          ? object.subscription
          : object?.subscription?.id ||
            object?.parent?.subscription_details?.subscription;

      if (subscriptionId) await resetSubscriptionCredits(subscriptionId);
    }

    if (event.type === "customer.subscription.deleted" && object?.id) {
      const body = new URLSearchParams();
      body.set("metadata[credits_remaining]", "0");
      body.set("metadata[timeease_plan_status]", "cancelled");

      await stripeRequest(`/v1/subscriptions/${object.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("TimeEase subscription webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
