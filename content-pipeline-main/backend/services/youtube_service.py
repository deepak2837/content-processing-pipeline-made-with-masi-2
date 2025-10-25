"""YouTube Shorts download service.

Wraps the standalone ``youtube_shorts_downloader`` helpers and drives
them through the shared *job_manager* so the frontend can poll progress
in real-time – exactly the same pattern used by ``instagram_service``.
"""

import os
import traceback

from backend.core.job_manager import job_manager
from backend.services.youtube_shorts_downloader import (
    download_youtube_shorts,
    is_youtube_video_url,
    extract_short_links,
)


class YoutubeService:
    @staticmethod
    def process_download(
        job_id: str,
        source_url: str,
        download_path: str,
        max_videos: int = 5,
        download_captions: bool = True,
        download_description: bool = True,
        download_metadata: bool = True,
        verbose: bool = False,
    ):
        job_manager.update_job(
            job_id,
            status="downloading",
            progress="Resolving YouTube URL…",
        )

        try:
            # ── Discover links ──────────────────────────────
            if is_youtube_video_url(source_url):
                links = [source_url]
                job_manager.update_job(
                    job_id, progress="Single video detected – starting download…"
                )
            else:
                job_manager.update_job(
                    job_id,
                    progress=f"Scanning channel for up to {max_videos} shorts…",
                )
                links = extract_short_links(
                    source_url, max_videos=max_videos, quiet=not verbose
                )

            if not links:
                job_manager.update_job(
                    job_id,
                    status="error",
                    progress="Failed",
                    error=f"No shorts found for URL: {source_url}",
                )
                return

            if len(links) > max_videos:
                links = links[:max_videos]

            total = len(links)
            job_manager.update_job(
                job_id,
                progress=f"Found {total} short(s). Downloading…",
            )

            # ── Download ────────────────────────────────────
            output_dir = download_youtube_shorts(
                source_url=source_url,
                output_dir=download_path,
                max_videos=max_videos,
                captions=download_captions,
                description=download_description,
                infojson=download_metadata,
                verbose=verbose,
            )

            # Count downloaded files
            downloaded_count = 0
            if os.path.isdir(output_dir):
                downloaded_count = sum(
                    1
                    for f in os.listdir(output_dir)
                    if f.endswith((".mp4", ".webm", ".mkv"))
                )

            result_msg = (
                f"Completed. Downloaded {downloaded_count} video(s) to {output_dir}"
            )
            job_manager.update_job(
                job_id, status="completed", progress=result_msg
            )

        except Exception as exc:
            job_manager.update_job(
                job_id,
                status="error",
                progress="Failed",
                error=f"{exc}\n{traceback.format_exc()[:500]}",
            )


youtube_service = YoutubeService()
