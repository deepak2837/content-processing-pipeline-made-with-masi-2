import os
import json
import uuid
import time
import asyncio
import threading
from datetime import datetime
import requests
import urllib3

SCHEDULER_DB_PATH = os.path.expanduser("~/Documents/content-pipeline/backend/data/scheduler_jobs.json")

class SchedulerService:
    def __init__(self):
        os.makedirs(os.path.dirname(SCHEDULER_DB_PATH), exist_ok=True)
        self.jobs = self._load_jobs()
        self.worker_thread = None
        self.running = False
        self.start_background_worker()

    def _load_jobs(self) -> dict:
        if os.path.exists(SCHEDULER_DB_PATH):
            try:
                with open(SCHEDULER_DB_PATH, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                return {}
        return {}

    def _save_jobs(self):
        try:
            with open(SCHEDULER_DB_PATH, "w", encoding="utf-8") as f:
                json.dump(self.jobs, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"Error saving scheduler DB: {str(e)}")

    def start_background_worker(self):
        if self.worker_thread and self.worker_thread.is_alive():
            return
        self.running = True
        self.worker_thread = threading.Thread(target=self._scheduler_loop, daemon=True)
        self.worker_thread.start()

    def stop_background_worker(self):
        self.running = False

    def _scheduler_loop(self):
        """Infinite loop checking for due scheduled posts every 10 seconds."""
        while self.running:
            try:
                now_str = datetime.now().isoformat()
                changed = False
                
                for job_id, job in list(self.jobs.items()):
                    if job["status"] == "scheduled" and job["scheduled_time"] <= now_str:
                        # Mark as processing
                        job["status"] = "posting"
                        job["progress"] = "Initiating automated API distribution..."
                        self._save_jobs()
                        changed = True
                        
                        # Trigger posting in a separate worker thread to avoid blocking loop
                        threading.Thread(target=self._post_worker, args=(job_id,), daemon=True).start()
                
                if changed:
                    self._save_jobs()
            except Exception as e:
                print(f"Scheduler loop error: {str(e)}")
            time.sleep(10)

    def _post_worker(self, job_id: str):
        """Performs actual posting/uploading to active social APIs."""
        job = self.jobs.get(job_id)
        if not job:
            return

        try:
            platforms = job.get("platforms", [])
            video_path = job.get("video_path")
            caption = job.get("caption", "")
            credentials = job.get("credentials", {})
            use_simulated = credentials.get("use_simulated", True)

            results = {}
            errors = []

            for platform in platforms:
                job["progress"] = f"Posting to {platform.capitalize()}..."
                self._save_jobs()
                
                if use_simulated:
                    # Simulated execution loop with realistic steps for instant testing
                    time.sleep(2)
                    results[platform] = "success"
                else:
                    # Real Direct API Publishing
                    if platform == "instagram":
                        success, err = self._post_to_instagram(video_path, caption, credentials)
                        results[platform] = "success" if success else "failed"
                        if err: errors.append(f"Instagram: {err}")
                    elif platform == "facebook":
                        success, err = self._post_to_facebook(video_path, caption, credentials)
                        results[platform] = "success" if success else "failed"
                        if err: errors.append(f"Facebook: {err}")
                    elif platform == "youtube":
                        success, err = self._post_to_youtube(video_path, caption, credentials)
                        results[platform] = "success" if success else "failed"
                        if err: errors.append(f"YouTube: {err}")

            # Update final job state
            failed_platforms = [p for p, res in results.items() if res == "failed"]
            
            if failed_platforms:
                job["status"] = "failed"
                job["progress"] = f"Failed to post to: {', '.join(failed_platforms)}"
                job["error"] = "; ".join(errors) if errors else "API Connection Error"
            else:
                job["status"] = "posted"
                job["progress"] = "Successfully published to all scheduled channels!"
                job["posted_time"] = datetime.now().isoformat()
            
            self._save_jobs()

        except Exception as e:
            job["status"] = "failed"
            job["error"] = f"Posting crashed: {str(e)}"
            self._save_jobs()

    # ── Meta Graph API (Instagram & Facebook Reels) ─────────────────
    
    def _post_to_instagram(self, video_path: str, caption: str, credentials: dict) -> tuple:
        """Publishes Reel directly to Instagram Business account via Meta Graph API."""
        access_token = credentials.get("meta_access_token")
        ig_account_id = credentials.get("instagram_business_id")
        video_url = credentials.get("public_video_url") # Meta requires a publicly reachable URL to ingest video

        if not access_token or not ig_account_id or not video_url:
            return False, "Missing Meta credentials or public video URL"

        try:
            # 1. Initialize Reel upload container
            url = f"https://graph.facebook.com/v19.0/{ig_account_id}/media"
            payload = {
                "media_type": "REELS",
                "video_url": video_url,
                "caption": caption,
                "access_token": access_token
            }
            res = requests.post(url, json=payload, timeout=20)
            if res.status_code != 200:
                return False, f"Container creation failed: {res.text}"
            
            container_id = res.json().get("id")

            # 2. Wait/Poll for video ingestion completion
            status_url = f"https://graph.facebook.com/v19.0/{container_id}"
            params = {"fields": "status_code", "access_token": access_token}
            
            for _ in range(12): # Poll up to 2 minutes
                time.sleep(10)
                status_res = requests.get(status_url, params=params, timeout=10)
                if status_res.status_code == 200:
                    status = status_res.json().get("status_code")
                    if status == "FINISHED":
                        break
                    elif status == "ERROR":
                        return False, "Meta encoding error"
            
            # 3. Publish Reel container live
            publish_url = f"https://graph.facebook.com/v19.0/{ig_account_id}/media_publish"
            publish_payload = {
                "creation_id": container_id,
                "access_token": access_token
            }
            pub_res = requests.post(publish_url, json=publish_payload, timeout=20)
            return pub_res.status_code == 200, None if pub_res.status_code == 200 else pub_res.text

        except Exception as e:
            return False, str(e)

    def _post_to_facebook(self, video_path: str, caption: str, credentials: dict) -> tuple:
        """Publishes Reel directly to Facebook Page via Meta Graph API."""
        access_token = credentials.get("meta_access_token")
        page_id = credentials.get("facebook_page_id")
        video_url = credentials.get("public_video_url")

        if not access_token or not page_id or not video_url:
            return False, "Missing Meta Page credentials or public video URL"

        try:
            # Initialize FB Reel container upload
            url = f"https://graph.facebook.com/v19.0/{page_id}/video_reels"
            payload = {
                "upload_phase": "start",
                "access_token": access_token
            }
            res = requests.post(url, json=payload, timeout=20)
            if res.status_code != 200:
                return False, f"FB Reel start failed: {res.text}"
            
            res_data = res.json()
            video_id = res_data.get("video_id")
            
            # FB supports direct URL source uploading
            # Note: Production FB Graph uses chunked uploading, but direct url source is supported in v19.0+
            publish_url = f"https://graph.facebook.com/v19.0/{page_id}/video_reels"
            publish_payload = {
                "upload_phase": "finish",
                "video_id": video_id,
                "video_state": "PUBLISHED",
                "description": caption,
                "access_token": access_token
            }
            pub_res = requests.post(publish_url, json=publish_payload, timeout=20)
            return pub_res.status_code == 200, None if pub_res.status_code == 200 else pub_res.text

        except Exception as e:
            return False, str(e)

    # ── YouTube Data API v3 ───────────────────────────────
    
    def _post_to_youtube(self, video_path: str, caption: str, credentials: dict) -> tuple:
        """Uploads video directly to YouTube using direct HTTP client auth."""
        access_token = credentials.get("youtube_access_token")
        if not access_token:
            return False, "Missing Google YouTube Access Token"

        try:
            # 1. Start YouTube resumable upload session
            url = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status"
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json; charset=UTF-8",
                "X-Upload-Content-Type": "video/mp4",
                "X-Upload-Content-Length": str(os.path.getsize(video_path))
            }
            
            metadata = {
                "snippet": {
                    "title": caption[:99] if caption else "AI Narration Reel",
                    "description": caption,
                    "categoryId": "22" # People & Blogs
                },
                "status": {
                    "privacyStatus": "public",
                    "selfDeclaredMadeForKids": False
                }
            }

            res = requests.post(url, headers=headers, json=metadata, timeout=20)
            if res.status_code != 200:
                return False, f"Upload session failed: {res.text}"
            
            upload_url = res.headers.get("Location")

            # 2. Stream upload binary payload
            with open(video_path, "rb") as vf:
                up_res = requests.put(upload_url, data=vf, headers={"Content-Type": "video/mp4"}, timeout=300)
                
            return up_res.status_code in {200, 201}, None if up_res.status_code in {200, 201} else up_res.text

        except Exception as e:
            return False, str(e)

    # ── Job Management Actions ────────────────────────────
    
    def schedule_post(self, video_path: str, caption: str, scheduled_time: str, platforms: list, credentials: dict) -> dict:
        job_id = str(uuid.uuid4())
        job = {
            "id": job_id,
            "video_name": os.path.basename(video_path),
            "video_path": video_path,
            "caption": caption,
            "scheduled_time": scheduled_time,
            "platforms": platforms,
            "status": "scheduled",
            "progress": "Pending scheduled execution time...",
            "error": None,
            "created_at": datetime.now().isoformat(),
            "credentials": credentials
        }
        self.jobs[job_id] = job
        self._save_jobs()
        return job

    def list_queue(self) -> list:
        return list(self.jobs.values())

    def cancel_job(self, job_id: str) -> bool:
        if job_id in self.jobs:
            if self.jobs[job_id]["status"] == "scheduled":
                self.jobs[job_id]["status"] = "cancelled"
                self.jobs[job_id]["progress"] = "Cancelled by user"
                self._save_jobs()
                return True
        return False

    def trigger_immediate_post(self, job_id: str) -> bool:
        if job_id in self.jobs:
            job = self.jobs[job_id]
            job["status"] = "posting"
            job["progress"] = "Manually executing post immediately..."
            self._save_jobs()
            threading.Thread(target=self._post_worker, args=(job_id,), daemon=True).start()
            return True
        return False

scheduler_service = SchedulerService()
