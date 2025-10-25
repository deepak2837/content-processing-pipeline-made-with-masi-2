import os
import sys

# Add backend to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

from backend.services.video_editor_service import video_editor_service

folder = "/home/unknown/Documents/for masi/outputs"

# Create a job
job = video_editor_service.create_job("test_job", folder)

# Run process
settings = {
    "resize_mode": "fill",
    "target_width": 1080,
    "target_height": 1920,
    "color_bars_enabled": True,
    "bar_color": "#000000",
    "bar_position": "both",
    "output_subfolder": "processed"
}

video_editor_service.process_videos("test_job", folder, settings)

job = video_editor_service.get_job("test_job")
print(job)
