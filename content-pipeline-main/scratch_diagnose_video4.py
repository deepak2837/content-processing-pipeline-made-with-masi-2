import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))
from backend.services.video_editor_service import video_editor_service
import subprocess

folder = "/home/unknown/Documents/for masi/outputs"

# Let's intercept subprocess.run to print the exact command!
original_run = subprocess.run

def mock_run(cmd, **kwargs):
    print(f"RUNNING: {' '.join(cmd)}")
    res = original_run(cmd, **kwargs)
    if res.returncode != 0:
        print(f"FAILED WITH {res.returncode}:\n{res.stderr}")
    return res

subprocess.run = mock_run

job_id = "test_err_job_intercept"
video_editor_service.create_job(job_id, folder)
settings = {
    "resize_mode": "fill",
    "target_width": 1080,
    "target_height": 1080,
    "color_bars_enabled": True,
    "bar_color": "#FFFFFF",
    "bar_position": "both",
    "output_subfolder": "processed",
    "quality": "high",
    "audio_enabled": True
}

video_editor_service.process_videos(job_id, folder, settings)
