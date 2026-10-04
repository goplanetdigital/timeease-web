import { NextRequest, NextResponse } from "next/server";

const stripeApi = "https://api.stripe.com/v1/checkout/sessions";

const planConfig = {
  starter: {
    priceId: process.env.STRIPE_PRICE_STARTER,
    label: "Starter",
  },
  business: {
    priceId: process.env.STRIPE_PRICE_BUSINESS,
    label: "Business",
  },
  pro: {
    priceId: process.env.STRIPE_PRICE_PRO,
    label: "Pro",
  },
} as const;

type PlanKey = keyof typeof planConfig;

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const rawPlan = String(formData.get("plan") || "").toLowerCase();
  const plan = rawPlan as PlanKey;
  const selected = planConfig[plan];

  if (!selected) {
    return NextResponse.json({ error: "Invalid subscription plan." }, { status: 400 });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey || !selected.priceId) {
    return NextResponse.json(
      { error: "Subscription checkout is not configured yet." },
      { status: 503 }
    );
  }

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    request.nextUrl.origin ||
    "https://timeease-ruby.vercel.app";

  const body = new URLSearchParams();
  body.set("mode", "subscription");
  body.set("line_items[0][price]", selected.priceId);
  body.set("line_items[0][quantity]", "1");
  body.set("success_url", `${origin}/subscription-success?session_id={CHECKOUT_SESSION_ID}`);
  body.set("cancel_url", `${origin}/pricing`);
  body.set("allow_promotion_codes", "true");
  body.set("billing_address_collection", "auto");
  body.set("metadata[timeease_plan]", plan);

  const response = await fetch(stripeApi, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok || !data?.url) {
    return NextResponse.json(
      { error: data?.error?.message || "Unable to create subscription checkout." },
      { status: 502 }
    );
  }

  return NextResponse.redirect(data.url, 303);
}
