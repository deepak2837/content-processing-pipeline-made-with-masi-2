import subprocess
import os

video_path = "/Users/masi/Documents/newreels/DJ_zlrmSdKN.mp4"
out_img = "/Users/masi/Documents/newreels/test_frame.jpg"

if os.path.exists(out_img):
    try: os.remove(out_img)
    except: pass

ff_cmd = [
    "ffmpeg", "-y",
    "-ss", "00:00:01",
    "-i", video_path,
    "-vframes", "1",
    "-q:v", "4",
    out_img
]

print("Running command:", " ".join(ff_cmd))
try:
    res = subprocess.run(ff_cmd, capture_output=True, text=True, timeout=10)
    print("Return code:", res.returncode)
    print("Stdout:", res.stdout)
    print("Stderr:", res.stderr)
    print("Output file exists:", os.path.exists(out_img))
except Exception as e:
    print("Exception running ffmpeg:", str(e))
