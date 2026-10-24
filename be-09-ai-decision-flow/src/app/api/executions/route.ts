
import { NextResponse } from "next/server";
import { listExecutionSummaries } from "@/lib/workflow-store";

export async function GET(request: Request) {
  // Access request-specific data outside try/catch so
  // Next.js can handle prerendering interruptions correctly.
  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");

  let limit = 20;

  if (limitParam !== null) {
    if (!/^\d+$/.test(limitParam)) {
      return NextResponse.json(
        {
          success: false,
          error: "Limit must be a positive integer.",
        },
        { status: 400 }
      );
    }

    limit = Number(limitParam);

    if (!Number.isSafeInteger(limit) || limit < 1) {
      return NextResponse.json(
        {
          success: false,
          error: "Limit must be a positive integer.",
        },
        { status: 400 }
      );
    }
  }

  try {
    const executions = listExecutionSummaries(
      Math.min(limit, 100)
    );

    return NextResponse.json(
      {
        success: true,
        count: executions.length,
        executions,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "Failed to retrieve execution history:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Failed to retrieve execution history.",
      },
      { status: 500 }
    );
  }
}
