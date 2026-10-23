import { NextResponse } from "next/server";
import { getExecution } from "../../../../lib/workflow-store";

type RouteContext = {
  params: Promise<{
    executionId: string;
  }>;
};

export async function GET(
  _request: Request,
  context: RouteContext
) {
  try {
    const { executionId } = await context.params;

    if (!executionId?.trim()) {
      return NextResponse.json(
        { error: "Execution ID is required." },
        { status: 400 }
      );
    }

    const execution = getExecution(executionId);

    if (!execution) {
      return NextResponse.json(
        {
          error: "Execution not found.",
          executionId,
        },
        {
          status: 404,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        execution,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Get execution API error:", error);

    return NextResponse.json(
      { error: "Could not retrieve workflow execution." },
      { status: 500 }
    );
  }
}