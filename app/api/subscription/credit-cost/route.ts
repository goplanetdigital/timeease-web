import { NextRequest, NextResponse } from "next/server";

const taskCosts: Record<string, number> = {
  PDF_DOCUMENT: 20,
  CSV_EXCEL: 20,
  QA_ONLY: 35,
  CODING: 40,
  API_DATA: 60,
};

export async function GET(request: NextRequest) {
  const taskType = String(
    request.nextUrl.searchParams.get("task_type") || ""
  ).toUpperCase();

  const credits = taskCosts[taskType];

  if (!credits) {
    return NextResponse.json(
      { fixed_credit_cost: false, task_type: taskType || null },
      { status: 404 }
    );
  }

  return NextResponse.json({
    fixed_credit_cost: true,
    task_type: taskType,
    credits,
  });
}
