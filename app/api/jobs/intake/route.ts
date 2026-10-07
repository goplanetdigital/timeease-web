import { NextRequest, NextResponse } from "next/server";
import { validateJobPayload } from "@/lib/job-contract";

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        status: "NEEDS_CLARIFICATION",
        errors: ["Request body must be valid JSON"],
      },
      { status: 400 }
    );
  }

  const result = validateJobPayload(body);

  if (!result.ok) {
    return NextResponse.json(result, { status: 422 });
  }

  return NextResponse.json(
    {
      ok: true,
      status: result.status,
      job: result.normalized,
      next_action: "dispatch_to_codex_worker",
    },
    { status: 202 }
  );
}
