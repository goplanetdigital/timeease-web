import { NextRequest, NextResponse } from "next/server";

async function stripeGet(path: string) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");

  const response = await fetch(`https://api.stripe.com${path}`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || "Stripe request failed");
  return data;
}

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email")?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  try {
    const customers = await stripeGet(
      `/v1/customers?email=${encodeURIComponent(email)}&limit=10`
    );

    for (const customer of customers?.data || []) {
      const subscriptions = await stripeGet(
        `/v1/subscriptions?customer=${encodeURIComponent(customer.id)}&status=all&limit=10`
      );

      const active = (subscriptions?.data || []).find((subscription: any) =>
        ["active", "trialing", "past_due"].includes(String(subscription.status))
      );

      if (!active) continue;

      return NextResponse.json({
        active: ["active", "trialing"].includes(String(active.status)),
        status: active.status,
        plan: active.metadata?.timeease_plan || null,
        credits_allowance: Number(active.metadata?.credits_allowance || 0),
        credits_remaining: Number(active.metadata?.credits_remaining || 0),
        current_period_end: active.current_period_end || null,
        subscription_id: active.id,
      });
    }

    return NextResponse.json({
      active: false,
      status: "none",
      plan: null,
      credits_allowance: 0,
      credits_remaining: 0,
    });
  } catch (error) {
    console.error("TimeEase subscription status error:", error);
    return NextResponse.json({ error: "Unable to check subscription." }, { status: 500 });
  }
}
