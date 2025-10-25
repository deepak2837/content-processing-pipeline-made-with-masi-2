/**
 * Headless wrapper for Instagram-CLI-Downloader.
 * Called by the Python backend as a subprocess.
 *
 * Usage:
 *   node headless.js --username <handle_or_url> --types <comma_separated> [--output <dir>] [--cookie <path>]
 *
 * --types can be: reels, videos, photos, carousels, thumbnails, dp, stories, highlights, all
 * Output is JSON lines printed to stdout, prefixed with "PROGRESS:" or "RESULT:".
 */

const path = require('path');
const fs = require('fs');
const {
  createBrowserSession,
  closeBrowserSession,
  scanProfile,
} = require('./scripts/instagram-session');
const {
  buildAssetsForSelection,
  downloadMedia,
} = require('./scripts/downloader');
const { sanitizeName } = require('./scripts/cli');
const { DOWNLOADS_DIR } = require('./scripts/constants');

function emit(type, data) {
  console.log(`${type}:${JSON.stringify(data)}`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--username' && args[i + 1]) parsed.username = args[++i];
    else if (args[i] === '--types' && args[i + 1]) parsed.types = args[++i];
    else if (args[i] === '--output' && args[i + 1]) parsed.output = args[++i];
    else if (args[i] === '--cookie' && args[i + 1]) parsed.cookie = args[++i];
    else if (args[i] === '--captions') parsed.captions = true;
  }
  return parsed;
}

async function main() {
  const args = parseArgs();

  if (!args.username) {
    emit('ERROR', { message: 'Missing --username argument' });
    process.exit(1);
  }

  const typesRaw = (args.types || 'all').toLowerCase().split(',').map(t => t.trim());
  let selectedOptions;
  if (typesRaw.includes('all')) {
    selectedOptions = new Set(['videos', 'reels', 'photos', 'carousels', 'thumbnails', 'dp', 'stories', 'highlights']);
  } else {
    selectedOptions = new Set(typesRaw);
  }

  emit('PROGRESS', { status: 'starting', message: 'Creating browser session...' });

  let session;
  try {
    session = await createBrowserSession();
  } catch (err) {
    emit('ERROR', { message: `Failed to create browser session: ${err.message}` });
    process.exit(1);
  }

  try {
    emit('PROGRESS', { status: 'scanning', message: `Scanning profile: ${args.username}` });
    const scan = await scanProfile(session, args.username);

    emit('PROGRESS', {
      status: 'scanned',
      message: `Scan complete for @${scan.profile.username}`,
      profile: {
        username: scan.profile.username,
        totalPosts: scan.profile.totalPosts,
        followers: scan.profile.followers,
        following: scan.profile.following,
        isPrivate: scan.profile.isPrivate,
      },
      summary: scan.summary,
    });

    // Extract captions/tags if requested
    let captionsPath = null;
    if (args.captions && scan.timelinePosts && scan.timelinePosts.length > 0) {
      emit('PROGRESS', { status: 'extracting_captions', message: 'Extracting captions and tags...' });

      const captions = scan.timelinePosts.map((node) => {
        const captionText = node.caption?.text || '';
        const hashtags = captionText.match(/#[\w\u0900-\u097F]+/g) || [];
        const mentions = captionText.match(/@[\w.]+/g) || [];
        const isReel = node.product_type === 'clips';
        const isCarousel = node.media_type === 8;
        const mediaType = isReel ? 'reel' : isCarousel ? 'carousel' : node.media_type === 2 ? 'video' : 'photo';
        const timestamp = node.taken_at ? new Date(node.taken_at * 1000).toISOString() : null;

        return {
          shortcode: node.code || null,
          media_type: mediaType,
          permalink: node.code ? `https://www.instagram.com/${isReel ? 'reel' : 'p'}/${node.code}/` : null,
          caption: captionText,
          hashtags: [...new Set(hashtags)],
          mentions: [...new Set(mentions)],
          like_count: node.like_count || 0,
          comment_count: node.comment_count || 0,
          posted_at: timestamp,
        };
      });

      const outputDir = args.output || DOWNLOADS_DIR;
      fs.mkdirSync(outputDir, { recursive: true });
      captionsPath = path.join(outputDir, `${sanitizeName(scan.profile.username)}_captions.json`);
      fs.writeFileSync(captionsPath, JSON.stringify(captions, null, 2), 'utf-8');

      emit('PROGRESS', { status: 'captions_done', message: `Extracted captions for ${captions.length} post(s).` });
    }

    // Build assets
    emit('PROGRESS', { status: 'preparing', message: 'Preparing download assets...' });
    const assets = await buildAssetsForSelection(scan, selectedOptions);

    if (assets.length === 0 && !captionsPath) {
      emit('RESULT', {
        status: 'completed',
        message: 'No downloadable media matched the selected options.',
        downloadCount: 0,
        zipPath: null,
        captionsPath: null,
      });
      return;
    }

    if (assets.length > 0) {
      emit('PROGRESS', { status: 'downloading', message: `Downloading ${assets.length} file(s)...` });

      // Build zip filename
      const selectedSlug = [...selectedOptions].sort().join('_');
      const zipFilename = `${sanitizeName(scan.profile.username)}_${selectedSlug}.zip`;

      await downloadMedia(assets, zipFilename, session.userAgent);

      const zipPath = path.join(DOWNLOADS_DIR, zipFilename);
      const exists = fs.existsSync(zipPath);

      // If custom output directory, copy the zip there
      let finalPath = zipPath;
      if (args.output && exists) {
        fs.mkdirSync(args.output, { recursive: true });
        finalPath = path.join(args.output, zipFilename);
        fs.copyFileSync(zipPath, finalPath);
      }

      const stats = exists ? fs.statSync(finalPath) : null;

      emit('RESULT', {
        status: 'completed',
        message: `Downloaded ${assets.length} file(s) successfully.`,
        downloadCount: assets.length,
        zipPath: finalPath,
        zipSize: stats ? stats.size : 0,
        zipFilename,
        captionsPath: captionsPath || null,
      });
    } else {
      // Only captions were requested, no media to download
      emit('RESULT', {
        status: 'completed',
        message: `Extracted captions only (no media selected).`,
        downloadCount: 0,
        zipPath: null,
        captionsPath: captionsPath || null,
      });
    }

  } catch (err) {
    emit('ERROR', { message: err.message });
    process.exit(1);
  } finally {
    await closeBrowserSession(session);
  }
}

main();
