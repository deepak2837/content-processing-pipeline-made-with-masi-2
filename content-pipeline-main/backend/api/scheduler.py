from fastapi import APIRouter, HTTPException
from backend.models.schemas import SchedulerRequest
from backend.services.scheduler_service import scheduler_service

router = APIRouter()

@router.post("/scheduler/schedule")
def schedule_post(req: SchedulerRequest):
    if not req.video_path:
        raise HTTPException(status_code=400, detail="Video file path is required")
    if not req.platforms:
        raise HTTPException(status_code=400, detail="At least one target social platform is required")
    if not req.scheduled_time:
        raise HTTPException(status_code=400, detail="Scheduled posting time is required")

    job = scheduler_service.schedule_post(
        video_path=req.video_path,
        caption=req.caption,
        scheduled_time=req.scheduled_time,
        platforms=req.platforms,
        credentials=req.credentials.model_dump()
    )
    return job

@router.get("/scheduler/queue")
def list_queue():
    return scheduler_service.list_queue()

@router.post("/scheduler/cancel/{job_id}")
def cancel_job(job_id: str):
    success = scheduler_service.cancel_job(job_id)
    if not success:
        raise HTTPException(status_code=404, detail="Job not found or already executed")
    return {"message": "Job successfully cancelled"}

@router.post("/scheduler/post-now/{job_id}")
def post_now(job_id: str):
    success = scheduler_service.trigger_immediate_post(job_id)
    if not success:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"message": "Job triggered for immediate posting"}
