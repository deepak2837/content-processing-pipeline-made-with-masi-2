const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const { DOWNLOADS_DIR, ANSI } = require('./constants');
const {
  ensureDirectoryExists,
  renderProgressLine,
  clearProgressLine,
  finishProgressLine,
  createSmoothProgress,
  renderMenuBox,
  formatFileSize,
  formatDateTime,
  colorize,
} = require('./cli');
const { createAsset, extractHighlights, ensureNodeHasMedia, buildPostAssets } = require('./instagram-media');

function dedupeAssets(assets) {
  const unique = new Map();
  for (const asset of assets) {
    const key = `${asset.folder}|${asset.url}`;
    if (!unique.has(key)) unique.set(key, asset);
  }
  return Array.from(unique.values());
}

async function buildAssetsForSelection(scan, selectedOptions) {
  const assets = [];

  if (selectedOptions.has('dp') && scan.profile.dpUrl) {
    assets.push(
      createAsset({
        url: scan.profile.dpUrl,
        folder: 'dp',
        baseName: `${scan.profile.username}_dp`,
        extensionFallback: '.jpg',
        category: 'dp',
        sourceCode: 'dp',
      })
    );
  }

  if (selectedOptions.has('stories')) {
    assets.push(...scan.storyAssets);
  }

  if (selectedOptions.has('highlights')) {
    if (scan.highlightAssets.length === 0 && scan.highlightEntries?.length > 0) {
      console.log('\nRefreshing highlight media...');
      scan.highlightAssets = await extractHighlights(scan.session.detailPage, scan.profile.username, scan.highlightEntries);
    }
    assets.push(...scan.highlightAssets);
  }

  const needsTimelineAssets = ['videos', 'reels', 'photos', 'carousels', 'thumbnails'].some((key) => selectedOptions.has(key));
  if (!needsTimelineAssets) {
    return dedupeAssets(assets);
  }

  console.log('\nPreparing selected post media...');
  const prepareProgress = createSmoothProgress('Preparing media', 100);
  prepareProgress.pulseUntil(2, `Preparing media from ${scan.timelinePosts.length} scanned post(s)`);
  try {
    for (let i = 0; i < scan.timelinePosts.length; i++) {
      let node = scan.timelinePosts[i];
      const mediaLabel =
        node.product_type === 'clips'
          ? `reel/${node.code}`
          : node.media_type === 8
            ? `carousel/${node.code}`
            : node.media_type === 2
              ? `video/${node.code}`
              : `photo/${node.code}`;
      prepareProgress.pulseUntil(((i + 0.9) / scan.timelinePosts.length) * 100, mediaLabel);
      node = await ensureNodeHasMedia(scan.session.detailPage, node, scan.profile.username);
      scan.timelinePosts[i] = node;
      assets.push(...buildPostAssets(node, selectedOptions));
      prepareProgress.set(((i + 1) / scan.timelinePosts.length) * 100, mediaLabel);
    }
    prepareProgress.complete('Prepared media');
  } catch (error) {
    prepareProgress.stop();
    finishProgressLine();
    throw error;
  }
  console.log(`Prepared media from ${scan.timelinePosts.length} scanned post(s).`);

  return dedupeAssets(assets);
}

async function downloadMedia(assets, zipFilename, userAgent) {
  ensureDirectoryExists(DOWNLOADS_DIR);
  const zip = new JSZip();
  let downloaded = 0;
  const downloadProgress = createSmoothProgress('Downloading', 100);
  downloadProgress.pulseUntil(2, `Download queue started with ${assets.length} file(s)`);

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];

    try {
      downloadProgress.pulseUntil(((i + 0.9) / assets.length) * 100, `${asset.folder}/${asset.filename}`);
      const response = await fetch(asset.url, {
        headers: {
          'user-agent': userAgent,
          referer: 'https://www.instagram.com/',
        },
      });

      if (!response.ok) {
        downloadProgress.stop();
        clearProgressLine();
        console.log(`Skipping ${asset.filename} - HTTP ${response.status}`);
        downloadProgress.set(((i + 1) / assets.length) * 100, `Skipped ${asset.filename}`);
        continue;
      }

      zip.file(`${asset.folder}/${asset.filename}`, Buffer.from(await response.arrayBuffer()));
      downloaded += 1;
      downloadProgress.set(((i + 1) / assets.length) * 100, `${asset.folder}/${asset.filename}`);
    } catch (error) {
      downloadProgress.stop();
      clearProgressLine();
      console.log(`Failed to download ${asset.filename}: ${error.message}`);
      downloadProgress.set(((i + 1) / assets.length) * 100, `Failed ${asset.filename}`);
    }
  }

  downloadProgress.complete('Download pass complete');

  if (downloaded === 0) {
    console.log('No media could be downloaded.');
    return;
  }

  const absoluteZipPath = path.join(DOWNLOADS_DIR, zipFilename);
  let packageTick = 0;
  const zipBuffer = await zip.generateAsync(
    { type: 'nodebuffer' },
    (metadata) => {
      const current = Math.max(1, Math.round(metadata.percent || 0));
      renderProgressLine('Packaging ZIP', current, 100, packageTick, metadata.currentFile || zipFilename);
      packageTick += 1;
    }
  );
  finishProgressLine();
  fs.writeFileSync(absoluteZipPath, zipBuffer);
  const zipStats = fs.statSync(absoluteZipPath);
  renderMenuBox(
    'Download Complete',
    `Downloaded ${downloaded} file(s) successfully`,
    [
      `ZIP Name       : ${path.basename(absoluteZipPath)}`,
      `ZIP Path       : ${absoluteZipPath}`,
      `ZIP Size       : ${formatFileSize(zipStats.size)}`,
      `Created At     : ${formatDateTime(zipStats.birthtime)}`,
    ],
    ANSI.green
  );

  console.log(`\n${colorize('⭐ If you find this tool helpful, please give it a star on GitHub:', ANSI.yellow)}`);
  console.log(colorize('   https://github.com/sadiakant/instagram-cli-downloader\n', ANSI.cyan));
}

module.exports = {
  buildAssetsForSelection,
  downloadMedia,
};
