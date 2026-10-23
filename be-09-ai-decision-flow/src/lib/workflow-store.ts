
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

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

type ExecutionRow = {
  id: string;
  status: string;
  current_node_id: string | null;
  error: string | null;
  started_at: string;
  completed_at: string | null;
};

type LogRow = {
  node_id: string;
  label: string;
  prompt: string;
  decision: string;
  timestamp: string;
};

type WorkflowGlobal = typeof globalThis & {
  __be09WorkflowDatabase?: DatabaseSync;
};

const globalStore = globalThis as WorkflowGlobal;

const databasePath = join(
  process.cwd(),
  ".data",
  "be09.sqlite"
);

function initializeDatabase(): DatabaseSync {
  mkdirSync(dirname(databasePath), { recursive: true });

  const connection = new DatabaseSync(databasePath);

  connection.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS workflow_executions (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL CHECK (
        status IN ('queued', 'running', 'completed', 'failed')
      ),
      current_node_id TEXT,
      error TEXT,
      started_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS workflow_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      execution_id TEXT NOT NULL,
      node_id TEXT NOT NULL,
      label TEXT NOT NULL,
      prompt TEXT NOT NULL,
      decision TEXT NOT NULL CHECK (
        decision IN ('YES', 'NO')
      ),
      timestamp TEXT NOT NULL,
      UNIQUE (execution_id, node_id),
      FOREIGN KEY (execution_id)
        REFERENCES workflow_executions(id)
        ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_workflow_logs_execution
      ON workflow_logs(execution_id, id);
  `);

  return connection;
}

const database =
  globalStore.__be09WorkflowDatabase ??
  (globalStore.__be09WorkflowDatabase =
    initializeDatabase());

const insertExecutionStatement = database.prepare(`
  INSERT INTO workflow_executions (
    id,
    status,
    current_node_id,
    error,
    started_at,
    completed_at
  )
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    status = excluded.status,
    current_node_id = excluded.current_node_id,
    error = excluded.error,
    started_at = excluded.started_at,
    completed_at = excluded.completed_at
`);

const updateExecutionStatement = database.prepare(`
  UPDATE workflow_executions
  SET
    status = ?,
    current_node_id = ?,
    error = ?,
    started_at = ?,
    completed_at = ?
  WHERE id = ?
`);

const insertLogStatement = database.prepare(`
  INSERT INTO workflow_logs (
    execution_id,
    node_id,
    label,
    prompt,
    decision,
    timestamp
  )
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(execution_id, node_id) DO UPDATE SET
    label = excluded.label,
    prompt = excluded.prompt,
    decision = excluded.decision,
    timestamp = excluded.timestamp
`);

const deleteLogsStatement = database.prepare(`
  DELETE FROM workflow_logs
  WHERE execution_id = ?
`);

function withTransaction<T>(callback: () => T): T {
  database.exec("BEGIN IMMEDIATE");

  try {
    const result = callback();
    database.exec("COMMIT");
    return result;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function writeLogs(
  executionId: string,
  logs: WorkflowLog[]
): void {
  deleteLogsStatement.run(executionId);

  for (const log of logs) {
    insertLogStatement.run(
      executionId,
      log.nodeId,
      log.label,
      log.prompt,
      log.decision,
      log.timestamp
    );
  }
}

export function createExecution(
  execution: WorkflowExecution
): void {
  withTransaction(() => {
    insertExecutionStatement.run(
      execution.id,
      execution.status,
      execution.currentNodeId,
      execution.error ?? null,
      execution.startedAt,
      execution.completedAt ?? null
    );

    writeLogs(execution.id, execution.logs);
  });
}

export function getExecution(
  id: string
): WorkflowExecution | null {
  const row = database
    .prepare(`
      SELECT
        id,
        status,
        current_node_id,
        error,
        started_at,
        completed_at
      FROM workflow_executions
      WHERE id = ?
    `)
    .get(id) as unknown as ExecutionRow | undefined;

  if (!row) {
    return null;
  }

  const logRows = database
    .prepare(`
      SELECT
        node_id,
        label,
        prompt,
        decision,
        timestamp
      FROM workflow_logs
      WHERE execution_id = ?
      ORDER BY id ASC
    `)
    .all(id) as unknown as LogRow[];

  const execution: WorkflowExecution = {
    id: row.id,
    status: row.status as WorkflowStatus,
    currentNodeId: row.current_node_id,
    startedAt: row.started_at,
    logs: logRows.map((log) => ({
      nodeId: log.node_id,
      label: log.label,
      prompt: log.prompt,
      decision: log.decision as "YES" | "NO",
      timestamp: log.timestamp,
    })),
  };

  if (row.error !== null) {
    execution.error = row.error;
  }

  if (row.completed_at !== null) {
    execution.completedAt = row.completed_at;
  }

  return execution;
}

export function updateExecution(
  id: string,
  update: Partial<WorkflowExecution>
): WorkflowExecution | null {
  const current = getExecution(id);

  if (!current) {
    return null;
  }

  const updated: WorkflowExecution = {
    ...current,
    ...update,
    id: current.id,
    logs: update.logs ?? current.logs,
  };

  withTransaction(() => {
    updateExecutionStatement.run(
      updated.status,
      updated.currentNodeId,
      updated.error ?? null,
      updated.startedAt,
      updated.completedAt ?? null,
      id
    );

    if (update.logs !== undefined) {
      writeLogs(id, updated.logs);
    }
  });

  return getExecution(id);
}

export function appendExecutionLog(
  id: string,
  log: WorkflowLog
): void {
  withTransaction(() => {
    const execution = getExecution(id);

    if (!execution) {
      throw new Error(`Execution ${id} was not found.`);
    }

    insertLogStatement.run(
      id,
      log.nodeId,
      log.label,
      log.prompt,
      log.decision,
      log.timestamp
    );
  });
}
