import StatusClient from "./status-client";

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ job_id?: string; session_id?: string; subscription?: string }>;
}) {
  const params = await searchParams;
  const jobId = params.job_id || "";
  const usedSubscriptionCredits = params.subscription === "1";

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f7f8fa",
        padding: "24px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "560px",
          background: "#ffffff",
          border: "1px solid #e4e7ec",
          borderRadius: "24px",
          padding: "44px 32px",
          boxShadow: "0 16px 50px rgba(16,24,40,0.08)",
        }}
      >
        <div style={{ fontSize: "42px", marginBottom: "18px" }}>✓</div>

        <div
          style={{
            color: "#667085",
            fontSize: "13px",
            fontWeight: 700,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            marginBottom: "12px",
          }}
        >
          {usedSubscriptionCredits ? "Monthly credits applied" : "Payment confirmed"}
        </div>

        <h1 style={{ fontSize: "34px", margin: "0 0 14px" }}>
          Your task is processing.
        </h1>

        <p
          style={{
            fontSize: "17px",
            lineHeight: 1.65,
            color: "#667085",
            marginBottom: "24px",
          }}
        >
          {usedSubscriptionCredits
            ? "Your monthly credits were applied. TimeEase is preparing the completed result now."
            : "TimeEase has received your payment. Your task is being prepared now."}
        </p>

        {jobId ? (
          <div
            style={{
              background: "#f7f8fa",
              borderRadius: "14px",
              padding: "14px 16px",
              marginBottom: "18px",
              fontSize: "14px",
              color: "#475467",
            }}
          >
            Job ID: <strong>{jobId}</strong>
          </div>
        ) : (
          <div
            style={{
              background: "#fff7ed",
              borderRadius: "14px",
              padding: "14px 16px",
              marginBottom: "18px",
              fontSize: "14px",
              color: "#9a3412",
            }}
          >
            Missing job ID. Your result will still be delivered by email.
          </div>
        )}

        {jobId ? (
          <StatusClient jobId={jobId} />
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
            Download unavailable
          </button>
        )}

        <p
          style={{
            margin: "18px 0 0",
            color: "#98a2b3",
            fontSize: "13px",
            lineHeight: 1.5,
            textAlign: "center",
          }}
        >
          A copy of the completed result will also be sent to your email.
        </p>
      </div>
    </main>
  );
}
