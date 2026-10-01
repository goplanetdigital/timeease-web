export default function PaymentSuccessPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f7f7f5",
        padding: "24px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "520px",
          background: "#ffffff",
          borderRadius: "24px",
          padding: "48px 32px",
          textAlign: "center",
          boxShadow: "0 12px 40px rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ fontSize: "52px", marginBottom: "18px" }}>✓</div>

        <h1 style={{ fontSize: "30px", margin: "0 0 14px" }}>
          Payment Successful
        </h1>

        <p
          style={{
            fontSize: "17px",
            lineHeight: 1.6,
            color: "#555",
            marginBottom: "12px",
          }}
        >
          Your document has been received and processing has started.
        </p>

        <p
          style={{
            fontSize: "15px",
            lineHeight: 1.6,
            color: "#777",
            marginBottom: "28px",
          }}
        >
          Your completed Excel or CSV file will be sent automatically to your
          email when it is ready.
        </p>

        <div
          style={{
            background: "#f3f4f6",
            borderRadius: "14px",
            padding: "16px",
            fontSize: "14px",
            color: "#555",
          }}
        >
          You may close this page now.
        </div>

        <div style={{ marginTop: "30px", fontSize: "13px", color: "#999" }}>
          TimeEase
        </div>
      </div>
    </main>
  );
}
