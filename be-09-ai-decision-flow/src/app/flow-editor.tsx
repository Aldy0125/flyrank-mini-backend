"use client";

import { useCallback, useState } from "react";
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
    style: { stroke: "#22c55e", strokeWidth: 2 },
  },
  {
    id: "e-start-sales",
    source: "start",
    sourceHandle: "no",
    target: "sales",
    label: "NO",
    type: "smoothstep",
    animated: true,
    style: { stroke: "#ef4444", strokeWidth: 2 },
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

      <div className="mt-1 font-semibold">{data.label}</div>

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

  const selectedNode = nodes.find(
    (node) => node.id === selectedNodeId
  );

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
    },
    [setEdges]
  );

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
    setNotice("Decision node added.");
  }

  function updateSelectedNode(
    field: keyof DecisionData,
    value: string
  ) {
    if (!selectedNodeId) return;

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

  function saveWorkflow() {
    try {
      localStorage.setItem(
        "be09-workflow",
        JSON.stringify({ nodes, edges })
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
    setNotice("Example workflow restored. Save it to keep these changes.");
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
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800"
            >
              Load Workflow
            </button>

            <button
              onClick={saveWorkflow}
              className="rounded-lg border border-blue-500 px-3 py-2 text-sm text-blue-300 hover:bg-blue-950"
            >
              Save Workflow
            </button>

            <button
              onClick={resetWorkflow}
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800"
            >
              Reset
            </button>

            <button
              onClick={addDecisionNode}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold hover:bg-blue-500"
            >
              + Add Decision
            </button>
          </div>
        </header>

        {notice && (
          <div
            role="status"
            className="mb-4 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-300"
          >
            {notice}
          </div>
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
            <h2 className="text-lg font-semibold">Node Settings</h2>

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
                      updateSelectedNode("label", event.target.value)
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
                      updateSelectedNode("prompt", event.target.value)
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
                  <p className="font-medium">Decision paths</p>
                  <p className="mt-2 text-green-400">YES → Green path</p>
                  <p className="mt-1 text-red-400">NO → Red path</p>
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
