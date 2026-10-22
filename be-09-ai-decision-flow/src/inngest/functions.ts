
import { inngest } from "./client";
import { getAIDecision } from "../lib/ai-decision";
import {
  appendExecutionLog,
  updateExecution,
  type WorkflowLog,
} from "../lib/workflow-store";

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

type RunWorkflowEvent = {
  executionId: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  startNodeId: string;
};

// Mempertahankan workflow tes koneksi Inngest.
export const testWorkflow = inngest.createFunction(
  {
    id: "be09-test-workflow",
    triggers: {
      event: "be09/test",
    },
  },
  async ({ event, step }) => {
    const result = await step.run("confirm-setup", async () => {
      return {
        ok: true,
        message: "Inngest is connected to BE-09",
        payload: event.data,
      };
    });

    return result;
  }
);

// Menentukan koneksi berikutnya berdasarkan hasil YES atau NO.
function getNextEdge(
  edges: WorkflowEdge[],
  nodeId: string,
  decision: "YES" | "NO"
): WorkflowEdge | null {
  const outgoingEdges = edges.filter(
    (edge) => edge.source === nodeId
  );

  // Node tanpa koneksi keluar merupakan node akhir.
  if (outgoingEdges.length === 0) {
    return null;
  }

  const matchingEdge = outgoingEdges.find((edge) => {
    const marker = [
      edge.sourceHandle ?? "",
      edge.label ?? "",
    ]
      .join(" ")
      .toLowerCase();

    const tokens = marker.split(/[^a-z0-9]+/);

    if (decision === "YES") {
      return tokens.includes("yes") || tokens.includes("true");
    }

    return tokens.includes("no") || tokens.includes("false");
  });

  if (matchingEdge) {
    return matchingEdge;
  }

  // Mendukung koneksi tunggal tanpa label atau sourceHandle.
  if (
    outgoingEdges.length === 1 &&
    !outgoingEdges[0].sourceHandle &&
    !outgoingEdges[0].label
  ) {
    return outgoingEdges[0];
  }

  throw new Error(
    `Node "${nodeId}" has no matching ${decision} branch. ` +
      'Check the edge sourceHandle or label. Use "yes" or "no".'
  );
}

// Fungsi utama eksekusi workflow BE-09.
export const runWorkflow = inngest.createFunction(
  {
    id: "be09-run-workflow",
    triggers: {
      event: "be09/run-workflow",
    },
  },
  async ({ event, step }) => {
    const payload = event.data as RunWorkflowEvent;

    const executionId = payload?.executionId;

    let currentNodeId: string | null =
      payload?.startNodeId ?? null;

    const visitedNodeIds = new Set<string>();

    try {
      // Validasi payload event.
      if (
        !payload ||
        typeof executionId !== "string" ||
        !executionId ||
        !Array.isArray(payload.nodes) ||
        payload.nodes.length === 0 ||
        !Array.isArray(payload.edges)
      ) {
        throw new Error("Invalid workflow event payload.");
      }

      const { nodes, edges } = payload;

      // Validasi node dan prompt.
      const nodeMap = new Map<string, WorkflowNode>();

      for (const node of nodes) {
        if (
          !node ||
          typeof node.id !== "string" ||
          !node.id.trim() ||
          nodeMap.has(node.id)
        ) {
          throw new Error(
            "Workflow contains an invalid or duplicate node ID."
          );
        }

        if (
          typeof node.data?.prompt !== "string" ||
          !node.data.prompt.trim()
        ) {
          throw new Error(
            `Node "${node.id}" needs a valid decision prompt.`
          );
        }

        nodeMap.set(node.id, node);
      }

      // Pastikan semua koneksi mengarah ke node yang tersedia.
      for (const edge of edges) {
        if (
          !edge ||
          typeof edge.source !== "string" ||
          typeof edge.target !== "string" ||
          !nodeMap.has(edge.source) ||
          !nodeMap.has(edge.target)
        ) {
          throw new Error(
            "Workflow contains an invalid node connection."
          );
        }
      }

      // Gunakan startNodeId jika valid.
      // Jika tidak, mulai dari node pertama.
      currentNodeId =
        typeof payload.startNodeId === "string" &&
        nodeMap.has(payload.startNodeId)
          ? payload.startNodeId
          : nodes[0].id;

      updateExecution(executionId, {
        status: "running",
        currentNodeId,
        error: undefined,
        completedAt: undefined,
      });

      // Batasi jumlah node untuk mencegah loop tanpa akhir.
      const maxNodes = 100;

      while (currentNodeId !== null) {
        if (visitedNodeIds.has(currentNodeId)) {
          throw new Error(
            `Workflow cycle detected at node "${currentNodeId}".`
          );
        }

        if (visitedNodeIds.size >= maxNodes) {
          throw new Error(
            `Workflow exceeded the ${maxNodes}-node execution limit.`
          );
        }

        const node = nodeMap.get(currentNodeId);

        if (!node) {
          throw new Error(
            `Node "${currentNodeId}" was not found.`
          );
        }

        visitedNodeIds.add(currentNodeId);

        updateExecution(executionId, {
          status: "running",
          currentNodeId: node.id,
        });

        const prompt = node.data?.prompt?.trim();

        if (!prompt) {
          throw new Error(
            `Node "${node.id}" has an empty prompt.`
          );
        }

        // Nama step dibuat unik untuk setiap node.
        const stepKey =
          `${visitedNodeIds.size}-` +
          node.id
            .replace(/[^a-zA-Z0-9_-]/g, "-")
            .slice(0, 40);

        // Meminta keputusan biner dari model AI melalui Groq.
        const decision = await step.run(
          `decision-${stepKey}`,
          async () => {
            return getAIDecision(prompt);
          }
        );

        // Simpan hasil keputusan ke log eksekusi.
        const log: WorkflowLog = await step.run(
          `record-${stepKey}`,
          async () => {
            const entry: WorkflowLog = {
              nodeId: node.id,
              label: node.data?.label?.trim() || node.id,
              prompt,
              decision,
              timestamp: new Date().toISOString(),
            };

            appendExecutionLog(executionId, entry);

            return entry;
          }
        );

        // Pastikan hasil keputusan sudah tercatat.
        if (log.decision !== decision) {
          throw new Error(
            `Decision log mismatch at node "${node.id}".`
          );
        }

        // Tentukan node selanjutnya dari cabang YES atau NO.
        const nextEdge = getNextEdge(
          edges,
          node.id,
          decision
        );

        currentNodeId = nextEdge?.target ?? null;
      }

      // Tidak ada node lanjutan. Workflow selesai.
      updateExecution(executionId, {
        status: "completed",
        currentNodeId: null,
        completedAt: new Date().toISOString(),
        error: undefined,
      });

      return {
        success: true,
        executionId,
        status: "completed",
        processedNodeIds: Array.from(visitedNodeIds),
        processedNodeCount: visitedNodeIds.size,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown workflow execution error.";

      console.error(
        `BE-09 workflow ${executionId || "unknown"} failed:`,
        error
      );

      if (executionId) {
        updateExecution(executionId, {
          status: "failed",
          currentNodeId,
          error: message,
          completedAt: new Date().toISOString(),
        });
      }

      // Biarkan Inngest mencatat kegagalan eksekusi.
      throw error;
    }
  }
);
