
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path


# Database location
DB_PATH = Path(__file__).resolve().parent.parent / "jobs.db"


# Create database connection
def get_connection():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


# Initialize database
def init_db():
    with closing(get_connection()) as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS jobs (
                job_id TEXT PRIMARY KEY,
                idempotency_key TEXT UNIQUE,
                message TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'queued'
                    CHECK (status IN (
                        'queued',
                        'running',
                        'completed',
                        'failed'
                    )),
                result TEXT,
                error TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        connection.commit()


# Create a new job
def create_job(job_id, message, idempotency_key=None):
    now = datetime.now(timezone.utc).isoformat()

    with closing(get_connection()) as connection:
        try:
            connection.execute(
                """
                INSERT INTO jobs (
                    job_id,
                    idempotency_key,
                    message,
                    status,
                    created_at,
                    updated_at
                )
                VALUES (?, ?, ?, 'queued', ?, ?)
                """,
                (job_id, idempotency_key, message, now, now),
            )

            connection.commit()

            job = connection.execute(
                "SELECT * FROM jobs WHERE job_id = ?",
                (job_id,),
            ).fetchone()

            return dict(job), True

        except sqlite3.IntegrityError:
            connection.rollback()

            if idempotency_key:
                existing = connection.execute(
                    """
                    SELECT * FROM jobs
                    WHERE idempotency_key = ?
                    """,
                    (idempotency_key,),
                ).fetchone()

                if existing:
                    return dict(existing), False

            raise


# Get job by ID
def get_job(job_id):
    with closing(get_connection()) as connection:
        job = connection.execute(
            "SELECT * FROM jobs WHERE job_id = ?",
            (job_id,),
        ).fetchone()

        return dict(job) if job else None


# Update job status
def update_job_status(
    job_id,
    status,
    result=None,
    error=None,
):
    allowed_statuses = {
        "queued",
        "running",
        "completed",
        "failed",
    }

    if status not in allowed_statuses:
        raise ValueError(f"Invalid job status: {status}")

    now = datetime.now(timezone.utc).isoformat()

    with closing(get_connection()) as connection:
        cursor = connection.execute(
            """
            UPDATE jobs
            SET status = ?,
                result = ?,
                error = ?,
                updated_at = ?
            WHERE job_id = ?
            """,
            (status, result, error, now, job_id),
        )

        connection.commit()

        if cursor.rowcount == 0:
            return None

        job = connection.execute(
            "SELECT * FROM jobs WHERE job_id = ?",
            (job_id,),
        ).fetchone()

        return dict(job) if job else None
