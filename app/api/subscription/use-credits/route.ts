import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const taskCosts: Record<string, number> = {
  PDF_DOCUMENT: 20,
  CSV_EXCEL: 20,
  QA_ONLY: 35,
  CODING: 40,
  API_DATA: 60,
};

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

async function findActiveSubscription(email: string) {
  const customers = await stripeRequest(
    `/v1/customers?email=${encodeURIComponent(email)}&limit=10`
  );

  for (const customer of customers?.data || []) {
    const subscriptions = await stripeRequest(
      `/v1/subscriptions?customer=${encodeURIComponent(customer.id)}&status=all&limit=10`
    );

    const active = (subscriptions?.data || []).find((subscription: any) =>
      ["active", "trialing"].includes(String(subscription.status))
    );

    if (active) return active;
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = String(body?.email || "").trim().toLowerCase();
    const taskType = String(body?.task_type || "").trim().toUpperCase();
    const jobId = String(body?.job_id || "").trim();

    if (!email || !taskType || !jobId) {
      return NextResponse.json(
        { error: "email, task_type and job_id are required." },
        { status: 400 }
      );
    }

    const cost = taskCosts[taskType];
    if (!cost) {
      return NextResponse.json(
        { error: "This task type does not have a fixed credit cost.", pay_as_you_go: true },
        { status: 400 }
      );
    }

    const subscription = await findActiveSubscription(email);

    if (!subscription) {
      return NextResponse.json({
        covered_by_subscription: false,
        reason: "no_active_subscription",
        pay_as_you_go: true,
        credit_cost: cost,
      });
    }

    const lastJobId = String(subscription.metadata?.last_credit_job_id || "");
    const lastJobCost = Number(subscription.metadata?.last_credit_job_cost || 0);

    if (lastJobId === jobId) {
      return NextResponse.json({
        covered_by_subscription: true,
        duplicate: true,
        subscription_id: subscription.id,
        plan: subscription.metadata?.timeease_plan || null,
        credit_cost: lastJobCost || cost,
        credits_remaining: Number(subscription.metadata?.credits_remaining || 0),
      });
    }

    const remaining = Number(subscription.metadata?.credits_remaining || 0);

    if (remaining < cost) {
      return NextResponse.json({
        covered_by_subscription: false,
        reason: "insufficient_credits",
        pay_as_you_go: true,
        subscription_id: subscription.id,
        plan: subscription.metadata?.timeease_plan || null,
        credit_cost: cost,
        credits_remaining: remaining,
      });
    }

    const newBalance = remaining - cost;
    const form = new URLSearchParams();
    form.set("metadata[credits_remaining]", String(newBalance));
    form.set("metadata[last_credit_job_id]", jobId);
    form.set("metadata[last_credit_job_cost]", String(cost));
    form.set("metadata[last_credit_used_at]", new Date().toISOString());

    await stripeRequest(`/v1/subscriptions/${subscription.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });

    return NextResponse.json({
      covered_by_subscription: true,
      duplicate: false,
      subscription_id: subscription.id,
      plan: subscription.metadata?.timeease_plan || null,
      credit_cost: cost,
      credits_remaining: newBalance,
    });
  } catch (error) {
    console.error("TimeEase use-credits error:", error);
    return NextResponse.json(
      { error: "Unable to apply subscription credits." },
      { status: 500 }
    );
  }
}
