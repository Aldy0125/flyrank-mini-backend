
import { NextResponse } from "next/server";
import { getExecution } from "@/lib/workflow-store";


type RouteContext = {
  params: Promise<{
    executionId: string;
  }>;
};

export async function GET(
  _request: Request,
  { params }: RouteContext
) {
  try {
    const { executionId } = await params;
    const execution = getExecution(executionId);

    if (!execution) {
      return NextResponse.json(
        {
          success: false,
          error: "Execution not found.",
          executionId,
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        execution,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "Failed to retrieve execution:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Failed to retrieve execution.",
      },
      { status: 500 }
    );
  }
}
