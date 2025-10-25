import os
import base64
import json
import subprocess
import urllib.request
import urllib.error

SUPPORTED_VIDEO_EXTENSIONS = {'.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'}

class AutoAnalyzeService:
    def _extract_frames(self, video_path: str, temp_dir: str, num_frames: int = 3) -> list:
        """Extract keyframes from the video using ffmpeg at fixed timestamps to avoid ffprobe dependencies."""
        os.makedirs(temp_dir, exist_ok=True)
        filename = os.path.basename(video_path)
        video_slug = os.path.splitext(filename)[0]

        frames = []
        # Attempt fixed timestamps (1s, 3s, 5s) depending on requested number of frames
        timestamps = ["00:00:01", "00:00:03", "00:00:05"][:num_frames]

        for idx, ts in enumerate(timestamps):
            out_img = os.path.join(temp_dir, f"{video_slug}_frame_{idx}.jpg")
            # Clean up any stale frame from previous run
            if os.path.exists(out_img):
                try:
                    os.remove(out_img)
                except Exception:
                    pass

            # Extract single frame at timestamp ts
            ff_cmd = [
                "ffmpeg", "-y",
                "-ss", ts,
                "-i", video_path,
                "-vframes", "1",
                "-q:v", "4",
                out_img
            ]
            try:
                subprocess.run(ff_cmd, capture_output=True, timeout=10)
            except Exception:
                pass

            if os.path.exists(out_img):
                frames.append(out_img)

        # Fallback: if no frames extracted (e.g. video is ultra short), try to extract from start
        if not frames:
            out_img = os.path.join(temp_dir, f"{video_slug}_frame_start.jpg")
            ff_cmd = [
                "ffmpeg", "-y",
                "-i", video_path,
                "-vframes", "1",
                "-q:v", "4",
                out_img
            ]
            try:
                subprocess.run(ff_cmd, capture_output=True, timeout=10)
            except Exception:
                pass
            if os.path.exists(out_img):
                frames.append(out_img)

        return frames

    def _call_gemini_api(self, api_key: str, frames: list, system_prompt: str) -> str:
        """Call Gemini API using requests library to avoid macOS SSL certificate issues."""
        import requests
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
        
        parts = [{"text": system_prompt}]
        
        for f in frames:
            try:
                with open(f, "rb") as image_file:
                    b64_data = base64.b64encode(image_file.read()).decode("utf-8")
                parts.append({
                    "inlineData": {
                        "mimeType": "image/jpeg",
                        "data": b64_data
                    }
                })
            except Exception:
                continue

        payload = {
            "contents": [{
                "parts": parts
            }]
        }

        try:
            # Bypassing SSL verification issues on macOS by using verify=False
            import urllib3
            urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
            
            response = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=30, verify=False)
            if response.status_code == 200:
                res_data = response.json()
                text = res_data["candidates"][0]["content"]["parts"][0]["text"]
                return text.strip()
            else:
                try:
                    err_json = response.json()
                    return f"API Error: {err_json['error']['message']}"
                except Exception:
                    return f"API Error: HTTP {response.status_code} - {response.text}"
        except Exception as e:
            return f"Error connecting to Gemini: {str(e)}"

    def _local_analyze(self, filename: str, folder_path: str) -> str:
        """Fallback rule-based script generator using folder metadata / filenames."""
        # Clean file name for natural speech
        clean_name = os.path.splitext(filename)[0]
        clean_name = clean_name.replace("_", " ").replace("-", " ").title()

        # Try to find a captions/metadata JSON file in the folder
        caption_text = None
        for f in os.listdir(folder_path):
            if f.endswith(".json") and not f.startswith("."):
                try:
                    with open(os.path.join(folder_path, f), "r", encoding="utf-8") as jf:
                        data = json.load(jf)
                        # Match shortcode or filename keys precisely
                        if isinstance(data, list):
                            for item in data:
                                sc = item.get("shortcode")
                                if sc and sc in filename:
                                    caption_text = item.get("caption")
                                    break
                                elif item.get("filename") == filename or item.get("name") == filename:
                                    caption_text = item.get("caption") or item.get("description")
                                    break
                        elif isinstance(data, dict):
                            if filename in data:
                                caption_text = data[filename].get("caption") or data[filename].get("description")
                            elif os.path.splitext(filename)[0] in data:
                                fn_no_ext = os.path.splitext(filename)[0]
                                caption_text = data[fn_no_ext].get("caption") or data[fn_no_ext].get("description")
                            else:
                                if os.path.splitext(f)[0] == os.path.splitext(filename)[0]:
                                    caption_text = data.get("caption") or data.get("description")
                except Exception:
                    pass
            if caption_text:
                break

        if caption_text:
            # Clean caption text (remove tags, mentions, limit to 2 sentences)
            sentences = [s.strip() for s in caption_text.split(".") if s.strip()]
            short_desc = ". ".join(sentences[:2])
            return f"Check out this content: {short_desc}. Hope you guys enjoy this update!"

        return f"Hey everyone! Welcome back. Today we are looking at this awesome clip titled {clean_name}. Take a look and let me know your thoughts in the comments below!"

    def analyze_folder(self, folder_path: str, api_key: str = None, custom_prompt: str = None) -> dict:
        """Analyze all videos in the folder and return generated scripts."""
        results = {}
        if not os.path.isdir(folder_path):
            return results

        video_files = [
            f for f in sorted(os.listdir(folder_path))
            if os.path.splitext(f)[1].lower() in SUPPORTED_VIDEO_EXTENSIONS
        ]

        # Use system prompt for video analysis
        default_prompt = (
            "Analyze these frames from a video clip. Generate a very short, engaging, natural voiceover "
            "script (2 sentences max) describing what is happening or welcoming the audience. Do not use emojis. "
            "Do not start with 'in this video' or 'this clip shows'. Write directly as if you are the host speaking."
        )
        prompt = custom_prompt if custom_prompt else default_prompt

        temp_dir = os.path.join(folder_path, ".temp_analysis")

        for f in video_files:
            video_path = os.path.join(folder_path, f)
            if api_key:
                # Multimodal AI analysis
                try:
                    frames = self._extract_frames(video_path, temp_dir, num_frames=2)
                    if frames:
                        script = self._call_gemini_api(api_key, frames, prompt)
                        results[f] = script
                    else:
                        results[f] = self._local_analyze(f, folder_path)
                except Exception as e:
                    results[f] = f"Error during AI analysis: {str(e)}. Fallback: {self._local_analyze(f, folder_path)}"
            else:
                # Fallback rule-based local script generator
                results[f] = self._local_analyze(f, folder_path)

        # Clean up temp frames
        try:
            import shutil
            shutil.rmtree(temp_dir, ignore_errors=True)
        except Exception:
            pass

        return results

auto_analyze_service = AutoAnalyzeService()
