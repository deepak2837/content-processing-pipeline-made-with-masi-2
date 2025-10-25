import uuid
import threading
from fastapi import APIRouter, HTTPException

from backend.models.schemas import AudioGenRequest, FolderListRequest, AutoAnalyzeRequest
from backend.services.audio_gen_service import audio_generator_service
from backend.services.auto_analyze_service import auto_analyze_service

router = APIRouter()


@router.get("/audio-gen/voices")
def list_voices():
    return audio_generator_service.get_voices()


@router.post("/audio-gen/process")
def start_processing(req: AudioGenRequest):
    if not req.folder_path:
        raise HTTPException(status_code=400, detail="Folder path is required")
    if not req.settings.text and not req.settings.per_video_texts and not req.settings.auto_generate_scripts:
        raise HTTPException(status_code=400, detail="Text is required")

    job_id = str(uuid.uuid4())
    job = audio_generator_service.create_job(job_id, req.folder_path)

    settings_dict = req.settings.model_dump()
    thread = threading.Thread(
        target=audio_generator_service.process_videos,
        args=(job_id, req.folder_path, settings_dict),
    )
    thread.start()

    return job


@router.get("/audio-gen/job/{job_id}")
def get_job_status(job_id: str):
    job = audio_generator_service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/audio-gen/jobs")
def list_jobs():
    return audio_generator_service.get_all_jobs()


@router.post("/audio-gen/list-folder")
def list_folder(req: FolderListRequest):
    return audio_generator_service.list_video_files(req.folder_path)


@router.get("/audio-gen/stream")
def stream_video(file_path: str):
    import os
    from fastapi.responses import FileResponse
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)


@router.post("/audio-gen/auto-analyze")
def auto_analyze(req: AutoAnalyzeRequest):
    if not req.folder_path:
        raise HTTPException(status_code=400, detail="Folder path is required")
    try:
        scripts = auto_analyze_service.analyze_folder(
            folder_path=req.folder_path,
            api_key=req.api_key,
            custom_prompt=req.custom_prompt
        )
        return {"status": "success", "scripts": scripts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


