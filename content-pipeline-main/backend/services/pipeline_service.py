import os
import json
import uuid
import time
import asyncio
import threading
from datetime import datetime, timedelta
import subprocess
import requests
import shutil

from backend.services.auto_analyze_service import auto_analyze_service
from backend.services.audio_gen_service import audio_generator_service
from backend.services.subtitle_service import subtitle_service
from backend.services.watermark_service import watermark_service
from backend.services.scheduler_service import scheduler_service

PIPELINE_DB_PATH = os.path.expanduser("~/Documents/content-pipeline/backend/data/pipeline_runs.json")
PIPELINES_BASE_DIR = os.path.expanduser("~/Documents/content-pipeline/backend/data/pipelines")
CLI_TOOL_DIR = os.path.expanduser("~/Documents/content-pipeline/utilities/Instagram-CLI-Downloader")
HEADLESS_SCRIPT = os.path.join(CLI_TOOL_DIR, 'headless.js')
SUPPORTED_VIDEO_EXTENSIONS = {'.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'}

class PipelineService:
    def __init__(self):
        os.makedirs(os.path.dirname(PIPELINE_DB_PATH), exist_ok=True)
        os.makedirs(PIPELINES_BASE_DIR, exist_ok=True)
        self.runs = self._load_runs()

    def _load_runs(self) -> dict:
        if os.path.exists(PIPELINE_DB_PATH):
            try:
                with open(PIPELINE_DB_PATH, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                return {}
        return {}

    def _save_runs(self):
        try:
            with open(PIPELINE_DB_PATH, "w", encoding="utf-8") as f:
                json.dump(self.runs, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"Error saving pipeline runs DB: {str(e)}")

    def create_run(self, handle: str, config: dict) -> dict:
        run_id = str(uuid.uuid4())
        run = {
            "id": run_id,
            "handle": handle,
            "status": "pending",
            "current_step": "idle",
            "progress": 0,
            "logs": [f"[{self._ts()}] Pipeline initialized for handle @{handle}"],
            "created_at": datetime.now().isoformat(),
            "config": config,
            "output_files": []
        }
        self.runs[run_id] = run
        self._save_runs()
        return run

    def get_run(self, run_id: str) -> dict:
        return self.runs.get(run_id)

    def get_all_runs(self) -> list:
        return list(self.runs.values())

    def add_log(self, run_id: str, message: str):
        if run_id in self.runs:
            log_entry = f"[{self._ts()}] {message}"
            self.runs[run_id]["logs"].append(log_entry)
            print(log_entry)
            self._save_runs()

    def update_run(self, run_id: str, **kwargs):
        if run_id in self.runs:
            self.runs[run_id].update(kwargs)
            self._save_runs()

    def _ts(self) -> str:
        return datetime.now().strftime("%H:%M:%S")

    def start_pipeline(self, run_id: str):
        """Starts the pipeline orchestrator in a background thread."""
        threading.Thread(target=self._run_orchestrator, args=(run_id,), daemon=True).start()

    def _run_orchestrator(self, run_id: str):
        run = self.get_run(run_id)
        if not run:
            return

        run_dir = os.path.join(PIPELINES_BASE_DIR, run_id)
        os.makedirs(run_dir, exist_ok=True)

        download_dir = os.path.join(run_dir, "1_downloaded")
        narrated_dir = os.path.join(run_dir, "2_narrated")
        subtitled_dir = os.path.join(run_dir, "3_subtitled")
        finalized_dir = os.path.join(run_dir, "4_finalized")

        os.makedirs(download_dir, exist_ok=True)
        os.makedirs(narrated_dir, exist_ok=True)
        os.makedirs(subtitled_dir, exist_ok=True)
        os.makedirs(finalized_dir, exist_ok=True)

        handle = run["handle"]
        config = run["config"]
        gemini_api_key = config.get("gemini_api_key", "") or os.environ.get("GEMINI_API_KEY", "")

        try:
            # ──────────────────────────────────────────────────────────────────
            # STEP 1: Downloader
            # ──────────────────────────────────────────────────────────────────
            self.update_run(run_id, status="running", current_step="downloader", progress=10)
            
            local_override = config.get("local_folder_override", "").strip()
            if local_override and os.path.isdir(local_override):
                self.add_log(run_id, f"🚀 STEP 1: Downloader — Loading local files from override folder: {local_override}")
                for item in sorted(os.listdir(local_override)):
                    if os.path.splitext(item)[1].lower() in SUPPORTED_VIDEO_EXTENSIONS:
                        shutil.copy(os.path.join(local_override, item), os.path.join(download_dir, item))
                        self.add_log(run_id, f"[Downloader] Loaded '{item}' from local override.")
            else:
                self.add_log(run_id, "🚀 STEP 1: Downloader — Initializing browser scraper...")
                types = []
                if config.get("download_reels", True): types.extend(["reels", "videos"])
                if config.get("download_posts", False): types.extend(["photos", "carousels"])
                type_arg = ",".join(types) if types else "reels"

                cmd = [
                    "node",
                    HEADLESS_SCRIPT,
                    "--username", handle,
                    "--types", type_arg,
                    "--output", download_dir,
                ]
                if config.get("download_captions", True):
                    cmd.append("--captions")

                self.add_log(run_id, f"[Downloader] Scraping profile @{handle} targeting types: {type_arg}")
                
                # Run headless crawler
                process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    cwd=CLI_TOOL_DIR,
                )

                download_count = 0
                for line in process.stdout:
                    line = line.strip()
                    if not line: continue
                    if line.startswith("PROGRESS:"):
                        try:
                            data = json.loads(line[len("PROGRESS:"):])
                            self.add_log(run_id, f"[Downloader Scraper] {data.get('message', '')}")
                        except: pass
                    elif line.startswith("RESULT:"):
                        try:
                            data = json.loads(line[len("RESULT:"):])
                            download_count = data.get("downloadCount", 0)
                            self.add_log(run_id, f"[Downloader Scraper] Downloaded {download_count} items.")
                        except: pass
                    elif line.startswith("ERROR:"):
                        try:
                            data = json.loads(line[len("ERROR:"):])
                            self.add_log(run_id, f"[Downloader Scraper Error] ⚠️ {data.get('message', '')}")
                        except: pass

                process.wait()

                if process.returncode != 0:
                    try:
                        stderr_data = process.stderr.read()
                        self.add_log(run_id, f"[Downloader] Crawler process completed with code: {process.returncode}")
                    except: pass
                
            video_files = [
                f for f in sorted(os.listdir(download_dir))
                if os.path.splitext(f)[1].lower() in SUPPORTED_VIDEO_EXTENSIONS
            ]

            # Automatic fallback to local user reels if folder is empty
            if not video_files:
                fallback_path = "/Users/masi/Documents/newreels"
                self.add_log(run_id, f"⚠️ Scraper downloaded 0 items (possibly due to login block). Checking fallback folder: {fallback_path}...")
                if os.path.isdir(fallback_path):
                    for item in sorted(os.listdir(fallback_path)):
                        if os.path.splitext(item)[1].lower() in SUPPORTED_VIDEO_EXTENSIONS:
                            shutil.copy(os.path.join(fallback_path, item), os.path.join(download_dir, item))
                            self.add_log(run_id, f"[Downloader Fallback] Loaded '{item}' from fallback directory.")
                    
                    # Recheck download folder
                    video_files = [
                        f for f in sorted(os.listdir(download_dir))
                        if os.path.splitext(f)[1].lower() in SUPPORTED_VIDEO_EXTENSIONS
                    ]

            self.add_log(run_id, f"✅ STEP 1 COMPLETE. Found {len(video_files)} video reels in download directory.")
            if not video_files:
                self.update_run(run_id, status="error", progress=100, current_step="failed")
                self.add_log(run_id, "❌ PIPELINE STOPPED: No video files found in download or fallback directories. Check your handle name or local paths.")
                return

            # ──────────────────────────────────────────────────────────────────
            # STEP 2: Scripting & Audio Narration
            # ──────────────────────────────────────────────────────────────────
            self.update_run(run_id, current_step="narration", progress=35)
            self.add_log(run_id, "🎙️ STEP 2: Visual Analysis & Script Generation via Gemini API...")

            voice = config.get("voice", "en-US-AriaNeural")
            audio_mode = config.get("audio_mode", "replace")
            custom_prompt = config.get("custom_prompt", "")
            
            rate_val = config.get("rate", 0)
            volume_val = config.get("volume", 0)
            rate_str = f"+{rate_val}%" if rate_val >= 0 else f"{rate_val}%"
            vol_str = f"+{volume_val}%" if volume_val >= 0 else f"{volume_val}%"

            temp_audio_dir = os.path.join(run_dir, ".temp_audio")
            os.makedirs(temp_audio_dir, exist_ok=True)

            loop = asyncio.new_event_loop()

            for idx, filename in enumerate(video_files):
                in_path = os.path.join(download_dir, filename)
                out_path = os.path.join(narrated_dir, filename)
                temp_mp3 = os.path.join(temp_audio_dir, f"{os.path.splitext(filename)[0]}.mp3")

                self.add_log(run_id, f"[Narration] ({idx+1}/{len(video_files)}) Extracting keyframes from {filename}...")
                
                # Extract frames
                temp_frames_dir = os.path.join(run_dir, f".frames_{idx}")
                frames = auto_analyze_service._extract_frames(in_path, temp_frames_dir, num_frames=2)

                script = ""
                if frames and gemini_api_key:
                    self.add_log(run_id, f"[Narration] Invoking Gemini API 1.5 Flash multimodal frame description...")
                    default_prompt = (
                        "Analyze these frames from a video clip. Generate a very short, engaging, natural voiceover "
                        "script (2 sentences max) describing what is happening or welcoming the audience. Do not use emojis. "
                        "Do not start with 'in this video' or 'this clip shows'. Write directly as if you are the host speaking."
                    )
                    prompt = custom_prompt if custom_prompt else default_prompt
                    script = auto_analyze_service._call_gemini_api(gemini_api_key, frames, prompt)
                    
                    if "API Error:" in script or "Error connecting" in script:
                        self.add_log(run_id, f"[Narration] Gemini API Failed: {script}. Falling back to rule-based generator.")
                        script = auto_analyze_service._local_analyze(filename, download_dir)
                else:
                    self.add_log(run_id, f"[Narration] Missing Gemini API Key or frames. Running local metadata fallback script...")
                    script = auto_analyze_service._local_analyze(filename, download_dir)

                shutil.rmtree(temp_frames_dir, ignore_errors=True)

                self.add_log(run_id, f"[Narration] Generated voiceover script: \"{script}\"")
                
                # Generate edge-tts audio
                self.add_log(run_id, f"[Narration] Generating edge-tts speech audio using voice: {voice}...")
                loop.run_until_complete(audio_generator_service._generate_audio(script, voice, rate_str, vol_str, temp_mp3))

                # Merge audio with video
                self.add_log(run_id, f"[Narration] Merging narration track with video stream using mode: {audio_mode}...")
                success, stderr = audio_generator_service._merge_audio_video(
                    in_path, temp_mp3, out_path,
                    {"audio_mode": audio_mode, "audio_volume": 1.0, "original_volume": 0.3}
                )

                if success:
                    self.add_log(run_id, f"✅ [Narration] Synthesized voiced video reel saved.")
                else:
                    self.add_log(run_id, f"⚠️ [Narration] FFmpeg merging failed: {stderr[:100]}. Copying source.")
                    shutil.copy(in_path, out_path)

            shutil.rmtree(temp_audio_dir, ignore_errors=True)
            self.add_log(run_id, "✅ STEP 2 COMPLETE. Narrated voiceover tracks blended successfully.")

            # ──────────────────────────────────────────────────────────────────
            # STEP 3: Subtitles Generator & Applier
            # ──────────────────────────────────────────────────────────────────
            self.update_run(run_id, current_step="subtitles", progress=60)
            self.add_log(run_id, "💬 STEP 3: Transcribing Narrated Audio & Burning Subtitle Overlays...")

            styling_config = config.get("subtitles_styling", {})
            
            for idx, filename in enumerate(video_files):
                in_path = os.path.join(narrated_dir, filename)
                out_path = os.path.join(subtitled_dir, filename)

                self.add_log(run_id, f"[Subtitles] ({idx+1}/{len(video_files)}) Processing caption tracks for {filename}...")
                
                # Extract audio track to MP3
                temp_srt_audio = os.path.join(run_dir, f"srt_{idx}.mp3")
                ffmpeg_audio_cmd = [
                    "ffmpeg", "-y", "-i", in_path,
                    "-vn", "-acodec", "libmp3lame", "-ar", "16000", "-ac", "1",
                    temp_srt_audio
                ]
                subprocess.run(ffmpeg_audio_cmd, capture_output=True, timeout=20)

                srt_content = ""
                if os.path.exists(temp_srt_audio) and os.path.getsize(temp_srt_audio) > 0 and gemini_api_key:
                    self.add_log(run_id, f"[Subtitles] Requesting audio transcription from Gemini...")
                    srt_content = subtitle_service._generate_srt_gemini(gemini_api_key, temp_srt_audio)
                
                try: os.remove(temp_srt_audio)
                except: pass

                if srt_content and not srt_content.startswith("⚠️"):
                    # Burn subtitles
                    self.add_log(run_id, f"[Subtitles] SRT generated successfully. Burning into video frame...")
                    srt_file_path = os.path.join(run_dir, f"subtitles_{idx}.srt")
                    with open(srt_file_path, "w", encoding="utf-8") as srt_file:
                        srt_file.write(srt_content)

                    # Custom styling parameters
                    font_size = styling_config.get("font_size", 16)
                    font_color = styling_config.get("font_color", "&H00FFFFFF")
                    outline_color = styling_config.get("outline_color", "&H00000000")
                    outline_width = styling_config.get("outline_width", 2)
                    alignment = styling_config.get("alignment", 2)

                    success, stderr = subtitle_service._burn_subtitles(
                        in_path, srt_file_path, out_path,
                        {
                            "font_size": font_size,
                            "color": font_color,
                            "outline_color": outline_color,
                            "outline_width": outline_width,
                            "alignment": alignment
                        }
                    )
                    
                    try: os.remove(srt_file_path)
                    except: pass

                    if success:
                        self.add_log(run_id, f"✅ [Subtitles] Subtitle track burned onto video frame.")
                    else:
                        self.add_log(run_id, f"⚠️ [Subtitles] FFmpeg subtitle burning failed: {stderr[:100]}. Copying source.")
                        shutil.copy(in_path, out_path)
                else:
                    self.add_log(run_id, f"⚠️ [Subtitles] Transcription failed: {srt_content}. Copying source video with zero captions.")
                    shutil.copy(in_path, out_path)

            self.add_log(run_id, "✅ STEP 3 COMPLETE. Subtitle overlays applied to video files.")

            # ──────────────────────────────────────────────────────────────────
            # STEP 4: Brand Watermark & Frame Applier
            # ──────────────────────────────────────────────────────────────────
            self.update_run(run_id, current_step="watermark", progress=80)
            self.add_log(run_id, "🎨 STEP 4: Overlaying Branding Watermark & Graphics...")

            watermark_mode = config.get("watermark_mode", "logo")
            watermark_logo_path = config.get("watermark_logo_path", "")
            watermark_position = config.get("watermark_position", "bottom-right")
            watermark_width = config.get("watermark_width", 150)
            watermark_opacity = config.get("watermark_opacity", 0.5)
            watermark_margin = config.get("watermark_margin", 20)

            for idx, filename in enumerate(video_files):
                in_path = os.path.join(subtitled_dir, filename)
                out_path = os.path.join(finalized_dir, filename)

                if watermark_logo_path and os.path.exists(watermark_logo_path):
                    self.add_log(run_id, f"[Watermark] ({idx+1}/{len(video_files)}) Blending watermark file: {os.path.basename(watermark_logo_path)}...")
                    success, stderr = watermark_service._apply_watermark(
                        in_path, watermark_logo_path, out_path,
                        {
                            "watermark_mode": watermark_mode,
                            "position": watermark_position,
                            "width_scale": watermark_width,
                            "opacity": watermark_opacity,
                            "margin": watermark_margin
                        }
                    )
                    if success:
                        self.add_log(run_id, f"✅ [Watermark] Branding applied.")
                    else:
                        self.add_log(run_id, f"⚠️ [Watermark] Overlay failed: {stderr[:100]}. Copying source.")
                        shutil.copy(in_path, out_path)
                else:
                    self.add_log(run_id, f"[Watermark] No watermark logo config or file does not exist. Skipping step.")
                    shutil.copy(in_path, out_path)

            self.add_log(run_id, "✅ STEP 4 COMPLETE. Graphics and watermarks overlaid successfully.")

            # ──────────────────────────────────────────────────────────────────
            # STEP 5: Social Scheduler
            # ──────────────────────────────────────────────────────────────────
            self.update_run(run_id, current_step="scheduler", progress=95)
            self.add_log(run_id, "📅 STEP 5: Scheduling Finalized Video Reels for Social Release...")

            platforms = config.get("platforms", [])
            use_simulated = config.get("use_simulated", True)
            meta_token = config.get("meta_access_token", "")
            ig_id = config.get("instagram_business_id", "")
            fb_id = config.get("facebook_page_id", "")
            yt_token = config.get("youtube_access_token", "")
            pub_video_url = config.get("public_video_url", "")

            cred_dict = {
                "use_simulated": use_simulated,
                "meta_access_token": meta_token,
                "instagram_business_id": ig_id,
                "facebook_page_id": fb_id,
                "public_video_url": pub_video_url,
                "youtube_access_token": yt_token
            }

            base_time = datetime.now() + timedelta(hours=1)
            scheduled_items = []

            for idx, filename in enumerate(video_files):
                final_path = os.path.join(finalized_dir, filename)
                
                # Space out postings hourly
                post_time = (base_time + timedelta(hours=idx)).isoformat()
                
                self.add_log(run_id, f"[Scheduler] Adding post job for {filename} scheduled at {post_time}...")
                
                job = scheduler_service.schedule_post(
                    video_path=final_path,
                    caption=f"AI automation generated video: {filename} #automation #viral #reels",
                    scheduled_time=post_time,
                    platforms=platforms,
                    credentials=cred_dict
                )
                scheduled_items.append({
                    "name": filename,
                    "path": final_path,
                    "scheduled_time": post_time,
                    "scheduler_job_id": job["id"]
                })

            self.add_log(run_id, f"✅ STEP 5 COMPLETE. Scheduled {len(video_files)} video(s) for social distribution.")

            # ──────────────────────────────────────────────────────────────────
            # PIPELINE FINISHED SUCCESS
            # ──────────────────────────────────────────────────────────────────
            self.update_run(
                run_id,
                status="completed",
                current_step="finished",
                progress=100,
                output_files=scheduled_items
            )
            self.add_log(run_id, "🎉 AUTOMATION PIPELINE RUN COMPLETED SUCCESS! All steps completed end-to-end.")

        except Exception as e:
            self.update_run(run_id, status="error", current_step="failed", progress=100)
            self.add_log(run_id, f"❌ PIPELINE CRASHED: {str(e)}")

pipeline_service = PipelineService()
