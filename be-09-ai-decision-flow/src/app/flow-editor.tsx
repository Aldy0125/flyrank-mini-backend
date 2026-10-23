
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
} from "@xyflow/react";

type DecisionData = {
  label: string;
  prompt: string;
};

type DecisionNode = Node<DecisionData, "decision">;

type WorkflowStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed";

type WorkflowLog = {
  nodeId: string;
  label: string;
  prompt: string;
  decision: "YES" | "NO";
  timestamp: string;
};

type ExecutionSnapshot = {
  id: string;
  status: WorkflowStatus;
  logs: WorkflowLog[];
  currentNodeId: string | null;
  error?: string;
  startedAt: string;
  completedAt?: string;
};

type RunWorkflowResponse = {
  success?: boolean;
  executionId?: string;
  status?: WorkflowStatus;
  message?: string;
  error?: string;
};

type ExecutionResponse = {
  success?: boolean;
  execution?: ExecutionSnapshot;
  error?: string;
};

const initialNodes: DecisionNode[] = [
  {
    id: "start",
    type: "decision",
    position: { x: 350, y: 50 },
    data: {
      label: "Decision 1",
      prompt: "Is this a support request?",
    },
  },
  {
    id: "support",
    type: "decision",
    position: { x: 100, y: 330 },
    data: {
      label: "Support Node",
      prompt: "Does the user need technical support?",
    },
  },
  {
    id: "sales",
    type: "decision",
    position: { x: 600, y: 330 },
    data: {
      label: "Sales Node",
      prompt: "Is the user asking about pricing or products?",
    },
  },
];

const initialEdges: Edge[] = [
  {
    id: "e-start-support",
    source: "start",
    sourceHandle: "yes",
    target: "support",
    label: "YES",
    type: "smoothstep",
    animated: true,
    style: {
      stroke: "#22c55e",
      strokeWidth: 2,
    },
  },
  {
    id: "e-start-sales",
    source: "start",
    sourceHandle: "no",
    target: "sales",
    label: "NO",
    type: "smoothstep",
    animated: true,
    style: {
      stroke: "#ef4444",
      strokeWidth: 2,
    },
  },
];

