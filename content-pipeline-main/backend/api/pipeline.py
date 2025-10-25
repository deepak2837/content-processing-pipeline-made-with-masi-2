from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from backend.services.pipeline_service import pipeline_service

router = APIRouter()

class PipelineSubtitlesStyling(BaseModel):
    font_size: int = 16
    font_color: str = "&H00FFFFFF"
    outline_color: str = "&H00000000"
    outline_width: int = 2
    alignment: int = 2

class PipelineStartRequest(BaseModel):
    handle: str
    gemini_api_key: Optional[str] = ""
    download_reels: bool = True
    download_posts: bool = False
    download_captions: bool = True
    local_folder_override: Optional[str] = ""
    voice: str = "en-US-AriaNeural"
    audio_mode: str = "replace"
    custom_prompt: Optional[str] = ""
    rate: int = 0
    volume: int = 0
    subtitles_styling: PipelineSubtitlesStyling = PipelineSubtitlesStyling()
    watermark_mode: str = "logo"
    watermark_logo_path: Optional[str] = ""
    watermark_position: str = "bottom-right"
    watermark_width: int = 150
    watermark_opacity: float = 0.5
    watermark_margin: int = 20
    platforms: list[str] = ["instagram"]
    use_simulated: bool = True
    meta_access_token: Optional[str] = ""
    instagram_business_id: Optional[str] = ""
    facebook_page_id: Optional[str] = ""
    youtube_access_token: Optional[str] = ""
    public_video_url: Optional[str] = ""

@router.post("/pipeline/start")
def start_pipeline(req: PipelineStartRequest):
    if not req.handle:
        raise HTTPException(status_code=400, detail="Instagram handle is required")
    
    run = pipeline_service.create_run(req.handle, req.model_dump())
    pipeline_service.start_pipeline(run["id"])
    return run

@router.get("/pipeline/jobs")
def get_all_runs():
    return pipeline_service.get_all_runs()

@router.get("/pipeline/status/{run_id}")
def get_run_status(run_id: str):
    run = pipeline_service.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Pipeline run not found")
    return run
