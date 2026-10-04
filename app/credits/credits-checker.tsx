"use client";

import { FormEvent, useState } from "react";

type CreditStatus = {
  active: boolean;
  status: string;
  plan: string | null;
  credits_allowance: number;
  credits_remaining: number;
  current_period_end?: number | null;
};

export default function CreditsChecker() {
  const [result, setResult] = useState<CreditStatus | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setResult(null);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();

    try {
      const response = await fetch(
        "/api/subscription/status?email=" + encodeURIComponent(email),
        { cache: "no-store" }
      );
      const data = await response.json();

      if (!response.ok) throw new Error(data?.error || "Unable to check credits.");

      setResult(data);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to check credits."
      );
    } finally {
      setLoading(false);
    }
  }

  const percent =
    result && result.credits_allowance > 0
      ? Math.max(
          0,
          Math.min(
            100,
            Math.round(
              (result.credits_remaining / result.credits_allowance) * 100
            )
          )
        )
      : 0;

  return (
    <div style={{ display: "grid", gap: 22 }}>
      <form
        onSubmit={onSubmit}
        style={{
          display: "grid",
          gap: 14,
          border: "1px solid #e4e7ec",
          borderRadius: 24,
          background: "#fff",
          padding: 28,
        }}
      >
        <label
          style={{
            display: "grid",
            gap: 8,
            fontWeight: 800,
            color: "#344054",
          }}
        >
          <span>Subscription email</span>
          <input
            type="email"
            name="email"
            placeholder="you@example.com"
            required
            style={{
              width: "100%",
              border: "1px solid #d0d5dd",
              borderRadius: 14,
              padding: "13px 14px",
              font: "inherit",
              outline: "none",
            }}
          />
        </label>

        <button
          className="button primary"
          type="submit"
          disabled={loading}
          style={{
            width: "fit-content",
            border: 0,
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "Checking..." : "Check my credits →"}
        </button>

        {message && (
          <div style={{ color: "#b42318", fontSize: 14, fontWeight: 700 }}>
            {message}
          </div>
        )}
      </form>

      {result &&
        (result.status === "none" ? (
          <section className="card">
            <div className="eyebrow">No active plan found</div>
            <h2>No monthly subscription is linked to this email.</h2>
            <p>
              You can still use TimeEase with pay-as-you-go, or choose a monthly
              plan.
            </p>
          </section>
        ) : (
          <section
            style={{
              border: "1px solid #e4e7ec",
              borderRadius: 24,
              background: "#fff",
              padding: 28,
            }}
          >
            <div className="eyebrow">Your monthly credits</div>
            <h2 style={{ marginBottom: 8 }}>
              {result.credits_remaining} of {result.credits_allowance} credits
              remaining
            </h2>
            <p style={{ marginBottom: 20 }}>
              {result.plan
                ? result.plan.charAt(0).toUpperCase() + result.plan.slice(1)
                : "Monthly"}{" "}
              plan · {result.status === "active" ? "Active" : result.status}
            </p>

            <div
              aria-label="Credit balance"
              style={{
                width: "100%",
                height: 14,
                overflow: "hidden",
                borderRadius: 999,
                background: "#eef2f6",
              }}
            >
              <div
                style={{
                  width: percent + "%",
                  height: "100%",
                  borderRadius: 999,
                  background: "#111827",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
                marginTop: 10,
                color: "#667085",
                fontSize: 13,
                fontWeight: 700,
                flexWrap: "wrap",
              }}
            >
              <span>{percent}% available</span>
              {result.current_period_end ? (
                <span>
                  Resets around{" "}
                  {new Date(
                    result.current_period_end * 1000
                  ).toLocaleDateString()}
                </span>
              ) : null}
            </div>

            <div className="hero-actions" style={{ marginTop: 26 }}>
              <a className="button primary" href="/upload">
                Use credits →
              </a>
              <a className="button secondary" href="/pricing">
                View plans
              </a>
            </div>
          </section>
        ))}
    </div>
  );
}
