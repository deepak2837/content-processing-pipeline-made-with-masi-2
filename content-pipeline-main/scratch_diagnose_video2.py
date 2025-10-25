import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))
from backend.services.video_editor_service import video_editor_service

folder = "/home/unknown/Documents/for masi/outputs"

# Let's call process_videos with the exact same files and default settings 
# to see what stderr ffmpeg throws.
job_id = "test_err_job"
video_editor_service.create_job(job_id, folder)
settings = {
    "resize_mode": "fill",
    "target_width": 1080,
    "target_height": 1080,
    "color_bars_enabled": False,
    "bar_color": "#FFFFFF",
    "bar_position": "both",
    "output_subfolder": "processed",
    "watermark_enabled": False,
    "watermark_text": "testing"
}

# we'll patch the update_job to just print the warning
original_update = video_editor_service.update_job
def mock_update(jid, **kwargs):
    if "progress" in kwargs and "Warning" in kwargs["progress"]:
        print("ERROR_CAUGHT:", kwargs["progress"])
    original_update(jid, **kwargs)

video_editor_service.update_job = mock_update

video_editor_service.process_videos(job_id, folder, settings)
