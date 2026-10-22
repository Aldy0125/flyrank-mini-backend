
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { inngest } from "../../../inngest/client";
import {
  createExecution,
  updateExecution,
} from "../../../lib/workflow-store";

type WorkflowNode = {
  id: string;
  data?: {
    label?: string;
    prompt?: string;
  };
};

type WorkflowEdge = {
  source: string;
  target: string;
  sourceHandle?: string | null;
  label?: string | null;
};

type RequestBody = {
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
  startNodeId?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;

    if (
      !Array.isArray(body.nodes) ||
      body.nodes.length === 0 ||
      !Array.isArray(body.edges)
    ) {
      return NextResponse.json(
        { error: "A valid workflow graph is required." },
        { status: 400 }
      );
    }

    const nodes = body.nodes;
    const edges = body.edges;

    // Validate node IDs and prompts.
    const nodeIds = new Set<string>();

    for (const node of nodes) {
      if (
        !node ||
        typeof node.id !== "string" ||
        !node.id.trim() ||
        nodeIds.has(node.id)
      ) {
        return NextResponse.json(
          { error: "Workflow contains an invalid or duplicate node ID." },
          { status: 400 }
        );
      }

      nodeIds.add(node.id);

      if (
        typeof node.data?.prompt !== "string" ||
        !node.data.prompt.trim()
      ) {
        return NextResponse.json(
          {
            error: `Node ${node.id} needs a valid decision prompt.`,
          },
          { status: 400 }
        );
      }
    }

    // Validate that every edge connects existing nodes.
    for (const edge of edges) {
      if (
        !edge ||
        typeof edge.source !== "string" ||
        typeof edge.target !== "string" ||
        !nodeIds.has(edge.source) ||
        !nodeIds.has(edge.target)
      ) {
        return NextResponse.json(
          { error: "Workflow contains an invalid node connection." },
          { status: 400 }
        );
      }
    }

    // Use the selected start node, or default to the first node.
    const startNodeId =
      typeof body.startNodeId === "string" &&
      nodeIds.has(body.startNodeId)
        ? body.startNodeId
        : nodes[0].id;

    const executionId = randomUUID();

    // Register execution before sending the Inngest event.
    createExecution({
      id: executionId,
      status: "queued",
      logs: [],
      currentNodeId: startNodeId,
      startedAt: new Date().toISOString(),
    });

    try {
      await inngest.send({
        name: "be09/run-workflow",
        data: {
          executionId,
          nodes,
          edges,
          startNodeId,
        },
      });
    } catch (error) {
      console.error("Inngest event error:", error);

      updateExecution(executionId, {
        status: "failed",
        currentNodeId: null,
        error: "Failed to send workflow event to Inngest.",
        completedAt: new Date().toISOString(),
      });

      return NextResponse.json(
        { error: "Could not start the Inngest workflow." },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        executionId,
        status: "queued",
        message: "Workflow submitted to Inngest.",
      },
      { status: 202 }
    );
  } catch (error) {
    console.error("Run workflow API error:", error);

    return NextResponse.json(
      { error: "Invalid request or server error." },
      { status: 500 }
    );
  }
}
