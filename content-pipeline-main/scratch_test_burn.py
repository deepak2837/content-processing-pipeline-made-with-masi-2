import os
from backend.services.subtitle_service import subtitle_service

video_path = "/home/unknown/Documents/for masi/outputs/#trend [-uTeYhvpVKI].webm"
srt_path = "/home/unknown/Documents/for masi/outputs/.temp_test.srt"
output_path = "/home/unknown/Documents/for masi/outputs/.temp_test.mp4"

with open(srt_path, "w") as f:
    f.write("1\n00:00:01,000 --> 00:00:05,000\nHello World\n")

success, stderr = subtitle_service._burn_subtitles(video_path, srt_path, output_path, {})
print("Success:", success)
if not success:
    print("Stderr:", stderr)
