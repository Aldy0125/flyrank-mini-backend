import datetime
import logging

from fastapi import FastAPI

import inngest
import inngest.fast_api


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


# First background function
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


# Serve Inngest functions
inngest.fast_api.serve(
    app,
    inngest_client,
    [say_hello],
)


# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "ok"}
