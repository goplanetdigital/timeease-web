import { NextResponse } from "next/server";

function clean(value: unknown, max = 5000) {
  return String(value ?? "").trim().slice(0, max);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = clean(body.email, 320);
    const jobId = clean(body.jobId, 120);
    const issueType = clean(body.issueType, 80);
    const message = clean(body.message, 5000);

    if (!email || !issueType || !message || !email.includes("@")) {
      return NextResponse.json({ error: "Please complete the required fields." }, { status: 400 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    const supportTo = process.env.SUPPORT_TO_EMAIL;
    const supportFrom = process.env.SUPPORT_FROM_EMAIL;

    if (!apiKey || !supportTo || !supportFrom) {
      return NextResponse.json(
        { error: "Support messaging is being connected. Please reply to your latest TimeEase email for now." },
        { status: 503 }
      );
    }

    const subject = `[TimeEase Support] ${issueType}${jobId ? ` · ${jobId}` : ""}`;
    const text = [
      "New TimeEase support request",
      "",
      `Customer email: ${email}`,
      `Job ID: ${jobId || "Not provided"}`,
      `Issue type: ${issueType}`,
      "",
      "Message:",
      message,
    ].join("\n");

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: supportFrom,
        to: [supportTo],
        reply_to: email,
        subject,
        text,
      }),
    });

    if (!response.ok) {
      console.error("Support email failed", response.status);
      return NextResponse.json(
        { error: "Unable to send your request right now. Please reply to your latest TimeEase email." },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Support request error", error);
    return NextResponse.json({ error: "Unable to send your request right now. Please try again." }, { status: 500 });
  }
}
