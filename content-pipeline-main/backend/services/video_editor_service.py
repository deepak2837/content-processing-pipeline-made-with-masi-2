import os
import subprocess
import json

SUPPORTED_EXTENSIONS = {'.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'}

CRF_MAP = {
    'low': '28',
    'medium': '23',
    'high': '18',
    'ultra': '14',
}

# Watermark position mapping  → ffmpeg drawtext x:y expressions
WATERMARK_POSITIONS = {
    'top_left': ("20", "20"),
    'top_right': ("w-tw-20", "20"),
    'bottom_left': ("20", "h-th-20"),
    'bottom_right': ("w-tw-20", "h-th-20"),
    'center': ("(w-tw)/2", "(h-th)/2"),
}


def time_to_sec(t_str):
    if not t_str:
        return 0.0
    parts = str(t_str).strip().split(':')
    try:
        if len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])
        elif len(parts) == 2:
            return int(parts[0]) * 60 + float(parts[1])
        elif len(parts) == 1:
            return float(parts[0])
    except:
        pass
    return 0.0

class VideoEditorService:
    def __init__(self):
        self.jobs = {}
        self.cancelled_jobs = set()
        self.active_processes = {} # job_id -> list of active subprocess.Popen

    def cancel_job(self, job_id: str):
        self.cancelled_jobs.add(job_id)
        if job_id in self.active_processes:
            for proc in self.active_processes[job_id]:
                try:
                    proc.terminate()
                except:
                    pass
        self.update_job(job_id, status="cancelled", current_file=None, progress="Job was cancelled by the user.")

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

    # ── Folder listing ────────────────────────────────────────

    def list_video_files(self, folder_path: str):
        files = []
        if not os.path.isdir(folder_path):
            return files

        for f in sorted(os.listdir(folder_path)):
            ext = os.path.splitext(f)[1].lower()
            if ext in SUPPORTED_EXTENSIONS:
                filepath = os.path.join(folder_path, f)
                files.append({
                    "name": f,
                    "path": filepath,
                    "size": os.path.getsize(filepath),
                    "is_processed": False,
                })

        # Include already-processed files
        processed_dir = os.path.join(folder_path, "processed")
        if os.path.isdir(processed_dir):
            for f in sorted(os.listdir(processed_dir)):
                ext = os.path.splitext(f)[1].lower()
                if ext in SUPPORTED_EXTENSIONS:
                    filepath = os.path.join(processed_dir, f)
                    files.append({
                        "name": f"processed/{f}",
                        "path": filepath,
                        "size": os.path.getsize(filepath),
                        "is_processed": True,
                    })

        return files

    # ── Build ffmpeg filter chains ────────────────────────────

    def _build_video_filters(self, settings: dict, width: int, height: int):
        """Build a list of video filter strings from settings."""
        filters = []

        # 1. Crop (applied first on the raw input)
        if settings.get("crop_enabled", False):
            ct = settings.get("crop_top", 0)
            cb = settings.get("crop_bottom", 0)
            cl = settings.get("crop_left", 0)
            cr = settings.get("crop_right", 0)
            if any([ct, cb, cl, cr]):
                # Make sure the crop doesn't result in a negative or zero dimension
                filters.append(
                    f"crop='max(1,iw-{cl}-{cr})':'max(1,ih-{ct}-{cb})':{cl}:{ct}"
                )

        # 1.5. Trim (multi-segment)
        if settings.get("trim_enabled", False):
            trim_segments = settings.get("trim_segments", [])
            trim_mode = settings.get("trim_mode", "keep")
            if trim_segments:
                exprs = []
                for seg in trim_segments:
                    s_sec = time_to_sec(seg.get("start", "0"))
                    e_sec = time_to_sec(seg.get("end", "0"))
                    exprs.append(f"between(t,{s_sec},{e_sec})")
                if exprs:
                    expr_str = "+".join(exprs)
                    if trim_mode == "cut":
                        expr_str = f"not({expr_str})"
                    filters.append(f"select='{expr_str}'")
                    filters.append("setpts=N/FRAME_RATE/TB")

        # 2. Resize based on mode
        if settings.get("resize_enabled", True):
            resize_mode = settings.get("resize_mode", "fill")

            if resize_mode == "cut":
                # ── CUT mode ──────────────────────────────────────
                # Scale UP so the smallest dimension fills the target,
                # then crop from center to exact target size.
                filters.append(
                    f"scale={width}:{height}:force_original_aspect_ratio=increase"
                )
                filters.append(
                    f"crop={width}:{height}"
                )

            elif resize_mode == "compress":
                # ── COMPRESS mode ─────────────────────────────────
                # Force-stretch to exact target dimensions (may distort).
                filters.append(
                    f"scale={width}:{height}"
                )

            else:
                # ── FILL mode (default) ───────────────────────────
                # Scale down preserving aspect ratio, then pad with
                # color bars to reach the exact target dimensions.
                filters.append(
                    f"scale={width}:{height}:force_original_aspect_ratio=decrease"
                )

                # Color bars / letterbox padding (only applies in fill mode)
                if settings.get("color_bars_enabled", True):
                    raw_color = settings.get("bar_color", "#FFFFFF")
                    bar_position = settings.get("bar_position", "both")
                    opacity = settings.get("bar_opacity", 1.0)
                    bar_top_h = settings.get("bar_top_height", 0)
                    bar_bottom_h = settings.get("bar_bottom_height", 0)

                    # Remove # from hex color for ffmpeg
                    color = raw_color.lstrip('#')

                    if opacity < 1.0:
                        alpha_hex = format(int(opacity * 255), '02x')
                        color_str = f"0x{color}{alpha_hex}"
                    else:
                        color_str = f"0x{color}"

                    # Custom top/bottom heights override the position presets
                    if bar_top_h > 0 or bar_bottom_h > 0:
                        # Use explicit pixel values: pad to (w × h+top+bottom), place video at (0, top)
                        total_h = f"ih+{bar_top_h + bar_bottom_h}"
                        filters.append(
                            f"pad=iw:{total_h}:0:{bar_top_h}:color={color_str}"
                        )
                    elif bar_position == "both":
                        filters.append(
                            f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color={color_str}"
                        )
                    elif bar_position == "top":
                        filters.append(
                            f"pad=iw:{height}:0:{height}-ih:color={color_str}"
                        )
                    elif bar_position == "bottom":
                        filters.append(
                            f"pad=iw:{height}:0:0:color={color_str}"
                        )
                    elif bar_position == "sides":
                        filters.append(
                            f"pad={width}:ih:(ow-iw)/2:0:color={color_str}"
                        )

        # 4. Brightness / Contrast / Saturation / Sharpness / Hue
        if settings.get("adjust_enabled", False):
            brightness = settings.get("brightness", 0.0)
            contrast = settings.get("contrast", 1.0)
            saturation = settings.get("saturation", 1.0)
            filters.append(
                f"eq=brightness={brightness}:contrast={contrast}:saturation={saturation}"
            )
            hue = settings.get("hue", 0.0)
            if hue != 0.0:
                filters.append(f"hue=h={hue}")
            sharpness = settings.get("sharpness", 0.0)
            if sharpness != 0.0:
                filters.append(f"unsharp=5:5:{sharpness}:5:5:{sharpness}")

        # 5. Rotation
        rotation = settings.get("rotation", 0)
        if rotation == 90:
            filters.append("transpose=1")
        elif rotation == 180:
            filters.append("transpose=1,transpose=1")
        elif rotation == 270:
            filters.append("transpose=2")

        # 6. Flip
        if settings.get("flip_horizontal", False):
            filters.append("hflip")
        if settings.get("flip_vertical", False):
            filters.append("vflip")

        # 7. Speed (video part)
        if settings.get("speed_enabled", False):
            factor = settings.get("speed_factor", 1.0)
            if factor != 1.0 and factor > 0:
                pts_speed = 1.0 / factor
                filters.append(f"setpts={pts_speed}*PTS")

        # 8. Watermark / Text overlay
        if settings.get("watermark_enabled", False):
            text = settings.get("watermark_text", "")
            if text:
                pos_key = settings.get("watermark_position", "bottom_right")
                x, y = WATERMARK_POSITIONS.get(pos_key, ("w-tw-20", "h-th-20"))
                font_size = settings.get("watermark_font_size", 24)
                color = settings.get("watermark_color", "#FFFFFF").lstrip('#')
                opacity = settings.get("watermark_opacity", 0.7)
                alpha_hex = format(int(opacity * 255), '02x')
                # Escape special characters for drawtext
                safe_text = text.replace("'", "\\'").replace(":", "\\:")
                filters.append(
                    f"drawtext=text='{safe_text}':x={x}:y={y}:"
                    f"fontsize={font_size}:fontcolor=0x{color}{alpha_hex}"
                )

        # Ensure final output dimensions are even (required by libx264 yuv420p)
        filters.append("pad=ceil(iw/2)*2:ceil(ih/2)*2")

        return filters

    def _build_audio_filters(self, settings: dict):
        """Build audio filter strings from settings."""
        filters = []

        if settings.get("trim_enabled", False):
            trim_segments = settings.get("trim_segments", [])
            trim_mode = settings.get("trim_mode", "keep")
            if trim_segments:
                exprs = []
                for seg in trim_segments:
                    s_sec = time_to_sec(seg.get("start", "0"))
                    e_sec = time_to_sec(seg.get("end", "0"))
                    exprs.append(f"between(t,{s_sec},{e_sec})")
                if exprs:
                    expr_str = "+".join(exprs)
                    if trim_mode == "cut":
                        expr_str = f"not({expr_str})"
                    filters.append(f"aselect='{expr_str}'")
                    filters.append("asetpts=N/SR/TB")

        if settings.get("speed_enabled", False):
            factor = settings.get("speed_factor", 1.0)
            if factor != 1.0 and factor > 0:
                filters.append(f"atempo={factor}")

        volume = settings.get("audio_volume", 1.0)
        if volume != 1.0:
            filters.append(f"volume={volume}")

        fade_in = settings.get("audio_fade_in", 0.0)
        if fade_in > 0:
            filters.append(f"afade=t=in:st=0:d={fade_in}")

        fade_out = settings.get("audio_fade_out", 0.0)
        if fade_out > 0:
            # We'll apply a fade out near the end — uses a large start
            filters.append(f"afade=t=out:st=99999:d={fade_out}")

        return filters

    # ── Video processing ──────────────────────────────────────

    def process_videos(self, job_id: str, folder_path: str, settings: dict):
        try:
            video_files = [
                f for f in sorted(os.listdir(folder_path))
                if os.path.splitext(f)[1].lower() in SUPPORTED_EXTENSIONS
            ]

            if not video_files:
                self.update_job(job_id, status="error", error="No video files found in folder")
                return

            self.update_job(
                job_id,
                status="processing",
                total_files=len(video_files),
                progress=f"Found {len(video_files)} video(s) to process",
            )

            output_dir = os.path.join(folder_path, settings.get("output_subfolder", "processed"))
            os.makedirs(output_dir, exist_ok=True)

            crf = CRF_MAP.get(settings.get("quality", "high"), "18")
            width = settings.get("target_width", 1080)
            height = settings.get("target_height", 1920)

            if width <= 0 or height <= 0:
                self.update_job(job_id, status="error", error="Target width and height must be greater than 0. Please check your settings.")
                return

            video_filters = self._build_video_filters(settings, width, height)
            audio_filters = self._build_audio_filters(settings)

            succeeded = 0
            processed_count = 0
            errors = []

            self.active_processes[job_id] = []
            import concurrent.futures

            def process_single_video(i, filename):
                nonlocal succeeded, processed_count

                if job_id in self.cancelled_jobs:
                    return

                input_path = os.path.join(folder_path, filename)
                base_name = os.path.splitext(filename)[0]
                output_fmt = settings.get("output_format", "mp4").lower().strip('.')
                output_filename = base_name + f".{output_fmt}"
                output_path = os.path.join(output_dir, output_filename)

                cmd = ["ffmpeg"]

                if settings.get("trim_enabled", False) and not settings.get("trim_segments", []):
                    trim_start = settings.get("trim_start", "00:00:00")
                    if trim_start and trim_start != "00:00:00":
                        cmd.extend(["-ss", trim_start])

                cmd.extend(["-i", input_path])

                if settings.get("trim_enabled", False) and not settings.get("trim_segments", []):
                    trim_end = settings.get("trim_end", "")
                    if trim_end:
                        cmd.extend(["-to", trim_end])

                if video_filters:
                    cmd.extend(["-vf", ",".join(video_filters)])

                if not settings.get("audio_enabled", True):
                    cmd.extend(["-an"])
                elif audio_filters:
                    cmd.extend(["-af", ",".join(audio_filters)])
                    if output_fmt != "gif":
                        cmd.extend(["-c:a", "aac", "-b:a", "128k"])
                else:
                    if output_fmt != "gif":
                        cmd.extend(["-c:a", "aac", "-b:a", "128k"])

                cmd.extend(["-pix_fmt", "yuv420p"])

                if output_fmt == "webm":
                    cmd.extend(["-c:v", "libvpx-vp9", "-crf", crf, "-b:v", "0"])
                elif output_fmt == "gif":
                    cmd.extend(["-c:v", "gif"])
                else:
                    cmd.extend(["-c:v", "libx264", "-crf", crf, "-preset", "medium"])
                
                if output_fmt in ["mp4", "mov"]:
                    cmd.extend(["-movflags", "+faststart"])

                cmd.extend(["-y", output_path])

                try:
                    proc = subprocess.Popen(cmd, stderr=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
                    if job_id in self.active_processes:
                        self.active_processes[job_id].append(proc)
                    
                    _, stderr_output = proc.communicate()

                    if job_id in self.cancelled_jobs:
                        return

                    processed_count += 1

                    if proc.returncode != 0:
                        import sys
                        print(f"\n[FFmpeg Error on {filename}]:\n{stderr_output}\n", file=sys.stderr)
                        errors.append(f"Failed {filename} — {stderr_output[-100:]}")
                    else:
                        succeeded += 1

                    self.update_job(
                        job_id,
                        current_file="Multiple files (Parallel)",
                        progress=f"Processed {processed_count}/{len(video_files)} videos...",
                        processed_files=processed_count,
                    )
                except Exception as e:
                    print(f"Exception on {filename}: {e}")

            # Run concurrently with up to 3 workers
            with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
                futures = [executor.submit(process_single_video, i, f) for i, f in enumerate(video_files)]
                concurrent.futures.wait(futures)

            if job_id in self.cancelled_jobs:
                return # Handled by cancel_job

            if succeeded == 0 and len(video_files) > 0:
                self.update_job(
                    job_id,
                    status="error",
                    processed_files=0,
                    current_file=None,
                    progress=f"Failed to process any videos. Check backend terminal for FFmpeg logs.",
                )
            else:
                msg = f"Done! Processed {succeeded}/{len(video_files)} video(s). Saved to: {output_dir}"
                if errors:
                    msg += f" ({len(errors)} failed)"
                self.update_job(
                    job_id,
                    status="completed",
                    processed_files=succeeded,
                    current_file=None,
                    progress=msg,
                )

        except Exception as e:
            if job_id not in self.cancelled_jobs:
                self.update_job(job_id, status="error", error=str(e))
        finally:
            if job_id in self.active_processes:
                del self.active_processes[job_id]
            if job_id in self.cancelled_jobs:
                self.cancelled_jobs.remove(job_id)


video_editor_service = VideoEditorService()
