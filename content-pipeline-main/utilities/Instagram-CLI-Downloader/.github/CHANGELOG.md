# Changelog

All notable changes to this project are documented in this file.

## [0.0.1] - 2026-05-04

- Added: **Advanced Instagram Resource Resolution** that automatically identifies profile owners from stories, highlights, posts, or reels URLs using metadata analysis and path resolution.
- Added: **Multi-Stage Scraper Engine** featuring automated retries and dual-source extraction (Profile API + HTML Fallback) to ensure high reliability across different account types.
- Added: **Highest-Quality Media Selection Logic** that dynamically analyzes all available asset versions and selects the highest resolution based on pixel area (width x height) for both photos and videos.
- Added: **Bulk Timeline Extraction** with infinite pagination support, duplicate post detection, and automated 'hydration' of post data if video metadata is missing from the initial scan.
- Added: **Granular Media Filtering** allowing users to select specific categories for download: Videos, Reels, Photos, Carousels, Thumbnails, Profile Pictures (DP), Stories, and Highlights.
- Added: **Smart Highlight Archiving** that identifies highlight collections on-the-fly and organizes them into categorized sub-folders within the final ZIP archive.
- Added: **Interactive 'Smooth Progress' System** featuring pulsed activity indicators, real-time status details, and a sophisticated progress bar with catch-up logic for a better user experience.
- Added: **Detailed Scan Reporting** providing a comprehensive overview of profile statistics (followers, following, post count) and discovered media assets before downloading.
- Added: **Secure Session Integration** supporting `cookie.json` for authenticated scraping, enabling access to private profiles and bypassing Instagram rate limits.
- Added: **Optimized ZIP Packaging** using `jszip` with intelligent filename sanitization and real-time compression progress tracking.
- Added: **Direct Link Mode** for lightning-fast downloads of specific content via individual URLs without requiring a full profile scan.
- Added: **Branded Terminal UI** utilizing custom ANSI color schemes and structured menu boxes to provide a professional and premium CLI experience.
- Added: **Community Engagement Mechanism** with a built-in GitHub star prompt displayed upon successful download completion.
- Added: **Complete Documentation Suite** including a comprehensive `README.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `SECURITY.md`, and `LICENSE`.
