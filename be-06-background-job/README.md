# BE-06: Background Job Processing

## 1. Project Overview

BE-06 is a backend engineering project that implements asynchronous background job processing using FastAPI, Inngest, and SQLite.

The application allows clients to submit jobs without waiting for the processing operation to finish. FastAPI accepts the request, stores the job in SQLite, and returns a job ID with an HTTP 202 Accepted response.

Inngest executes the background task asynchronously, allowing the API to remain responsive while processing continues independently.

The system also implements idempotency, automatic retries, job status tracking, structured error handling, and failure handling.

## 2. Technology Stack

| Technology | Purpose |
|---|---|
| Python 3.13 | Programming language |
| FastAPI 0.162.0 | REST API framework |
| Inngest 0.5.19 | Background job orchestration |
| SQLite | Job persistence |
| Pydantic 2.14.2 | Request validation |
| Uvicorn 0.54.0 | ASGI server |

## 3. Project Structure

```text
be-06-background-job/
│
├── app/
│   ├── main.py
│   └── database.py
│
├── .gitignore
├── requirements.txt
└── README.md
```

Note: `jobs.db` is generated automatically when the application initializes. It is stored locally and excluded from Git.

The `.venv` directory contains the local Python virtual environment and should also remain excluded from Git.

## 4. Main Features

### 4.1 Background Job Processing

Clients submit jobs through the POST `/jobs` endpoint.

FastAPI validates the request, stores the job in SQLite, and sends a `job.created` event to Inngest.

Inngest then executes the background worker independently.

The API does not wait for the background processing operation to finish.

### 4.2 Idempotency

The application supports the `Idempotency-Key` HTTP header.

When a client submits the same idempotency key again, the application returns the existing job instead of creating another job.

This prevents duplicate job creation when clients retry requests using the same key.

### 4.3 Automatic Retry

The background worker uses Inngest retry configuration:

```python
retries=3
```

This allows three additional retry attempts after the initial execution.

The application also logs the current execution attempt to help monitor retry activity.

### 4.4 Failure Handling

The application implements a dedicated Inngest failure handler named `handle_job_failure`.

When all configured attempts fail, the handler:

- Extracts the original job ID.
- Retrieves the error information.
- Updates the job status to `failed`.
- Stores the error message in SQLite.
- Logs the permanent failure.

This ensures that failed jobs remain traceable through the API.

### 4.5 Job Status Tracking

Each job has one of the following statuses:

| Status | Description |
|---|---|
| `queued` | Job has been submitted and is waiting for processing. |
| `running` | Background worker is processing the job. |
| `completed` | Background processing has finished successfully. |
| `failed` | Background processing failed after the configured retries. |

Clients can retrieve the latest job status using the job ID.

## 5. Installation

### 5.1 Create a Virtual Environment

Use Python 3.13:

```powershell
py -3.13 -m venv .venv
```

### 5.2 Activate the Virtual Environment

```powershell
.\.venv\Scripts\Activate.ps1
```

### 5.3 Install Dependencies

```powershell
python -m pip install -r requirements.txt
```

### 5.4 Verify Dependencies

```powershell
python -m pip check
```

Expected output:

```text
No broken requirements found.
```

## 6. Running the Application

The application requires two terminal sessions.

### Terminal 1: Start FastAPI

Activate the virtual environment and configure the Inngest development environment:

```powershell
$env:INNGEST_DEV = "1"
```

Start the FastAPI server:

```powershell
uvicorn app.main:app --reload --port 8000
```

The API will be available at:

```text
http://127.0.0.1:8000
```

Swagger API documentation:

```text
http://127.0.0.1:8000/docs
```

### Terminal 2: Start Inngest Dev Server

Open another PowerShell terminal, navigate to the project directory, and run:

```powershell
npx inngest-cli@latest dev -u http://localhost:8000/api/inngest
```

The Inngest Dev Server will display its dashboard URL in the terminal.

The default dashboard port is `8288`. If the port is occupied, the CLI may select another available port, such as `8290`.

Open the exact local URL printed by the CLI to access the Inngest dashboard.

## 7. API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Check API health |
| POST | `/jobs` | Submit a background job |
| GET | `/jobs/{job_id}` | Retrieve job status |
| SDK-managed | `/api/inngest` | Inngest communication endpoint |

### 7.1 Health Check

Request:

```http
GET /health
```

Expected response:

```json
{
  "status": "ok"
}
```

