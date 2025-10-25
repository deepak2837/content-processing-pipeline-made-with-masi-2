import os
import uuid
import asyncio
import threading
import subprocess
import base64
import json
import requests
import urllib3

SUPPORTED_VIDEO_EXTENSIONS = {'.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'}

class SubtitleService:
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

    def _extract_audio(self, video_path: str, audio_path: str) -> bool:
        """Extract audio from video file to a high-compatibility MP3 format."""
        if os.path.exists(audio_path):
            try: os.remove(audio_path)
            except: pass

        cmd = [
            "ffmpeg", "-y",
            "-i", video_path,
            "-vn", # Disable video
            "-acodec", "libmp3lame",
            "-ar", "22050", # Low sample rate for fast upload
            "-ac", "1", # Mono
            "-ab", "64k", # Low bitrate for small size
            audio_path
        ]
        try:
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            if not (os.path.exists(audio_path) and os.path.getsize(audio_path) > 0):
                return False, res.stderr
            return True, ""
        except Exception as e:
            return False, str(e)

    def _generate_srt_gemini(self, api_key: str, audio_path: str) -> str:
        """Upload audio to Gemini and request standard SRT formatted subtitles."""
        # Using production stable v1beta endpoint with 2.5-flash
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
        
        try:
            with open(audio_path, "rb") as af:
                b64_data = base64.b64encode(af.read()).decode("utf-8")
        except Exception as e:
            return f"Error reading audio file: {str(e)}"

        prompt = (
            "Transcribe this audio file and return a standard SRT subtitle file. "
            "Timestamps must be extremely precise and STRICTLY follow the format HH:MM:SS,mmm (hours:minutes:seconds,milliseconds). "
            "For example: 00:01:23,450 --> 00:01:25,120. Do NOT use MM:SS:mmm or other formats. "
            "Format strictly as standard SRT (e.g., index, timestamp range, and subtitle text). "
            "Do NOT wrap the output in markdown code blocks like ```srt or ```. "
            "Return only the raw SRT content, and absolutely no other text."
        )

        payload = {
            "contents": [{
                "parts": [
                    {"text": prompt},
                    {
                        "inlineData": {
                            "mimeType": "audio/mpeg", # Standard MIME type for MP3
                            "data": b64_data
                        }
                    }
                ]
            }]
        }

        try:
            urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
            response = requests.post(
                url, 
                json=payload, 
                headers={"Content-Type": "application/json"}, 
                timeout=60, 
                verify=False
            )
            if response.status_code == 200:
                res_data = response.json()
                text = res_data["candidates"][0]["content"]["parts"][0]["text"]
                # Clean up any potential markdown wraps
                text = text.replace("```srt", "").replace("```", "").strip()
                import re
                
                def fix_timestamp(m):
                    s = m.group(0).replace('.', ',')
                    parts = s.replace(',', ':').split(':')
                    if len(parts) == 3: # MM:SS:mmm
                        return f"00:{parts[0]}:{parts[1]},{parts[2]}"
                    elif len(parts) == 4: # HH:MM:SS:mmm
                        return f"{parts[0]}:{parts[1]}:{parts[2]},{parts[3]}"
                    return m.group(0)

                # Fix timestamps
                text = re.sub(r'\d{2,}:\d{2}:\d{2,}[.,:]\d{2,}', fix_timestamp, text)
                
                # Extract valid SRT blocks to ignore conversational text
                # An SRT block is: Number, then timestamp line, then text lines, then blank line
                # But a simple regex to just find the first block and everything after it is easier:
                match = re.search(r'(?m)^\d+\s*\n\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}', text)
                if match:
                    text = text[match.start():]
                
                # Ensure it ends with a newline
                return text.strip() + "\n"
            else:
                try:
                    err_json = response.json()
                    return f"API Error: {err_json['error']['message']}"
                except Exception:
                    return f"API Error: HTTP {response.status_code} - {response.text}"
        except Exception as e:
            return f"Error connecting to Gemini: {str(e)}"

    def _burn_subtitles(self, video_path: str, srt_path: str, output_path: str, styling: dict) -> tuple:
        """Burn subtitles into the video file using FFmpeg subtitles filter with styling."""
        if os.path.exists(output_path):
            try: os.remove(output_path)
            except: pass

        # Get style attributes
        font_size = styling.get("font_size", 16)
        # FFmpeg force_style uses BGR hex format instead of standard RGB hex format:
        # e.g., standard red RGB #FF0000 becomes &H000000FF& in ASS/FFmpeg style!
        # Let's map standard colors for simplicity
        color_hex = styling.get("color", "#FFFFFF").replace("#", "")
        # Convert RGB to BGR
        if len(color_hex) == 6:
            color_bgr = color_hex[4:6] + color_hex[2:4] + color_hex[0:2]
        else:
            color_bgr = "FFFFFF"
            
        outline_hex = styling.get("outline_color", "#000000").replace("#", "")
        if len(outline_hex) == 6:
            outline_bgr = outline_hex[4:6] + outline_hex[2:4] + outline_hex[0:2]
        else:
            outline_bgr = "000000"

        alignment = styling.get("alignment", 2) # 2 = Bottom Center
        margin_v = styling.get("margin_v", 15)

        # Style string
        style_str = (
            f"FontSize={font_size},PrimaryColour=&H00{color_bgr}&,"
            f"OutlineColour=&H00{outline_bgr}&,Alignment={alignment},MarginV={margin_v}"
        )

        # FFmpeg requires paths with backslashes escaped and colons handled carefully on windows/mac
        # The easiest, most bulletproof way to handle subtitle paths in FFmpeg is to use the absolute path 
        # but escape backslashes and single quotes.
        escaped_srt_path = srt_path.replace("\\", "/").replace(":", "\\:").replace("'", "'\\''")

        cmd = [
            "ffmpeg", "-y",
            "-i", video_path,
            "-vf", f"subtitles='{escaped_srt_path}':force_style='{style_str}'",
            "-c:v", "libx264", "-preset", "fast", "-crf", "23",
            "-c:a", "aac", "-b:a", "192k",
            output_path
        ]

        try:
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
            return (os.path.exists(output_path) and os.path.getsize(output_path) > 0, res.stderr)
        except Exception as e:
            return (False, str(e))

    def process_subtitles(self, job_id: str, folder_path: str, api_key: str, styling: dict):
        """Perform end-to-end speech-to-subtitle extraction and burning in a background thread."""
        if not api_key:
            api_key = os.environ.get("GEMINI_API_KEY", "")
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

            output_subfolder = styling.get("output_subfolder", "with_subtitles")
            output_dir = os.path.join(folder_path, output_subfolder)
            os.makedirs(output_dir, exist_ok=True)

            temp_dir = os.path.join(folder_path, f".temp_subtitles_{job_id}")
            os.makedirs(temp_dir, exist_ok=True)

            succeeded = 0
            generated_files = []

            for i, filename in enumerate(video_files):
                input_path = os.path.join(folder_path, filename)
                output_filename = f"{os.path.splitext(filename)[0]}.mp4"
                output_path = os.path.join(output_dir, output_filename)
                audio_path = os.path.join(temp_dir, f"{os.path.splitext(filename)[0]}.mp3")
                srt_path = os.path.join(temp_dir, f"{os.path.splitext(filename)[0]}.srt")

                self.update_job(
                    job_id,
                    current_file=filename,
                    progress=f"Transcribing audio for {filename} ({i + 1}/{len(video_files)})",
                    processed_files=i,
                )

                # 1. Extract audio
                extracted, extract_err = self._extract_audio(input_path, audio_path)
                if not extracted:
                    self.update_job(job_id, progress=f"⚠️ Failed to extract audio for {filename}. Error: {str(extract_err)[:100]}")
                    continue

                # 2. Call Gemini for SRT
                self.update_job(job_id, progress=f"AI transcribing audio for {filename}...")
                srt_content = self._generate_srt_gemini(api_key, audio_path)

                if "API Error:" in srt_content or "Error connecting" in srt_content:
                    self.update_job(
                        job_id,
                        progress=f"⚠️ Gemini API failed: {srt_content}. Skipping...",
                    )
                    continue

                # Write SRT file
                with open(srt_path, "w", encoding="utf-8") as sf:
                    sf.write(srt_content)

                # 3. Burn subtitles into video
                self.update_job(job_id, progress=f"Burning subtitles onto {filename}...")
                success, stderr = self._burn_subtitles(input_path, srt_path, output_path, styling)

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
                        progress=f"⚠️ Subtitle burn failed for {filename}. Error: {str(stderr)[-200:]}",
                    )

            # Cleanup temp files
            try:
                import shutil
                shutil.rmtree(temp_dir, ignore_errors=True)
            except Exception:
                pass

            if succeeded > 0:
                self.update_job(
                    job_id,
                    status="completed",
                    progress=f"Successfully processed {succeeded}/{len(video_files)} video(s)!",
                    output_files=generated_files
                )
            else:
                self.update_job(
                    job_id,
                    status="error",
                    error="Failed to process subtitles for all videos in folder"
                )

        except Exception as e:
            self.update_job(job_id, status="error", error=f"Job crashed: {str(e)}")

subtitle_service = SubtitleService()
