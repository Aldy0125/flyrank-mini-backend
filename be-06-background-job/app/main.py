from fastapi import FastAPI

app = FastAPI(
    title="BE-06 Background Job API",
    description="FlyRank Backend Internship Project",
    version="1.0.0"
)


@app.get("/health")
async def health_check():
    return {"status": "ok"}