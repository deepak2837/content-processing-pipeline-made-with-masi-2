from typing import Dict, Any

class JobManager:
    def __init__(self):
        self.jobs: Dict[str, Any] = {}

    def create_job(self, job_id: str, handle: str) -> Dict[str, Any]:
        self.jobs[job_id] = {
            "id": job_id,
            "handle": handle,
            "status": "pending",
            "progress": "Starting...",
            "error": None,
            "captions_path": None
        }
        return self.jobs[job_id]

    def update_job(self, job_id: str, status: str = None, progress: str = None, error: str = None, captions_path: str = None):
        if job_id in self.jobs:
            if status is not None:
                self.jobs[job_id]["status"] = status
            if progress is not None:
                self.jobs[job_id]["progress"] = progress
            if error is not None:
                self.jobs[job_id]["error"] = error
            if captions_path is not None:
                self.jobs[job_id]["captions_path"] = captions_path

    def get_job(self, job_id: str):
        return self.jobs.get(job_id)

    def get_all_jobs(self):
        return list(self.jobs.values())

job_manager = JobManager()
