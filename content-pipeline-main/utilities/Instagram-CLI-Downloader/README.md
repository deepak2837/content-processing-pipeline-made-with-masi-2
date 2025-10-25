# Instagram CLI Downloader 🚀

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

A powerful, fast, and feature-rich **Instagram CLI Downloader** built with Node.js. Download Instagram posts, reels, videos, photos, stories, and highlights in bulk directly from your terminal. Whether you're an archivist, a social media manager, or just someone who wants to save their favorite content, this **Instagram scraper** provides everything you need in an interactive, user-friendly CLI.

If you find this tool helpful, please consider giving it a 🌟 on [GitHub](https://github.com/sadiakant/instagram-cli-downloader)!

---

## 🌟 Features

*   **Bulk Download Instagram Profiles**: Scan a complete profile and effortlessly download all their content into a single, organized ZIP file.
*   **Selective Media Downloading**: Choose exactly what you want to save. Support for:
    *   🎥 **Videos & Reels Downloader**: Save high-quality Instagram Reels and Videos.
    *   📸 **Photos & Carousels**: Download single pictures or multi-photo carousel posts.
    *   🖼️ **Thumbnails & Display Pictures (DP)**: Get the highest resolution profile pictures and post thumbnails.
    *   📖 **Instagram Story & Highlight Downloader**: Save active stories and archived highlights before they disappear.
*   **Specific Link Downloads**: Have a specific list of links? Paste them directly into the CLI to download only those specific posts.
*   **Highest Quality Media**: Automatically fetches the highest resolution available for any given asset without compression.
*   **Secure Session Handling**: Uses headless browsing to securely authenticate your session, ensuring reliable access without manual cookie extraction.
*   **Neat Packaging**: Zips your downloaded content automatically, naming the archive clearly (e.g., `username_reels_stories.zip`).

## 🛠️ Installation

### Prerequisites
*   [Node.js](https://nodejs.org/) (Version 18 or higher recommended)
*   Git

### Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/sadiakant/instagram-cli-downloader.git
    cd instagram-cli-downloader
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Run the application:**
    ```bash
    npm start
    ```

### 🍪 Cookie Configuration (Required for Scraping)

To download private posts or bypass rate limits, you must provide your Instagram session cookies.

1.  **Install a Cookie Extractor Extension**: Install a Chrome extension like **[Cookie Editor](https://cookie-editor.com/)**.
2.  **Log into Instagram**: Open your browser and log into your [Instagram](https://www.instagram.com/) account.
3.  **Extract Cookies**: Open the extension and export your cookies in **JSON format**.
4.  **Save the File**: 
    - Inside your project directory, create a folder named `.env` (if it doesn't exist).
    - Create a new file named `cookie.json` inside the `.env` folder.
    - Paste the copied JSON cookies into this file and save it (`.env/cookie.json`).

## 🚀 Usage

Using the **Instagram CLI Downloader** is incredibly straightforward thanks to its interactive terminal interface.

1.  Start the CLI by running `npm start`.
2.  **Select Download Mode:**
    *   `1. Download Selected Media`: Paste specific Instagram URLs (Reels, Posts, etc.) to download them immediately.
    *   `2. Download Bulk Media`: Enter an Instagram username or profile URL to scan the entire account.
3.  **Choose Media Types (Bulk Mode):** 
    After scanning a profile, the tool will display the available media count. You can select one or multiple categories:
    *   Enter `2` for Reels, or `1,3,7` for Videos, Photos, and Stories.
    *   Select `9` to download the **Whole Profile**.
4.  **Wait for Download**: The CLI will fetch the highest quality assets, download them, and package them into a neatly named `.zip` file in the `Downloads` folder of the project directory.

## 📂 Project Structure

```text
instagram-cli-downloader/
├── index.js # Main entry point of the CLI application
├── package.json # Project dependencies and SEO metadata
├── README.md # Project documentation
├── LICENSE # MIT License file
├── scripts/ # Core logic modules
│   ├── cli.js # Command-line interface and rendering logic
│   ├── constants.js # Shared constants, patterns, and ANSI colors
│   ├── downloader.js # Media downloading and ZIP packaging logic
│   ├── instagram-media.js # Extracting media from posts/stories
│   ├── instagram-session.js # Browser session and scraping management
│   └── selected-media.js # Handler for specific URL downloads
├── .env # Environment variables
└── Downloads/ # Output directory for your saved .zip files

```

## 🤝 Contributing

Contributions make the open-source community an amazing place to learn, inspire, and create. Any contributions you make to this **Instagram Video Downloader** are **greatly appreciated**.

Please review our [Contributing Guidelines](.github/CONTRIBUTING.md) and [Code of Conduct](.github/CODE_OF_CONDUCT.md) before submitting a pull request or creating an issue.

## 🛡️ Security

We take the security of your Instagram sessions seriously. Please read our [Security Policy](.github/SECURITY.md) for information on how we handle sessions and how to report vulnerabilities.

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.

---
*Created with ❤️ by [sadiakant](https://github.com/sadiakant)*
