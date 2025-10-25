import os
import subprocess
import json
from backend.models.schemas import DownloadRequest
from backend.core.job_manager import job_manager

CLI_TOOL_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'utilities', 'Instagram-CLI-Downloader')
HEADLESS_SCRIPT = os.path.join(CLI_TOOL_DIR, 'headless.js')


class InstagramService:
    @staticmethod
    def process_download(job_id: str, req: DownloadRequest):
        # Extract handle from URL if user pasted a full link
        handle = req.handle.strip().strip("/")
        if "instagram.com/" in handle:
            handle = handle.split("instagram.com/")[-1].split("/")[0].split("?")[0]

        job_manager.update_job(job_id, status="downloading", progress="Launching browser session...")

        try:
            # Build media type selection
            types = []
            if req.download_reels:
                types.extend(["reels", "videos"])
            if req.download_posts:
                types.extend(["photos", "carousels"])
            if req.download_metadata:
                types.append("thumbnails")
            if not types:
                types = ["all"]

            type_arg = ",".join(types)

            # Build command
            cmd = [
                "node",
                HEADLESS_SCRIPT,
                "--username", handle,
                "--types", type_arg,
                "--output", req.download_path,
            ]

            if req.download_captions:
                cmd.append("--captions")

            job_manager.update_job(job_id, progress=f"Scanning profile @{handle}...")

            # Run the headless script as a subprocess
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                cwd=CLI_TOOL_DIR,
            )

            download_count = 0
            zip_path = None
            captions_path = None

            # Stream stdout line by line for real-time progress
            for line in process.stdout:
                line = line.strip()
                if not line:
                    continue

                if line.startswith("PROGRESS:"):
                    try:
                        data = json.loads(line[len("PROGRESS:"):])
                        msg = data.get("message", "Processing...")
                        job_manager.update_job(job_id, progress=msg)
                    except json.JSONDecodeError:
                        pass

                elif line.startswith("RESULT:"):
                    try:
                        data = json.loads(line[len("RESULT:"):])
                        download_count = data.get("downloadCount", 0)
                        zip_path = data.get("zipPath")
                        captions_path = data.get("captionsPath")
                        msg = data.get("message", "Done")
                        job_manager.update_job(job_id, progress=msg)
                        if captions_path:
                            job_manager.update_job(job_id, captions_path=captions_path)
                    except json.JSONDecodeError:
                        pass

                elif line.startswith("ERROR:"):
                    try:
                        data = json.loads(line[len("ERROR:"):])
                        error_msg = data.get("message", "Unknown error")
                        job_manager.update_job(job_id, status="error", progress="Failed", error=error_msg)
                        process.wait()
                        return
                    except json.JSONDecodeError:
                        pass

            # Wait for process to finish
            process.wait()

            if process.returncode != 0:
                stderr_output = process.stderr.read() if process.stderr else ""
                job_manager.update_job(
                    job_id,
                    status="error",
                    progress="Failed",
                    error=f"Process exited with code {process.returncode}. {stderr_output[:500]}"
                )
                return

            # Success
            result_msg = f"Completed. Downloaded {download_count} items."
            if zip_path:
                result_msg += f" ZIP: {zip_path}"
            if captions_path:
                result_msg += f" Captions: {captions_path}"

            job_manager.update_job(job_id, status="completed", progress=result_msg)

        except Exception as e:
            job_manager.update_job(job_id, status="error", progress="Failed", error=str(e))


instagram_service = InstagramService()
