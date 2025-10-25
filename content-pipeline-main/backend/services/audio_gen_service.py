import os
import asyncio
import subprocess
import edge_tts

SUPPORTED_VIDEO_EXTENSIONS = {'.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'}

# Popular edge-tts voices (curated list)
VOICE_LIST = [
    {"id": "en-US-AriaNeural", "name": "Aria", "lang": "English (US)", "gender": "Female"},
    {"id": "en-US-GuyNeural", "name": "Guy", "lang": "English (US)", "gender": "Male"},
    {"id": "en-US-JennyNeural", "name": "Jenny", "lang": "English (US)", "gender": "Female"},
    {"id": "en-US-ChristopherNeural", "name": "Christopher", "lang": "English (US)", "gender": "Male"},
    {"id": "en-US-AnaNeural", "name": "Ana", "lang": "English (US)", "gender": "Female"},
    {"id": "en-GB-SoniaNeural", "name": "Sonia", "lang": "English (UK)", "gender": "Female"},
    {"id": "en-GB-RyanNeural", "name": "Ryan", "lang": "English (UK)", "gender": "Male"},
    {"id": "en-AU-NatashaNeural", "name": "Natasha", "lang": "English (AU)", "gender": "Female"},
    {"id": "en-IN-NeerjaNeural", "name": "Neerja", "lang": "English (India)", "gender": "Female"},
    {"id": "en-IN-PrabhatNeural", "name": "Prabhat", "lang": "English (India)", "gender": "Male"},
    {"id": "hi-IN-SwaraNeural", "name": "Swara", "lang": "Hindi", "gender": "Female"},
    {"id": "hi-IN-MadhurNeural", "name": "Madhur", "lang": "Hindi", "gender": "Male"},
    {"id": "es-ES-ElviraNeural", "name": "Elvira", "lang": "Spanish", "gender": "Female"},
    {"id": "fr-FR-DeniseNeural", "name": "Denise", "lang": "French", "gender": "Female"},
    {"id": "de-DE-KatjaNeural", "name": "Katja", "lang": "German", "gender": "Female"},
    {"id": "ja-JP-NanamiNeural", "name": "Nanami", "lang": "Japanese", "gender": "Female"},
    {"id": "ko-KR-SunHiNeural", "name": "SunHi", "lang": "Korean", "gender": "Female"},
    {"id": "ar-SA-ZariyahNeural", "name": "Zariyah", "lang": "Arabic", "gender": "Female"},
    {"id": "pt-BR-FranciscaNeural", "name": "Francisca", "lang": "Portuguese (BR)", "gender": "Female"},
    {"id": "zh-CN-XiaoxiaoNeural", "name": "Xiaoxiao", "lang": "Chinese", "gender": "Female"},
]


