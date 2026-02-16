from fastapi import FastAPI
from app.api.routes.youtube import router as youtube_router

app = FastAPI(title="YouTube Data API")

app.include_router(youtube_router)

@app.get("/health")
def health():
    return {"status": "ok"}
