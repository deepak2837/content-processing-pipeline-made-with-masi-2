import os
import uuid
import subprocess

SUPPORTED_VIDEO_EXTENSIONS = {'.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'}

class WatermarkService:
    def __init__(self):
        self.jobs = {}

    def create_job(self, job_id: str, folder_path: str) -> dict:
        job = {
            "id": job_id,
            "folder_path": folder_path,
            "status": "pending",
            "total_files": 0,
            "processed_files": 0,
            "current_file": None,
            "progress": "Initializing...",
            "error": None,
            "output_files": []
        }
        self.jobs[job_id] = job
        return job

    def get_job(self, job_id: str) -> dict:
        return self.jobs.get(job_id)

    def get_all_jobs(self) -> list:
        return list(self.jobs.values())

    def update_job(self, job_id: str, **kwargs):
        if job_id in self.jobs:
            self.jobs[job_id].update(kwargs)

    def _apply_watermark(self, video_path: str, logo_path: str, output_path: str, settings: dict) -> tuple:
        """Apply watermark overlay onto video using FFmpeg filter complex."""
        if os.path.exists(output_path):
            try: os.remove(output_path)
            except: pass

        watermark_mode = settings.get("watermark_mode", "logo")
        position = settings.get("position", "bottom-right")
        width_scale = settings.get("width_scale", 150) # Scale width of logo
        opacity = settings.get("opacity", 0.5) # Logo opacity (0.1 to 1.0)
        margin = settings.get("margin", 20)

        if watermark_mode == "frame":
            # Full Screen Frame Mode: scale frame logo to match exactly the main video dimension and overlay at 0:0
            filter_complex = (
                f"[1:v][0:v]scale2ref=w=iw:h=ih[logo][main];"
                f"[logo]format=rgba,colorchannelmixer=aa={opacity}[logo_trans];"
                f"[main][logo_trans]overlay=0:0"
            )
        else:
            # Standard Corner Logo Mode
            if position == "top-left":
                overlay_str = f"{margin}:{margin}"
            elif position == "top-right":
                overlay_str = f"W-w-{margin}:{margin}"
            elif position == "bottom-left":
                overlay_str = f"{margin}:H-h-{margin}"
            elif position == "center":
                overlay_str = f"(W-w)/2:(H-h)/2"
            else: # default bottom-right
                overlay_str = f"W-w-{margin}:H-h-{margin}"

            filter_complex = (
                f"[1:v]scale={width_scale}:-1,format=rgba,"
                f"colorchannelmixer=aa={opacity}[logo];"
                f"[0:v][logo]overlay={overlay_str}"
            )

        cmd = [
            "ffmpeg", "-y",
            "-i", video_path,
            "-i", logo_path,
            "-filter_complex", filter_complex,
            "-c:v", "libx264", "-preset", "fast", "-crf", "23",
            "-c:a", "aac", "-b:a", "192k",
            output_path
        ]

        try:
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
            return (os.path.exists(output_path) and os.path.getsize(output_path) > 0, res.stderr)
        except Exception as e:
            return (False, str(e))

    def process_watermarks(self, job_id: str, folder_path: str, logo_path: str, settings: dict):
        """Execute watermark overlay processing on all videos in folder (background thread)."""
        try:
            video_files = [
                f for f in sorted(os.listdir(folder_path))
                if os.path.splitext(f)[1].lower() in SUPPORTED_VIDEO_EXTENSIONS
            ]

            if not video_files:
                self.update_job(job_id, status="error", error="No video files found in folder")
                return

            self.update_job(
                job_id,
                status="processing",
                total_files=len(video_files),
                progress=f"Found {len(video_files)} video(s)",
            )

            output_subfolder = settings.get("output_subfolder", "with_watermark")
            output_dir = os.path.join(folder_path, output_subfolder)
            os.makedirs(output_dir, exist_ok=True)

            succeeded = 0
            generated_files = []

            for i, filename in enumerate(video_files):
                input_path = os.path.join(folder_path, filename)
                output_filename = f"{os.path.splitext(filename)[0]}.mp4"
                output_path = os.path.join(output_dir, output_filename)

                self.update_job(
                    job_id,
                    current_file=filename,
                    progress=f"Applying watermark to {filename} ({i + 1}/{len(video_files)})",
                    processed_files=i,
                )

                success, stderr = self._apply_watermark(input_path, logo_path, output_path, settings)

                if success:
                    succeeded += 1
                    generated_files.append({
                        "name": filename,
                        "path": output_path,
                        "size": os.path.getsize(output_path) if os.path.exists(output_path) else 0
                    })
                else:
                    self.update_job(
                        job_id,
                        progress=f"⚠️ Failed to apply watermark on {filename}. Error: {str(stderr)[:100]}",
                    )

            if succeeded > 0:
                self.update_job(
                    job_id,
                    status="completed",
                    progress=f"Successfully watermarked {succeeded}/{len(video_files)} video(s)!",
                    output_files=generated_files
                )
            else:
                self.update_job(
                    job_id,
                    status="error",
                    error="Failed to apply watermark on all videos"
                )

        except Exception as e:
            self.update_job(job_id, status="error", error=f"Job crashed: {str(e)}")

watermark_service = WatermarkService()