class AudioGeneratorService:
    def __init__(self):
        self.jobs = {}

    # ── Job management ────────────────────────────────────────

    def create_job(self, job_id: str, folder_path: str):
        self.jobs[job_id] = {
            "id": job_id,
            "folder_path": folder_path,
            "status": "pending",
            "progress": "Starting...",
            "total_files": 0,
            "processed_files": 0,
            "current_file": None,
            "error": None,
        }
        return self.jobs[job_id]

    def update_job(self, job_id: str, **kwargs):
        if job_id in self.jobs:
            for k, v in kwargs.items():
                if v is not None:
                    self.jobs[job_id][k] = v

    def get_job(self, job_id: str):
        return self.jobs.get(job_id)

    def get_all_jobs(self):
        return list(self.jobs.values())

    # ── Voice listing ─────────────────────────────────────────

    def get_voices(self):
        return VOICE_LIST

    # ── Folder listing ────────────────────────────────────────

    def list_video_files(self, folder_path: str):
        files = []
        if not os.path.isdir(folder_path):
            return files
        for f in sorted(os.listdir(folder_path)):
            ext = os.path.splitext(f)[1].lower()
            if ext in SUPPORTED_VIDEO_EXTENSIONS:
                filepath = os.path.join(folder_path, f)
                files.append({
                    "name": f,
                    "path": filepath,
                    "size": os.path.getsize(filepath),
                })
        return files

    # ── TTS Generation ────────────────────────────────────────

    async def _generate_audio(self, text: str, voice: str, rate: str, volume: str, output_path: str):
        """Generate audio using edge-tts."""
        communicate = edge_tts.Communicate(text, voice, rate=rate, volume=volume)
        await communicate.save(output_path)

    def _get_video_duration(self, video_path: str) -> float:
        """Get video duration in seconds using ffprobe."""
        cmd = [
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            video_path
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        try:
            return float(result.stdout.strip())
        except (ValueError, AttributeError):
            return 0.0

    def _merge_audio_video(self, video_path: str, audio_path: str, output_path: str, settings: dict):
        """Merge generated audio with video using ffmpeg."""
        audio_mode = settings.get("audio_mode", "replace")
        audio_volume = settings.get("audio_volume", 1.0)
        original_volume = settings.get("original_volume", 0.3)

        cmd = ["ffmpeg", "-i", video_path, "-i", audio_path]

        if audio_mode == "replace":
            # Replace original audio entirely
            cmd.extend([
                "-map", "0:v:0", "-map", "1:a:0",
                "-c:v", "libx264", "-preset", "fast", "-crf", "23",
                "-c:a", "aac", "-b:a", "192k",
                "-shortest",
            ])
        elif audio_mode == "mix":
            # Mix TTS with original audio
            cmd.extend([
                "-filter_complex",
                f"[0:a]volume={original_volume}[orig];[1:a]volume={audio_volume}[tts];[orig][tts]amix=inputs=2:duration=first:dropout_transition=2[a]",
                "-map", "0:v:0", "-map", "[a]",
                "-c:v", "libx264", "-preset", "fast", "-crf", "23",
                "-c:a", "aac", "-b:a", "192k",
                "-shortest",
            ])
        elif audio_mode == "background":
            # TTS as primary, original audio as quiet background
            cmd.extend([
                "-filter_complex",
                f"[0:a]volume={original_volume}[orig];[1:a]volume={audio_volume}[tts];[tts][orig]amix=inputs=2:duration=first:dropout_transition=2[a]",
                "-map", "0:v:0", "-map", "[a]",
                "-c:v", "libx264", "-preset", "fast", "-crf", "23",
                "-c:a", "aac", "-b:a", "192k",
                "-shortest",
            ])

        cmd.extend(["-y", output_path])

        result = subprocess.run(cmd, capture_output=True, text=True)
        return result.returncode == 0, result.stderr

    # ── Main processing ───────────────────────────────────────

    def process_videos(self, job_id: str, folder_path: str, settings: dict):
        """Run the full TTS + merge pipeline (called in a thread)."""
        try:
            text = settings.get("text", "")
            voice = settings.get("voice", "en-US-AriaNeural")
            rate_val = settings.get("rate", 0)
            volume_val = settings.get("tts_volume", 0)
            output_subfolder = settings.get("output_subfolder", "with_audio")
            per_video_texts = settings.get("per_video_texts", {})

            # Format rate/volume for edge-tts
            rate_str = f"+{rate_val}%" if rate_val >= 0 else f"{rate_val}%"
            vol_str = f"+{volume_val}%" if volume_val >= 0 else f"{volume_val}%"

            video_files = [
                f for f in sorted(os.listdir(folder_path))
                if os.path.splitext(f)[1].lower() in SUPPORTED_VIDEO_EXTENSIONS
            ]

            if not video_files:
                self.update_job(job_id, status="error", error="No video files found")
                return

            if not text and not per_video_texts and not settings.get("auto_generate_scripts"):
                self.update_job(job_id, status="error", error="No text or AI generation settings provided")
                return

            self.update_job(
                job_id,
                status="processing",
                total_files=len(video_files),
                progress=f"Found {len(video_files)} video(s)",
            )

            output_dir = os.path.join(folder_path, output_subfolder)
            os.makedirs(output_dir, exist_ok=True)
            temp_dir = os.path.join(folder_path, f".temp_audio_{job_id}")
            os.makedirs(temp_dir, exist_ok=True)

            succeeded = 0
            generated_files = []
            loop = asyncio.new_event_loop()

            for i, filename in enumerate(video_files):
                input_path = os.path.join(folder_path, filename)
                output_filename = f"{os.path.splitext(filename)[0]}.mp4"
                output_path = os.path.join(output_dir, output_filename)
                audio_path = os.path.join(temp_dir, f"{os.path.splitext(filename)[0]}.mp3")

                # Use per-video text if available, otherwise global text
                video_text = per_video_texts.get(filename, text)

                # Check for on-the-fly AI script generation in background
                if settings.get("auto_generate_scripts") or not video_text:
                    self.update_job(
                        job_id,
                        progress=f"AI analyzing video content for {filename}...",
                        current_file=filename,
                        processed_files=i,
                    )
                    from backend.services.auto_analyze_service import auto_analyze_service
                    api_key = settings.get("gemini_api_key") or os.environ.get("GEMINI_API_KEY")
                    custom_prompt = settings.get("custom_prompt")

                    default_prompt = (
                        "Analyze these frames from a video clip. Generate a very short, engaging, natural voiceover "
                        "script (2 sentences max) describing what is happening or welcoming the audience. Do not use emojis. "
                        "Do not start with 'in this video' or 'this clip shows'. Write directly as if you are the host speaking."
                    )
                    prompt = custom_prompt if custom_prompt else default_prompt

                    try:
                        temp_analysis_dir = os.path.join(folder_path, f".temp_analysis_{job_id}")
                        frames = auto_analyze_service._extract_frames(input_path, temp_analysis_dir, num_frames=2)

                        if frames and api_key:
                            generated_script = auto_analyze_service._call_gemini_api(api_key, frames, prompt)
                            if "API Error:" in generated_script or "Error connecting" in generated_script:
                                self.update_job(
                                    job_id,
                                    progress=f"⚠️ {generated_script}. Using local fallback script...",
                                )
                                generated_script = auto_analyze_service._local_analyze(filename, folder_path)
                        else:
                            self.update_job(
                                job_id,
                                progress=f"⚠️ No frames extracted for {filename}. Using local fallback script...",
                            )
                            generated_script = auto_analyze_service._local_analyze(filename, folder_path)

                        # Clean up temp frames
                        import shutil
                        shutil.rmtree(temp_analysis_dir, ignore_errors=True)

                        video_text = generated_script
                        per_video_texts[filename] = video_text
                    except Exception as e:
                        self.update_job(
                            job_id,
                            progress=f"⚠️ Analysis crashed: {str(e)[:50]}. Using local fallback...",
                        )
                        video_text = auto_analyze_service._local_analyze(filename, folder_path)
                        per_video_texts[filename] = video_text

                if not video_text:
                    continue

                self.update_job(
                    job_id,
                    current_file=filename,
                    progress=f"Generating audio for {filename} ({i + 1}/{len(video_files)})",
                    processed_files=i,
                )

                try:
                    # Generate TTS audio
                    loop.run_until_complete(
                        self._generate_audio(video_text, voice, rate_str, vol_str, audio_path)
                    )

                    # Merge audio with video
                    self.update_job(
                        job_id,
                        progress=f"Merging audio with {filename} ({i + 1}/{len(video_files)})",
                    )

                    success, stderr = self._merge_audio_video(
                        input_path, audio_path, output_path, settings
                    )

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
                            progress=f"Warning: Failed to merge {filename}",
                        )

                except Exception as e:
                    self.update_job(
                        job_id,
                        progress=f"Warning: Error on {filename}: {str(e)[:100]}",
                    )
                    continue

            loop.close()

            # Cleanup temp audio files
            try:
                import shutil
                shutil.rmtree(temp_dir, ignore_errors=True)
            except Exception:
                pass

            self.update_job(
                job_id,
                status="completed",
                processed_files=succeeded,
                current_file=None,
                progress=f"Done! Processed {succeeded}/{len(video_files)} video(s). Saved to: {output_dir}",
                output_files=generated_files
            )

        except Exception as e:
            self.update_job(job_id, status="error", error=str(e))


audio_generator_service = AudioGeneratorService()
