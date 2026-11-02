
import datetime
import logging
from uuid import uuid4

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

import inngest
import inngest.fast_api

from app.database import (
    init_db,
    create_job,
    get_job,
    update_job_status,
)


# Create Inngest client
inngest_client = inngest.Inngest(
    app_id="report-api",
    logger=logging.getLogger("uvicorn"),
)


# Create FastAPI application
app = FastAPI(
    title="BE-06 Background Job API",
    description="FlyRank Backend Internship Project",
    version="1.0.0",
)


# Initialize database
init_db()


# Request schema
class JobCreateRequest(BaseModel):
    message: str = Field(
        min_length=1,
        max_length=5000,
    )


# First background function (existing test)
@inngest_client.create_function(
    fn_id="say-hello",
    trigger=inngest.TriggerEvent(event="test/hello"),
)
async def say_hello(ctx: inngest.Context) -> str:

    await ctx.step.sleep(
        "wait-five-seconds",
        datetime.timedelta(seconds=5),
    )

    return "Hello from the background!"


# Main background job worker
@inngest_client.create_function(
    fn_id="process-background-job",
    trigger=inngest.TriggerEvent(event="job.created"),
    retries=3,
)
async def process_background_job(ctx: inngest.Context):

    job_id = ctx.event.data.get("job_id")

    if not isinstance(job_id, str) or not job_id:
        raise ValueError("Invalid job ID")

    # Load job from database
    job = await ctx.step.run(
        "load-job",
        lambda: get_job(job_id),
    )

    if job is None:
        raise ValueError(f"Job not found: {job_id}")

    # Update status to running
    await ctx.step.run(
        "mark-job-running",
        lambda: update_job_status(
            job_id,
            "running",
        ),
    )

    # Simulate a slow background operation
    await ctx.step.sleep(
        "simulate-processing",
        datetime.timedelta(seconds=5),
    )

    # Temporary processing result
    result = f"Processed message: {job['message']}"

    # Save completed result
    updated_job = await ctx.step.run(
        "save-job-result",
        lambda: update_job_status(
            job_id,
            "completed",
            result=result,
        ),
    )

    if updated_job is None:
        raise RuntimeError("Failed to update job result")

    return {
        "job_id": job_id,
        "status": updated_job["status"],
        "result": updated_job["result"],
    }


# Submit background job
@app.post("/jobs", status_code=202)
async def submit_job(
    request: JobCreateRequest,
    idempotency_key: str | None = Header(
        default=None,
        alias="Idempotency-Key",
    ),
):

    job_id = str(uuid4())

    job, created = create_job(
        job_id,
        request.message,
        idempotency_key,
    )

    # Send event only for new or still queued jobs
    if created or job["status"] == "queued":

        try:
            await inngest_client.send(
                inngest.Event(
                    name="job.created",
                    id=job["job_id"],
                    data={
                        "job_id": job["job_id"],
                    },
                )
            )

        except Exception as exc:
            logging.getLogger("uvicorn").exception(
                "Failed to send Inngest event"
            )

            raise HTTPException(
                status_code=503,
                detail=(
                    "Job saved but background event could not "
                    "be sent. Retry using the same Idempotency-Key."
                ),
            ) from exc

    return {
        "job_id": job["job_id"],
        "status": job["status"],
        "created": created,
    }


# Get background job status
@app.get("/jobs/{job_id}")
async def read_job_status(job_id: str):

    job = get_job(job_id)

    if job is None:
        raise HTTPException(
            status_code=404,
            detail="Job not found",
        )

    return job


# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "ok"}


# Serve Inngest functions
inngest.fast_api.serve(
    app,
    inngest_client,
    [
        say_hello,
        process_background_job,
    ],
)
