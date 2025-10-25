import uuid
import threading
from fastapi import APIRouter, BackgroundTasks, HTTPException
from typing import List

from backend.models.schemas import DownloadRequest, DownloadStatus, YouTubeDownloadRequest
from backend.core.job_manager import job_manager
from backend.services.instagram_service import instagram_service
from backend.services.youtube_service import youtube_service

router = APIRouter()

# ── Instagram endpoints ───────────────────────────────────────

@router.post("/download", response_model=DownloadStatus)
def start_download(req: DownloadRequest, background_tasks: BackgroundTasks):
    if not req.handle:
        raise HTTPException(status_code=400, detail="Instagram handle is required")
    if not req.download_path:
        raise HTTPException(status_code=400, detail="Download path is required")
        
    job_id = str(uuid.uuid4())
    job = job_manager.create_job(job_id, req.handle)
    
    # Run in background
    thread = threading.Thread(target=instagram_service.process_download, args=(job_id, req))
    thread.start()
    
    return job

# ── YouTube Shorts endpoints ──────────────────────────────────

@router.post("/youtube/download", response_model=DownloadStatus)
def start_youtube_download(req: YouTubeDownloadRequest, background_tasks: BackgroundTasks):
    if not req.source_url:
        raise HTTPException(status_code=400, detail="YouTube URL is required")
    if not req.download_path:
        raise HTTPException(status_code=400, detail="Download path is required")

    job_id = str(uuid.uuid4())
    # Use the URL (or channel handle) as the display name
    job = job_manager.create_job(job_id, req.source_url)

    thread = threading.Thread(
        target=youtube_service.process_download,
        args=(job_id,),
        kwargs={
            "source_url": req.source_url,
            "download_path": req.download_path,
            "max_videos": req.max_videos,
            "download_captions": req.download_captions,
            "download_description": req.download_description,
            "download_metadata": req.download_metadata,
        },
    )
    thread.start()

    return job

# ── Shared status endpoints ───────────────────────────────────

@router.get("/download/{job_id}", response_model=DownloadStatus)
def get_download_status(job_id: str):
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@router.get("/downloads", response_model=List[DownloadStatus])
def list_downloads():
    return job_manager.get_all_jobs()
