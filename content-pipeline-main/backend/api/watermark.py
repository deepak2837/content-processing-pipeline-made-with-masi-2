import uuid
import threading
from fastapi import APIRouter, HTTPException

from backend.models.schemas import WatermarkProcessRequest
from backend.services.watermark_service import watermark_service

router = APIRouter()

@router.post("/watermark/process")
def start_processing(req: WatermarkProcessRequest):
    if not req.folder_path:
        raise HTTPException(status_code=400, detail="Folder path is required")
    if not req.logo_path:
        raise HTTPException(status_code=400, detail="Watermark logo path is required")

    job_id = str(uuid.uuid4())
    job = watermark_service.create_job(job_id, req.folder_path)

    settings_dict = req.settings.model_dump()
    
    # Run processing loop in background thread
    thread = threading.Thread(
        target=watermark_service.process_watermarks,
        args=(job_id, req.folder_path, req.logo_path, settings_dict),
    )
    thread.start()

    return job

@router.get("/watermark/job/{job_id}")
def get_job_status(job_id: str):
    job = watermark_service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@router.get("/watermark/jobs")
def list_jobs():
    return watermark_service.get_all_jobs()
