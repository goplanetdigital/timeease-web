"use client";

import { FormEvent, useState } from "react";

export default function SupportForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [feedback, setFeedback] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setFeedback("");

    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());

    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) throw new Error(data?.error || "Unable to send your request.");

      event.currentTarget.reset();
      setStatus("sent");
      setFeedback("Your support request has been sent. We’ll reply by email.");
    } catch (error) {
      setStatus("error");
      setFeedback(
        error instanceof Error
          ? error.message
          : "Unable to send your request. Please try again."
      );
    }
  }

  return (
    <form className="support-form" onSubmit={onSubmit}>
      <div className="support-form-grid">
        <label>
          <span>Email</span>
          <input type="email" name="email" autoComplete="email" placeholder="you@example.com" required />
        </label>

        <label>
          <span>Job ID <small>optional</small></span>
          <input type="text" name="jobId" placeholder="e.g. TE-..." />
        </label>
      </div>

      <label>
        <span>Issue type</span>
        <select name="issueType" defaultValue="Result" required>
          <option value="Payment">Payment</option>
          <option value="File">File</option>
          <option value="Result">Result</option>
          <option value="Subscription">Subscription</option>
          <option value="Other">Other</option>
        </select>
      </label>

      <label>
        <span>Message</span>
        <textarea name="message" rows={7} placeholder="Tell us what happened and what you need help with." required />
      </label>

      <div className="support-form-actions">
        <button className="button primary support-submit" type="submit" disabled={status === "sending"}>
          {status === "sending" ? "Sending..." : "Send support request →"}
        </button>
        <span className="support-response" aria-live="polite">{feedback}</span>
      </div>
    </form>
  );
}
