import uuid
import threading
from fastapi import APIRouter, HTTPException

from backend.models.schemas import SubtitleProcessRequest
from backend.services.subtitle_service import subtitle_service

router = APIRouter()

@router.post("/subtitles/process")
def start_processing(req: SubtitleProcessRequest):
    if not req.folder_path:
        raise HTTPException(status_code=400, detail="Folder path is required")
    if not req.api_key:
        raise HTTPException(status_code=400, detail="Gemini API key is required for audio transcription")

    job_id = str(uuid.uuid4())
    job = subtitle_service.create_job(job_id, req.folder_path)

    styling_dict = req.styling.model_dump()
    
    # Run processing loop in background thread
    thread = threading.Thread(
        target=subtitle_service.process_subtitles,
        args=(job_id, req.folder_path, req.api_key, styling_dict),
    )
    thread.start()

    return job

@router.get("/subtitles/job/{job_id}")
def get_job_status(job_id: str):
    job = subtitle_service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@router.get("/subtitles/jobs")
def list_jobs():
    return subtitle_service.get_all_jobs()
