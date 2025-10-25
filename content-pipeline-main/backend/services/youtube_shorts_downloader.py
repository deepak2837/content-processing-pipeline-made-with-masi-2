#!/usr/bin/env python3
"""YouTube Shorts Downloader

Download YouTube Shorts from a channel handle or a single short URL.
The script saves video files, subtitle files, description files, and JSON metadata.
"""

import argparse
import os
from urllib.parse import urlparse

import yt_dlp

CHANNEL_TRIM_PARTS = [
    '/about',
    '/community',
    '/playlist',
    '/playlists',
    '/streams',
    '/featured',
    '/videos',
]


def is_youtube_video_url(url: str) -> bool:
    url = url.strip()
    return 'youtu.be/' in url or '/watch?' in url or '/shorts/' in url


def normalize_channel_shorts_url(url: str) -> str:
    url = url.strip()
    if is_youtube_video_url(url):
        return url

    parsed = urlparse(url)
    netloc = parsed.netloc.lower()
    if not netloc.endswith('youtube.com'):
        raise ValueError(f'Unsupported YouTube URL: {url}')

    path = parsed.path.rstrip('/')
    if '/@' in path:
        username = path.split('/@')[1].split('/')[0]
        return f'https://www.youtube.com/@{username}/shorts'

    for part in CHANNEL_TRIM_PARTS:
        if path.endswith(part):
            path = path[: -len(part)]
            path = path.rstrip('/')
            break

    if not path:
        return 'https://www.youtube.com/shorts'

    return f'https://www.youtube.com{path}/shorts'


def extract_short_links(channel_url: str, max_videos: int = 5, quiet: bool = True) -> list[str]:
    shorts_url = normalize_channel_shorts_url(channel_url)
    ydl_opts = {
        'quiet': quiet,
        'extract_flat': True,
        'playlistend': max_videos,
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(shorts_url, download=False)

    if not info or 'entries' not in info:
        return []

    links = []
    for entry in info['entries'] or []:
        if not isinstance(entry, dict):
            continue

        video_id = entry.get('id') or entry.get('url')
        if not video_id:
            continue

        if video_id.startswith('http'):
            link = video_id
        else:
            link = f'https://www.youtube.com/shorts/{video_id}'

        links.append(link)
        if len(links) >= max_videos:
            break

    return links


def download_links(
    links: list[str],
    output_dir: str,
    captions: bool = True,
    description: bool = True,
    infojson: bool = True,
    verbose: bool = False,
) -> None:
    os.makedirs(output_dir, exist_ok=True)

    ydl_opts = {
        'format': 'bestvideo+bestaudio/best',
        'outtmpl': os.path.join(output_dir, '%(title)s [%(id)s].%(ext)s'),
        'writesubtitles': captions,
        'writeautomaticsub': captions,
        'allsubtitles': captions,
        'subtitlesformat': 'vtt',
        'writethumbnail': True,
        'writedescription': description,
        'writeinfojson': infojson,
        'quiet': not verbose,
        'no_warnings': not verbose,
        'ignoreerrors': True,
    }

    if not captions:
        for key in ('writesubtitles', 'writeautomaticsub', 'allsubtitles', 'subtitlesformat'):
            ydl_opts.pop(key, None)

    if not description:
        ydl_opts.pop('writedescription', None)

    if not infojson:
        ydl_opts.pop('writeinfojson', None)

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download(links)


def download_youtube_shorts(
    source_url: str,
    output_dir: str | None = None,
    max_videos: int = 5,
    captions: bool = True,
    description: bool = True,
    infojson: bool = True,
    verbose: bool = False,
) -> str:
    output_dir = output_dir or os.path.join(os.getcwd(), 'youtube_shorts_downloader_output')

    if is_youtube_video_url(source_url):
        links = [source_url]
    else:
        links = extract_short_links(source_url, max_videos=max_videos, quiet=not verbose)

    if not links:
        raise ValueError(f'No shorts found for URL: {source_url}')

    if len(links) > max_videos:
        links = links[:max_videos]

    download_links(
        links,
        output_dir=output_dir,
        captions=captions,
        description=description,
        infojson=infojson,
        verbose=verbose,
    )

    return output_dir


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog='youtube shorts downloader',
        description='Download YouTube Shorts from a channel or a single short URL.',
    )
    parser.add_argument('source_url', help='YouTube channel URL or short URL')
    parser.add_argument(
        '--max-videos',
        type=int,
        default=5,
        help='Maximum number of shorts to download when a channel URL is provided',
    )
    parser.add_argument(
        '--output-dir',
        default='youtube_shorts_downloader_output',
        help='Directory where videos, captions, and metadata will be saved',
    )
    parser.add_argument('--no-captions', action='store_true', help='Do not download subtitles/captions')
    parser.add_argument('--no-description', action='store_true', help='Do not write description files')
    parser.add_argument('--no-infojson', action='store_true', help='Do not write info JSON metadata files')
    parser.add_argument('--verbose', action='store_true', help='Show yt-dlp progress output')
    return parser.parse_args()


if __name__ == '__main__':
    args = parse_args()
    try:
        target_dir = download_youtube_shorts(
            args.source_url,
            output_dir=args.output_dir,
            max_videos=args.max_videos,
            captions=not args.no_captions,
            description=not args.no_description,
            infojson=not args.no_infojson,
            verbose=args.verbose,
        )
        print(f'Finished downloading shorts. Files saved to: {target_dir}')
    except Exception as exc:
        print(f'Error: {exc}')
        raise
