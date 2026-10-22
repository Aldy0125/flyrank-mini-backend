
export type WorkflowStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed";

export type WorkflowLog = {
  nodeId: string;
  label: string;
  prompt: string;
  decision: "YES" | "NO";
  timestamp: string;
};

export type WorkflowExecution = {
  id: string;
  status: WorkflowStatus;
  logs: WorkflowLog[];
  currentNodeId: string | null;
  error?: string;
  startedAt: string;
  completedAt?: string;
};

type WorkflowGlobal = typeof globalThis & {
  __be09WorkflowExecutions?: Map<string, WorkflowExecution>;
};

const globalStore = globalThis as WorkflowGlobal;

const executions =
  globalStore.__be09WorkflowExecutions ??
  (globalStore.__be09WorkflowExecutions = new Map<
    string,
    WorkflowExecution
  >());

export function createExecution(
  execution: WorkflowExecution
): void {
  executions.set(execution.id, execution);
}

export function getExecution(
  id: string
): WorkflowExecution | null {
  return executions.get(id) ?? null;
}

export function updateExecution(
  id: string,
  update: Partial<WorkflowExecution>
): WorkflowExecution | null {
  const current = executions.get(id);

  if (!current) {
    return null;
  }

  const updated = {
    ...current,
    ...update,
  };

  executions.set(id, updated);

  return updated;
}

export function appendExecutionLog(
  id: string,
  log: WorkflowLog
): void {
  const current = executions.get(id);

  if (!current) {
    throw new Error(`Execution ${id} was not found.`);
  }

  const existingIndex = current.logs.findIndex(
    (item) => item.nodeId === log.nodeId
  );

  const logs = [...current.logs];

  if (existingIndex >= 0) {
    logs[existingIndex] = log;
  } else {
    logs.push(log);
  }

  executions.set(id, {
    ...current,
    logs,
  });
}