function DecisionNodeCard({
  data,
  selected,
}: NodeProps<DecisionNode>) {
  return (
    <div
      className={`relative w-[260px] rounded-xl border bg-slate-900 px-4 pb-5 pt-4 text-slate-100 shadow-xl ${
        selected
          ? "border-blue-400 ring-2 ring-blue-500/30"
          : "border-slate-700"
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !border-2 !border-white !bg-slate-400"
      />

      <div className="text-[10px] uppercase tracking-widest text-blue-300">
        AI Decision
      </div>

      <div className="mt-1 font-semibold">
        {data.label}
      </div>

      <p className="mt-2 min-h-10 text-sm leading-relaxed text-slate-300">
        {data.prompt || "Add a decision prompt."}
      </p>

      <div className="relative mt-5 flex justify-between px-2 text-xs font-bold">
        <span className="text-green-400">YES</span>
        <span className="text-red-400">NO</span>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        id="yes"
        style={{
          left: "25%",
          width: 10,
          height: 10,
          background: "#22c55e",
          border: "2px solid white",
        }}
      />

      <Handle
        type="source"
        position={Position.Bottom}
        id="no"
        style={{
          left: "75%",
          width: 10,
          height: 10,
          background: "#ef4444",
          border: "2px solid white",
        }}
      />
    </div>
  );
}

const nodeTypes = {
  decision: DecisionNodeCard,
};

export default function FlowEditor() {
  const [nodes, setNodes, onNodesChange] =
    useNodesState<DecisionNode>(initialNodes);

  const [edges, setEdges, onEdgesChange] =
    useEdgesState<Edge>(initialEdges);

  const [selectedNodeId, setSelectedNodeId] =
    useState<string | null>("start");

  const [notice, setNotice] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  const [executionId, setExecutionId] =
    useState<string | null>(null);

  const [executionStatus, setExecutionStatus] =
    useState<WorkflowStatus | null>(null);

  const [executionDetails, setExecutionDetails] =
    useState<ExecutionSnapshot | null>(null);

  const [executionError, setExecutionError] =
    useState<string | null>(null);

  const selectedNode = nodes.find(
    (node) => node.id === selectedNodeId
  );

  // Poll execution status and decision logs.
 useEffect(() => {
  if (!executionId) {
    return;
  }

  const activeExecutionId = executionId;

  let cancelled = false;

    let timer: ReturnType<typeof setTimeout> | undefined;

    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 5;

    function scheduleNext(delay: number) {
      timer = setTimeout(() => {
        void refreshExecution();
      }, delay);
    }

    async function refreshExecution(): Promise<void> {
      try {
        const response = await fetch(
         `/api/executions/${encodeURIComponent(activeExecutionId)}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const result =
          (await response.json()) as ExecutionResponse;

        if (
          !response.ok ||
          !result.success ||
          !result.execution
        ) {
          throw new Error(
            result.error ||
              `Could not retrieve execution status. HTTP ${response.status}.`
          );
        }

        if (cancelled) {
          return;
        }

        consecutiveErrors = 0;

        const execution = result.execution;

        setExecutionDetails(execution);
        setExecutionStatus(execution.status);
        setExecutionError(execution.error ?? null);

        if (
          execution.status === "queued" ||
          execution.status === "running"
        ) {
          scheduleNext(1000);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        consecutiveErrors += 1;

        const message =
          error instanceof Error
            ? error.message
            : "Could not retrieve execution status.";

        if (consecutiveErrors < maxConsecutiveErrors) {
          setExecutionError(
            `${message} Retrying (${consecutiveErrors}/${maxConsecutiveErrors - 1})...`
          );

          scheduleNext(1500);
        } else {
          setExecutionError(
            `${message} Automatic status refresh stopped after repeated errors.`
          );
        }
      }
    }

    void refreshExecution();

    return () => {
      cancelled = true;

      if (timer !== undefined) {
        clearTimeout(timer);
      }
    };
  }, [executionId]);

  const onConnect = useCallback(
    (connection: Connection) => {
      const label =
        connection.sourceHandle === "yes"
          ? "YES"
          : connection.sourceHandle === "no"
            ? "NO"
            : "NEXT";

      const color =
        label === "YES"
          ? "#22c55e"
          : label === "NO"
            ? "#ef4444"
            : "#64748b";

      setEdges((current) =>
        addEdge(
          {
            ...connection,
            id: `edge-${Date.now()}`,
            label,
            type: "smoothstep",
            animated: true,
            style: {
              stroke: color,
              strokeWidth: 2,
            },
          },
          current
        )
      );

      setNotice("");
    },
    [setEdges]
  );

  function clearExecutionState() {
    setExecutionId(null);
    setExecutionStatus(null);
    setExecutionDetails(null);
    setExecutionError(null);
  }

  function addDecisionNode() {
    const id = `decision-${Date.now()}`;

    const newNode: DecisionNode = {
      id,
      type: "decision",
      position: {
        x: 250 + nodes.length * 35,
        y: 150 + nodes.length * 35,
      },
      data: {
        label: `Decision ${nodes.length + 1}`,
        prompt: "Write a question that can be answered YES or NO.",
      },
    };

    setNodes((current) => [...current, newNode]);
    setSelectedNodeId(id);
    setNotice("");
  }

  function updateSelectedNode(
    field: keyof DecisionData,
    value: string
  ) {
    if (!selectedNodeId) {
      return;
    }

    setNodes((current) =>
      current.map((node) =>
        node.id === selectedNodeId
          ? {
              ...node,
              data: {
                ...node.data,
                [field]: value,
              },
            }
          : node
      )
    );

    setNotice("");
  }

  async function runWorkflow() {
    if (isRunning) {
      return;
    }

    if (nodes.length === 0) {
      setNotice("Add at least one decision node.");
      return;
    }

    const invalidNode = nodes.find(
      (node) =>
        !node.id.trim() ||
        typeof node.data?.prompt !== "string" ||
        !node.data.prompt.trim()
    );

    if (invalidNode) {
      setNotice(
        `Node "${invalidNode.data?.label || invalidNode.id}" needs a valid decision prompt.`
      );
      return;
    }

    const nodeIds = new Set(
      nodes.map((node) => node.id)
    );

    const invalidEdge = edges.find(
      (edge) =>
        !nodeIds.has(edge.source) ||
        !nodeIds.has(edge.target)
    );

    if (invalidEdge) {
      setNotice(
        `Connection "${invalidEdge.id}" references a missing node.`
      );
      return;
    }

    const startNodeId = nodeIds.has("start")
      ? "start"
      : nodes[0].id;

    setIsRunning(true);

    clearExecutionState();

    setNotice("Submitting workflow to the backend...");

    try {
      const response = await fetch("/api/run-workflow", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nodes,
          edges,
          startNodeId,
        }),
      });

      const result =
        (await response.json()) as RunWorkflowResponse;

      if (!response.ok) {
        throw new Error(
          result.error ||
            `Workflow request failed with HTTP ${response.status}.`
        );
      }

      if (!result.success || !result.executionId) {
        throw new Error(
          result.error ||
            "The backend did not return an execution ID."
        );
      }

      setExecutionId(result.executionId);

      setExecutionStatus(result.status ?? "queued");

      setNotice(
        result.message ||
          "Workflow submitted to Inngest successfully."
      );
    } catch (error) {
      console.error("Could not run workflow:", error);

      setExecutionStatus("failed");

      const message =
        error instanceof Error
          ? error.message
          : "An unknown error occurred while submitting the workflow.";

      setExecutionError(message);

      setNotice(
        `Workflow submission failed: ${message}`
      );
    } finally {
      setIsRunning(false);
    }
  }

  function saveWorkflow() {
    try {
      localStorage.setItem(
        "be09-workflow",
        JSON.stringify({
          nodes,
          edges,
        })
      );

      setNotice("Workflow saved in this browser.");
    } catch (error) {
      console.error("Could not save workflow:", error);
      setNotice("Could not save workflow.");
    }
  }

  function loadWorkflow() {
    try {
      const saved = localStorage.getItem("be09-workflow");

      if (!saved) {
        setNotice("No saved workflow was found.");
        return;
      }

      const parsed: unknown = JSON.parse(saved);

      if (
        typeof parsed !== "object" ||
        parsed === null ||
        !("nodes" in parsed) ||
        !("edges" in parsed) ||
        !Array.isArray(parsed.nodes) ||
        !Array.isArray(parsed.edges)
      ) {
        setNotice("Saved workflow has an invalid format.");
        return;
      }

      const savedNodes = parsed.nodes as DecisionNode[];
      const savedEdges = parsed.edges as Edge[];

      setNodes(savedNodes);
      setEdges(savedEdges);
      setSelectedNodeId(savedNodes[0]?.id ?? null);

      clearExecutionState();

      setNotice("Workflow loaded successfully.");
    } catch (error) {
      console.error("Could not load workflow:", error);
      setNotice("Could not load workflow.");
    }
  }

  function resetWorkflow() {
    setNodes(initialNodes);
    setEdges(initialEdges);
    setSelectedNodeId("start");

    clearExecutionState();

    setNotice(
      "Example workflow restored. Save it to keep these changes."
    );
  }

  function formatTimestamp(
    value: string | undefined
  ): string {
    if (!value) {
      return "Not available";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString();
  }

  function getStatusColor(
    status: WorkflowStatus | null
  ): string {
    switch (status) {
      case "completed":
        return "text-green-400";

      case "failed":
        return "text-red-400";

      case "running":
        return "text-amber-300";

      case "queued":
      default:
        return "text-blue-300";
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 p-5 text-slate-100 md:p-8">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
              FlyRank AI Engineering · BE-09
            </p>

            <h1 className="mt-2 text-3xl font-bold">
              AI Decision Flow
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              Build visual workflows with YES and NO decision paths.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={loadWorkflow}
              disabled={isRunning}
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800 disabled:opacity-50"
            >
              Load Workflow
            </button>

            <button
              onClick={saveWorkflow}
              disabled={isRunning}
              className="rounded-lg border border-blue-500 px-3 py-2 text-sm text-blue-300 hover:bg-blue-950 disabled:opacity-50"
            >
              Save Workflow
            </button>

            <button
              onClick={resetWorkflow}
              disabled={isRunning}
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800 disabled:opacity-50"
            >
              Reset
            </button>

            <button
              onClick={runWorkflow}
              disabled={isRunning}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRunning ? "Submitting..." : "Run Workflow"}
            </button>

            <button
              onClick={addDecisionNode}
              disabled={isRunning}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50"
            >
              + Add Decision
            </button>
          </div>
        </header>

        {notice && (
          <div
            role="status"
            aria-live="polite"
            className="mb-4 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-300"
          >
            {notice}
          </div>
        )}

        {executionId && (
          <section className="mb-5 rounded-xl border border-slate-800 bg-slate-900 p-4">
            <h2 className="font-semibold">
              Latest Execution
            </h2>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-slate-400">
                  Execution ID
                </p>

                <p className="mt-1 break-all font-mono text-xs">
                  {executionId}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-400">
                  Execution status
                </p>

                <p
                  className={`mt-1 font-semibold ${getStatusColor(
                    executionStatus
                  )}`}
                >
                  {executionStatus ?? "queued"}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-400">
                  Started at
                </p>

                <p className="mt-1 text-sm text-slate-300">
                  {formatTimestamp(
                    executionDetails?.startedAt
                  )}
                </p>
              </div>

              {executionDetails?.completedAt && (
                <div>
                  <p className="text-xs text-slate-400">
                    Completed at
                  </p>

                  <p className="mt-1 text-sm text-slate-300">
                    {formatTimestamp(
                      executionDetails.completedAt
                    )}
                  </p>
                </div>
              )}
            </div>

            {executionDetails?.currentNodeId && (
              <p className="mt-3 text-sm text-slate-300">
                Current node:{" "}
                <span className="font-mono">
                  {executionDetails.currentNodeId}
                </span>
              </p>
            )}

            {executionError && (
              <div
                role="alert"
                className="mt-4 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300"
              >
                {executionError}
              </div>
            )}

            {(executionStatus === "queued" ||
              executionStatus === "running") && (
              <p className="mt-3 text-xs text-slate-400">
                Refreshing execution status automatically...
              </p>
            )}

            {executionDetails && (
              <div className="mt-5">
                <h3 className="font-medium">
                  Decision Logs ({executionDetails.logs.length})
                </h3>

                {executionDetails.logs.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-400">
                    No decision logs recorded yet.
                  </p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {executionDetails.logs.map((log) => (
                      <article
                        key={`${log.nodeId}-${log.timestamp}`}
                        className="rounded-lg border border-slate-800 bg-slate-950 p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium">
                            {log.label}
                          </p>

                          <span
                            className={`text-sm font-bold ${
                              log.decision === "YES"
                                ? "text-green-400"
                                : "text-red-400"
                            }`}
                          >
                            {log.decision}
                          </span>
                        </div>

                        <p className="mt-2 text-sm text-slate-300">
                          {log.prompt}
                        </p>

                        <p className="mt-2 text-xs text-slate-500">
                          Node ID: {log.nodeId}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {formatTimestamp(log.timestamp)}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="h-[620px] overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={(_, node) =>
                setSelectedNodeId(node.id)
              }
              fitView
              deleteKeyCode="Delete"
            >
              <Background color="#475569" gap={20} />
              <MiniMap />
              <Controls />
            </ReactFlow>
          </section>

          <aside className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-lg font-semibold">
              Node Settings
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              Select a node to edit its name and prompt.
            </p>

            {selectedNode ? (
              <div className="mt-5 space-y-4">
                <div>
                  <label
                    htmlFor="node-name"
                    className="mb-2 block text-sm font-medium"
                  >
                    Node name
                  </label>

                  <input
                    id="node-name"
                    value={selectedNode.data.label}
                    onChange={(event) =>
                      updateSelectedNode(
                        "label",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="node-prompt"
                    className="mb-2 block text-sm font-medium"
                  >
                    Decision prompt
                  </label>

                  <textarea
                    id="node-prompt"
                    rows={5}
                    value={selectedNode.data.prompt}
                    onChange={(event) =>
                      updateSelectedNode(
                        "prompt",
                        event.target.value
                      )
                    }
                    placeholder="Write a YES/NO question..."
                    className="w-full resize-y rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm outline-none focus:border-blue-500"
                  />

                  <p className="mt-2 text-xs leading-relaxed text-slate-400">
                    Write one clear question that the AI can answer
                    with YES or NO.
                  </p>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm">
                  <p className="font-medium">
                    Decision paths
                  </p>

                  <p className="mt-2 text-green-400">
                    YES → Green path
                  </p>

                  <p className="mt-1 text-red-400">
                    NO → Red path
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-5 text-sm text-slate-400">
                Select a node on the canvas to edit it.
              </p>
            )}

            <p className="mt-6 text-xs leading-relaxed text-slate-500">
              Save and load workflows using this browser&apos;s local storage.
              These workflows are not synced across devices.
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}
