"use client";

import { useEffect, useState } from "react";

type JobStatus = {
  job_id?: string;
  job_status?: string;
  payment_status?: string;
  file_url?: string;
};

export default function StatusClient({ jobId }: { jobId: string }) {
  const [data, setData] = useState<JobStatus | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!jobId) return;

    let stopped = false;

    async function checkStatus() {
      try {
        const response = await fetch(
          "https://206-189-36-241.sslip.io/webhook/timeease-result-status?job_id=" +
            encodeURIComponent(jobId),
          { cache: "no-store" }
        );

        if (!response.ok) throw new Error("status request failed");
        const result = await response.json();

        if (!stopped) {
          setData(result);
          setError("");
        }
      } catch {
        if (!stopped) setError("Checking status…");
      }
    }

    checkStatus();
    const timer = window.setInterval(checkStatus, 5000);

    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [jobId]);

  const jobStatus = String(data?.job_status || "").toUpperCase();
  const paymentStatus = String(data?.payment_status || "").toUpperCase();
  const ready =
    jobStatus === "COMPLETED" &&
    paymentStatus === "PAID" &&
    Boolean(data?.file_url);

  return (
    <>
      <div
        style={{
          border: "1px solid #e4e7ec",
          borderRadius: "16px",
          padding: "18px",
          marginBottom: "18px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: "16px" }}>
          <span style={{ color: "#667085" }}>Status</span>
          <strong>{ready ? "Ready to download" : jobStatus || "Processing"}</strong>
        </div>
      </div>

      {ready ? (
        <a
          href={data?.file_url}
          style={{
            display: "flex",
            width: "100%",
            minHeight: "50px",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "14px",
            background: "#111827",
            color: "#ffffff",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Download Result ↓
        </a>
      ) : (
        <button
          disabled
          style={{
            width: "100%",
            minHeight: "50px",
            border: 0,
            borderRadius: "14px",
            background: "#eef0f3",
            color: "#98a2b3",
            fontWeight: 700,
          }}
        >
          Download unlocks when processing is complete
        </button>
      )}

      {error ? (
        <p
          style={{
            margin: "12px 0 0",
            color: "#98a2b3",
            fontSize: "13px",
            textAlign: "center",
          }}
        >
          {error}
        </p>
      ) : null}
    </>
  );
}
