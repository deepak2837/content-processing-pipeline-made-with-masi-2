from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

try:
    with open(".env", "r") as f:
        for line in f:
            if line.strip() and not line.startswith("#"):
                k, v = line.strip().split("=", 1)
                os.environ[k] = v.strip(' "\'')
except Exception:
    pass

from backend.api import downloader, video_editor, audio_generator, subtitles, watermark, scheduler, pipeline

app = FastAPI(
    title="Video Automation Platform API",
    description="Backend API for automating video downloads and processing",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(downloader.router, prefix="/api", tags=["Downloader"])
app.include_router(video_editor.router, prefix="/api", tags=["Video Editor"])
app.include_router(audio_generator.router, prefix="/api", tags=["Audio Generator"])
app.include_router(subtitles.router, prefix="/api", tags=["Subtitles Generator"])
app.include_router(watermark.router, prefix="/api", tags=["Watermark Applier"])
app.include_router(scheduler.router, prefix="/api", tags=["Social Scheduler"])
app.include_router(pipeline.router, prefix="/api", tags=["Automation Pipeline"])

@app.get("/")
def read_root():
    return {"message": "Welcome to Video Automation Platform API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
