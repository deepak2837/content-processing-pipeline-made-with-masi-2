import uuid
import threading
from fastapi import APIRouter, HTTPException
from typing import List

from backend.models.schemas import VideoEditRequest, FolderListRequest
from backend.services.video_editor_service import video_editor_service

router = APIRouter()


@router.post("/video-editor/process")
def start_processing(req: VideoEditRequest):
    if not req.folder_path:
        raise HTTPException(status_code=400, detail="Folder path is required")

    job_id = str(uuid.uuid4())
    job = video_editor_service.create_job(job_id, req.folder_path)

    settings_dict = req.settings.model_dump()
    thread = threading.Thread(
        target=video_editor_service.process_videos,
        args=(job_id, req.folder_path, settings_dict),
    )
    thread.start()

    return job


@router.get("/video-editor/job/{job_id}")
def get_job_status(job_id: str):
    job = video_editor_service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/video-editor/jobs")
def list_jobs():
    return video_editor_service.get_all_jobs()


@router.post("/video-editor/cancel/{job_id}")
def cancel_job(job_id: str):
    job = video_editor_service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    video_editor_service.cancel_job(job_id)
    return {"status": "success"}


@router.post("/video-editor/list-folder")
def list_folder(req: FolderListRequest):
    return video_editor_service.list_video_files(req.folder_path)
