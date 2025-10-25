from pydantic import BaseModel
from typing import Optional, List

class DownloadRequest(BaseModel):
    handle: str
    download_path: str
    download_reels: bool = True
    download_posts: bool = True
    download_metadata: bool = True
    download_captions: bool = False
    date_from: Optional[str] = None # YYYY-MM-DD
    date_to: Optional[str] = None # YYYY-MM-DD
    last_upload_only: bool = False
    scraper_username: Optional[str] = None
    scraper_password: Optional[str] = None

class DownloadStatus(BaseModel):
    id: str
    handle: str
    status: str # "pending", "downloading", "completed", "error"
    progress: str
    error: Optional[str] = None
    captions_path: Optional[str] = None

# ── YouTube Shorts Download Schemas ───────────────────────────

class YouTubeDownloadRequest(BaseModel):
    source_url: str
    download_path: str
    max_videos: int = 5
    download_captions: bool = True
    download_description: bool = True
    download_metadata: bool = True

# ── Video Editor Schemas ──────────────────────────────────────

class VideoEditSettings(BaseModel):
    # Resolution / Resize
    resize_enabled: bool = True
    target_width: int = 1080
    target_height: int = 1920
    resize_mode: str = "fill"  # "fill" (letterbox), "cut" (crop center), "compress" (stretch)

    # Color Bars / Letterbox
    color_bars_enabled: bool = True
    bar_color: str = "#FFFFFF"
    bar_position: str = "both"  # "top", "bottom", "both", "sides"
    bar_opacity: float = 1.0    # 0.0 - 1.0
    bar_top_height: int = 0     # px – 0 means auto (split evenly)
    bar_bottom_height: int = 0  # px – 0 means auto (split evenly)

    # Crop
    crop_enabled: bool = False
    crop_top: int = 0
    crop_bottom: int = 0
    crop_left: int = 0
    crop_right: int = 0

    # Speed
    speed_enabled: bool = False
    speed_factor: float = 1.0   # 0.25 to 4.0

    # Trim
    trim_enabled: bool = False
    trim_mode: str = "keep"       # "keep" or "cut"
    trim_segments: list = []      # list of dicts: {"start": "00:00:00", "end": "00:00:10"}
    trim_start: str = "00:00:00"  # Legacy: HH:MM:SS
    trim_end: str = ""            # Legacy: empty = until end

    # Audio
    audio_enabled: bool = True
    audio_volume: float = 1.0    # 0.0 = mute, 1.0 = normal, 2.0 = 2x
    audio_fade_in: float = 0.0   # seconds
    audio_fade_out: float = 0.0  # seconds

    # Adjustments
    adjust_enabled: bool = False
    brightness: float = 0.0      # -1.0 to 1.0
    contrast: float = 1.0        # 0.0 to 3.0
    saturation: float = 1.0      # 0.0 to 3.0
    sharpness: float = 0.0       # -1.5 to 1.5 (0 = off)
    hue: float = 0.0             # -180 to 180

    # Watermark / Text Overlay
    watermark_enabled: bool = False
    watermark_text: str = ""
    watermark_position: str = "bottom_right"  # top_left, top_right, bottom_left, bottom_right, center
    watermark_font_size: int = 24
    watermark_color: str = "#FFFFFF"
    watermark_opacity: float = 0.7

    # Rotation / Flip
    rotation: int = 0  # 0, 90, 180, 270
    flip_horizontal: bool = False
    flip_vertical: bool = False

    # Output
    quality: str = "high"  # low, medium, high, ultra
    output_subfolder: str = "processed"
    output_format: str = "mp4" # mp4, webm, mov, mkv, avi, gif

class VideoEditRequest(BaseModel):
    folder_path: str
    settings: VideoEditSettings = VideoEditSettings()

class VideoEditJob(BaseModel):
    id: str
    folder_path: str
    status: str  # "pending", "processing", "completed", "error"
    progress: str
    total_files: int = 0
    processed_files: int = 0
    current_file: Optional[str] = None
    error: Optional[str] = None

class FolderListRequest(BaseModel):
    folder_path: str

class VideoFile(BaseModel):
    name: str
    path: str
    size: int
    is_processed: bool = False

# ── Audio Generator Schemas ───────────────────────────────────

class AudioGenSettings(BaseModel):
    text: str = ""                      # Global text for all videos
    per_video_texts: dict = {}          # {filename: text} for per-video narration
    voice: str = "en-US-AriaNeural"     # edge-tts voice ID
    rate: int = 0                       # speed: -50 to +100 (percent)
    tts_volume: int = 0                 # volume offset: -50 to +50 (percent)
    audio_mode: str = "replace"         # "replace", "mix", "background"
    audio_volume: float = 1.0           # TTS volume in mix (0.0-2.0)
    original_volume: float = 0.3        # Original audio volume in mix (0.0-1.0)
    output_subfolder: str = "with_audio"
    auto_generate_scripts: bool = False
    gemini_api_key: Optional[str] = None
    custom_prompt: Optional[str] = None

class AudioGenRequest(BaseModel):
    folder_path: str
    settings: AudioGenSettings = AudioGenSettings()


class AutoAnalyzeRequest(BaseModel):
    folder_path: str
    api_key: Optional[str] = None
    custom_prompt: Optional[str] = None


# ── Subtitle Generator Schemas ───────────────────────────────

class SubtitleStyling(BaseModel):
    font_size: int = 16
    color: str = "#FFFFFF"
    outline_color: str = "#000000"
    alignment: int = 2
    margin_v: int = 15
    output_subfolder: str = "with_subtitles"

class SubtitleProcessRequest(BaseModel):
    folder_path: str
    api_key: str
    styling: SubtitleStyling = SubtitleStyling()


# ── Watermark Applier Schemas ───────────────────────────────

class WatermarkSettings(BaseModel):
    watermark_mode: str = "logo"        # "logo" or "frame"
    position: str = "bottom-right"      # "top-left", "top-right", "bottom-left", "bottom-right", "center"
    width_scale: int = 150              # Width scale in px
    opacity: float = 0.5                # Opacity: 0.1 to 1.0
    margin: int = 20                    # Margin from border
    output_subfolder: str = "with_watermark"

class WatermarkProcessRequest(BaseModel):
    folder_path: str
    logo_path: str
    settings: WatermarkSettings = WatermarkSettings()


# ── Social Scheduler Schemas ───────────────────────────────

class SchedulerCredentials(BaseModel):
    use_simulated: bool = True
    meta_access_token: Optional[str] = None
    instagram_business_id: Optional[str] = None
    facebook_page_id: Optional[str] = None
    public_video_url: Optional[str] = None
    youtube_access_token: Optional[str] = None

class SchedulerRequest(BaseModel):
    video_path: str
    caption: str
    scheduled_time: str  # ISO Timestamp
    platforms: list[str]  # ["instagram", "facebook", "youtube"]
    credentials: SchedulerCredentials = SchedulerCredentials()





