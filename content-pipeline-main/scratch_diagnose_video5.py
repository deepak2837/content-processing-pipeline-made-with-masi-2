import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))
from backend.services.video_editor_service import video_editor_service

folder = "/home/unknown/Documents/for masi/outputs"

# Let's run just #lyricsvideo to see what happens
job_id = "test_err_vp9"
video_editor_service.create_job(job_id, folder)
settings = {
    "resize_mode": "fill",
    "target_width": 1080,
    "target_height": 1080,
    "color_bars_enabled": True,
    "bar_color": "#FFFFFF",
    "bar_position": "both",
    "output_subfolder": "processed",
}

# temporarily filter video_files to only lyricsvideo
original_listdir = os.listdir
def mock_listdir(p):
    return [f for f in original_listdir(p) if "lyricsvideo" in f]
os.listdir = mock_listdir

# hook update_job to write to file
original_update = video_editor_service.update_job
def mock_update(jid, **kwargs):
    with open("error_log.txt", "a") as f:
        f.write(str(kwargs) + "\n")
    original_update(jid, **kwargs)
video_editor_service.update_job = mock_update

video_editor_service.process_videos(job_id, folder, settings)