HTTP status: `200 OK`.

### 7.2 Submit a Background Job

Request:

```http
POST /jobs
Content-Type: application/json
Idempotency-Key: unique-job-key
```

Request body:

```json
{
  "message": "Process this background job"
}
```

Expected response:

```json
{
  "job_id": "generated-job-id",
  "status": "queued",
  "created": true
}
```

HTTP status: `202 Accepted`.

The returned job ID can be used to retrieve the processing status.

### 7.3 Retrieve Job Status

Request:

```http
GET /jobs/{job_id}
```

Example completed response:

```json
{
  "job_id": "generated-job-id",
  "idempotency_key": "unique-job-key",
  "message": "Process this background job",
  "status": "completed",
  "result": "Processed message: Process this background job",
  "error": null,
  "created_at": "2026-11-02T12:00:00+00:00",
  "updated_at": "2026-11-02T12:00:05+00:00"
}
```

The timestamps above are illustrative. Actual values are generated by the application.

If the requested job ID does not exist, the API returns HTTP `404 Not Found`.

## 8. Background Job Workflow

The processing workflow follows these steps:

1. Client submits a job through the API.
2. FastAPI validates the request using Pydantic.
3. SQLite stores the job with `queued` status.
4. FastAPI sends a `job.created` event to Inngest.
5. Inngest receives the event and starts the background worker.
6. The worker retrieves the job from SQLite.
7. The job status changes to `running`.
8. The worker performs the background operation.
9. SQLite stores the processing result.
10. The job status changes to `completed`.

If processing fails, Inngest retries the execution according to the configured retry policy.

When all attempts fail, `handle_job_failure` updates the job status to `failed` and stores the error message in SQLite.

## 9. Registered Inngest Functions

### 9.1 say-hello

| Property | Value |
|---|---|
| Function ID | `report-api-say-hello` |
| Trigger event | `test/hello` |
| Execution | Waits five seconds and returns a message. |

This function serves as an initial background processing test.

### 9.2 process-background-job

| Property | Value |
|---|---|
| Function ID | `report-api-process-background-job` |
| Trigger event | `job.created` |
| Retries | 3 |
| Maximum attempts | 4 |
| Failure handler | `handle_job_failure` |

This function handles the main background job processing workflow.

It retrieves the job, updates its status, performs the processing operation, and saves the result.

## 10. Database Design

The application uses SQLite to persist background job information.

The `jobs` table contains the following fields:

| Field | Description |
|---|---|
| `job_id` | Unique identifier for each job. |
| `idempotency_key` | Unique key used to prevent duplicate job creation. |
| `message` | Input message submitted by the client. |
| `status` | Current job processing status. |
| `result` | Successful processing result. |
| `error` | Error information when processing fails. |
| `created_at` | Job creation timestamp. |
| `updated_at` | Last job update timestamp. |

The database is initialized automatically when the FastAPI application starts.

## 11. Testing Results

The following manual integration tests and validation checks were performed during development.

| Test | Expected Result | Status |
|---|---|---|
| API health check | HTTP 200 | PASS |
| Job submission | HTTP 202 | PASS |
| Background processing | Job completed | PASS |
| Job status retrieval | Correct job information | PASS |
| Idempotency | Duplicate request reuses existing job ID | PASS |
| Retry configuration | Three retries configured | PASS |
| Failure handler | Job status changes to failed | PASS |
| Error persistence | Error message stored in SQLite | PASS |
| Python compilation | No compilation errors | PASS |
| Dependency validation | No broken requirements | PASS |

### Testing Commands

Python compilation:

```powershell
python -m compileall app
```

Dependency validation:

```powershell
python -m pip check
```

Application import validation:

```powershell
$env:INNGEST_DEV = "1"

python -c "from app.main import app, process_background_job; print('APP: PASS'); print('FUNCTION:', process_background_job.id); print('RETRIES:', process_background_job._opts.retries); print('FAILURE HANDLER:', process_background_job._on_failure_fn_id)"
```

## 12. Conclusion

BE-06 demonstrates an asynchronous background job processing system using FastAPI, Inngest, and SQLite.

The implementation allows clients to submit jobs without waiting for processing operations to finish.

The system includes job persistence, idempotency, automatic retries, job status tracking, and permanent failure handling.

The integration tests demonstrate that the application can process jobs asynchronously, prevent duplicate job creation, and record permanent failures.

This project establishes a foundation for implementing reliable background processing in backend applications.