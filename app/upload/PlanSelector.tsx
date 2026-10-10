"use client";

import { useMemo, useState } from "react";

const checkoutLinks = {
  Basic: "https://bvzw62-1t.myshopify.com/cart/51269543428343:1?checkout",
  Complex: "https://bvzw62-1t.myshopify.com/cart/51291397423351:1?checkout",
  Batch: "https://bvzw62-1t.myshopify.com/cart/51291397456119:1?checkout",
} as const;

type Plan = keyof typeof checkoutLinks;

export default function PlanSelector() {
  const [fileCount, setFileCount] = useState<"one" | "multiple">("one");
  const [complex, setComplex] = useState<"no" | "yes">("no");

  const plan = useMemo<Plan>(() => {
    if (fileCount === "multiple") return "Batch";
    if (complex === "yes") return "Complex";
    return "Basic";
  }, [fileCount, complex]);

  const details = {
    Basic: {
      price: "US$9",
      reason: "One simple file with a clear, straightforward layout.",
    },
    Complex: {
      price: "US$39",
      reason: "One file with multiple pages, multiple tables, or a complex layout.",
    },
    Batch: {
      price: "US$99",
      reason: "Multiple files processed together.",
    },
  }[plan];

  return (
    <section className="plan-checker">
      <div className="eyebrow">Choose the right plan</div>
      <h2>Answer 2 quick questions.</h2>

      <div className="plan-question">
        <strong>How many files are you sending?</strong>
        <div className="choice-row">
          <button
            type="button"
            className={fileCount === "one" ? "choice active" : "choice"}
            onClick={() => setFileCount("one")}
          >
            1 file
          </button>
          <button
            type="button"
            className={fileCount === "multiple" ? "choice active" : "choice"}
            onClick={() => setFileCount("multiple")}
          >
            Multiple files
          </button>
        </div>
      </div>

      {fileCount === "one" && (
        <div className="plan-question">
          <strong>Is it multi-page, multi-table, or complex in format?</strong>
          <div className="choice-row">
            <button
              type="button"
              className={complex === "no" ? "choice active" : "choice"}
              onClick={() => setComplex("no")}
            >
              No, it is simple
            </button>
            <button
              type="button"
              className={complex === "yes" ? "choice active" : "choice"}
              onClick={() => setComplex("yes")}
            >
              Yes
            </button>
          </div>
        </div>
      )}

      <div className="plan-result">
        <div>
          <span className="card-kicker">Recommended</span>
          <h2>{plan} · {details.price}</h2>
          <p>{details.reason}</p>
        </div>
        <a className="button primary" href={checkoutLinks[plan]}>
          Continue with {plan} →
        </a>
      </div>

      <p className="note">
        TimeEase also checks the uploaded job. If the selected level does not match the work required,
        the job will be flagged before processing.
      </p>
    </section>
  );
}
