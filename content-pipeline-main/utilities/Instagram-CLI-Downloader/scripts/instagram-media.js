const path = require('path');

const { NAVIGATION_WAIT_UNTIL, NAVIGATION_TIMEOUT_MS } = require('./constants');
const { sanitizeSegment, renderProgressLine, finishProgressLine } = require('./cli');

function getBestImageCandidate(candidates = []) {
  return [...candidates]
    .filter((candidate) => candidate && candidate.url)
    .sort((a, b) => ((b.width || 0) * (b.height || 0)) - ((a.width || 0) * (a.height || 0)))[0] || null;
}

function getBestVideoCandidate(versions = []) {
  return [...versions]
    .filter((version) => version && version.url)
    .sort((a, b) => {
      const areaDiff = ((b.width || 0) * (b.height || 0)) - ((a.width || 0) * (a.height || 0));
      if (areaDiff !== 0) return areaDiff;
      return (b.type || 0) - (a.type || 0);
    })[0] || null;
}

function getFileExtension(url, fallback = '.bin') {
  try {
    const ext = path.extname(new URL(url).pathname);
    return ext || fallback;
  } catch {
    return fallback;
  }
}

function createAsset({ url, folder, baseName, extensionFallback, category, sourceCode }) {
  return {
    url,
    folder,
    category,
    sourceCode,
    filename: `${baseName}${getFileExtension(url, extensionFallback)}`,
  };
}

function extractJsonValueAfterKey(source, key) {
  const keyIndex = source.indexOf(key);
  if (keyIndex === -1) return null;

  let valueStart = -1;
  for (let i = keyIndex + key.length; i < source.length; i++) {
    const char = source[i];
    if (char === '{' || char === '[') {
      valueStart = i;
      break;
    }
  }

  if (valueStart === -1) return null;

  const openingChar = source[valueStart];
  const closingChar = openingChar === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = valueStart; i < source.length; i++) {
    const char = source[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === openingChar) depth++;
    if (char === closingChar) depth--;

    if (depth === 0) {
      return JSON.parse(source.slice(valueStart, i + 1));
    }
  }

  return null;
}

function getPermalinkForNode(node, username) {
  const route = node.product_type === 'clips' ? 'reel' : 'p';
  return `https://www.instagram.com/${username}/${route}/${node.code}/`;
}

async function hydratePostNode(page, postUrl) {
  try {
    await page.goto(postUrl, { waitUntil: NAVIGATION_WAIT_UNTIL, timeout: NAVIGATION_TIMEOUT_MS });
    const html = await page.content();
    const payload = extractJsonValueAfterKey(html, '"xdt_api__v1__media__shortcode__web_info":');
    return payload?.items?.[0] || null;
  } catch {
    return null;
  }
}

async function ensureNodeHasMedia(page, node, username) {
  const mediaItems = node.media_type === 8 ? node.carousel_media || [] : [node];
  const needsHydration = mediaItems.some((item) => item.media_type === 2 && !item.video_versions?.length);

  if (!needsHydration) return node;

  return (await hydratePostNode(page, getPermalinkForNode(node, username))) || node;
}

function buildPostAssets(node, selectedOptions) {
  const assets = [];
  const mediaItems = node.media_type === 8 ? node.carousel_media || [] : [node];
  const isReel = node.product_type === 'clips';
  const isCarousel = node.media_type === 8;
  const wantsCarousel = selectedOptions.has('carousels');

  mediaItems.forEach((item, index) => {
    const suffix = mediaItems.length > 1 ? `_${String(index + 1).padStart(2, '0')}` : '';
    const baseName = `${node.code}${suffix}`;

    if (item.media_type === 1 && ((!isCarousel && selectedOptions.has('photos')) || (isCarousel && wantsCarousel))) {
      const bestImage = getBestImageCandidate(item.image_versions2?.candidates);
      if (bestImage?.url) {
        assets.push(
          createAsset({
            url: bestImage.url,
            folder: isCarousel ? `carousel/${node.code}` : 'photos',
            baseName,
            extensionFallback: '.jpg',
            category: isCarousel ? 'carousel-photo' : 'photo',
            sourceCode: node.code,
          })
        );
      }
    }

    if (item.media_type === 2) {
      const bestVideo = getBestVideoCandidate(item.video_versions);
      const bestImage = getBestImageCandidate(item.image_versions2?.candidates);

      if (bestVideo?.url) {
        const wantsVideo = isReel
          ? selectedOptions.has('reels')
          : isCarousel
            ? wantsCarousel
            : selectedOptions.has('videos');
        if (wantsVideo) {
          assets.push(
            createAsset({
              url: bestVideo.url,
              folder: isReel ? 'reels' : isCarousel ? `carousel/${node.code}` : 'videos',
              baseName,
              extensionFallback: '.mp4',
              category: isReel ? 'reel' : isCarousel ? 'carousel-video' : 'video',
              sourceCode: node.code,
            })
          );
        }
      }

      if (selectedOptions.has('thumbnails') && bestImage?.url) {
        assets.push(
          createAsset({
            url: bestImage.url,
            folder: 'thumbnails',
            baseName: `${baseName}_thumbnail`,
            extensionFallback: '.jpg',
            category: 'thumbnail',
            sourceCode: node.code,
          })
        );
      }
    }
  });

  return assets;
}

async function extractStories(page, username) {
  try {
    await page.goto(`https://www.instagram.com/stories/${username}/`, {
      waitUntil: NAVIGATION_WAIT_UNTIL,
      timeout: NAVIGATION_TIMEOUT_MS,
    });

    if (!page.url().includes('/stories/')) {
      return [];
    }

    const html = await page.content();
    const payload = extractJsonValueAfterKey(html, '"xdt_api__v1__feed__reels_media":');
    const reelsMedia = payload?.reels_media?.[0];

    if (!reelsMedia?.items?.length) {
      return [];
    }

    const assets = [];

    reelsMedia.items.forEach((item, index) => {
      const baseName = `${username}_story_${String(index + 1).padStart(2, '0')}`;

      if (item.media_type === 2) {
        const bestVideo = getBestVideoCandidate(item.video_versions);
        if (bestVideo?.url) {
          assets.push(
            createAsset({
              url: bestVideo.url,
              folder: 'stories',
              baseName,
              extensionFallback: '.mp4',
              category: 'story-video',
              sourceCode: item.pk || baseName,
            })
          );
        }
      } else {
        const bestImage = getBestImageCandidate(item.image_versions2?.candidates);
        if (bestImage?.url) {
          assets.push(
            createAsset({
              url: bestImage.url,
              folder: 'stories',
              baseName,
              extensionFallback: '.jpg',
              category: 'story-image',
              sourceCode: item.pk || baseName,
            })
          );
        }
      }
    });

    return assets;
  } catch {
    return [];
  }
}

function getReelsMediaItemsFromPayload(payload) {
  if (!payload) return [];
  if (Array.isArray(payload?.reels_media)) {
    return payload.reels_media[0]?.items || [];
  }
  if (Array.isArray(payload?.edges)) {
    return payload.edges.flatMap((edge) => edge?.node?.items || []);
  }
  if (Array.isArray(payload) && payload[0]?.items) {
    return payload[0].items;
  }
  if (Array.isArray(payload?.items)) {
    return payload.items;
  }
  return [];
}

function findNestedValue(source, targetKey) {
  if (!source || typeof source !== 'object') return null;

  if (Array.isArray(source)) {
    for (const item of source) {
      const result = findNestedValue(item, targetKey);
      if (result != null) return result;
    }
    return null;
  }

  if (Object.prototype.hasOwnProperty.call(source, targetKey)) {
    return source[targetKey];
  }

  for (const value of Object.values(source)) {
    const result = findNestedValue(value, targetKey);
    if (result != null) return result;
  }

  return null;
}

function extractReelsMediaItemsFromHtml(html) {
  const payloadCandidates = [
    extractJsonValueAfterKey(html, '"xdt_api__v1__feed__reels_media__connection":'),
    extractJsonValueAfterKey(html, '"xdt_api__v1__feed__reels_media":'),
    extractJsonValueAfterKey(html, '"reels_media":'),
  ];

  for (const candidate of payloadCandidates) {
    const items = getReelsMediaItemsFromPayload(candidate);
    if (items.length > 0) {
      return items;
    }
  }

  return [];
}

function extractReelsMediaItemsFromResponsePayload(payload) {
  const directItems = getReelsMediaItemsFromPayload(payload);
  if (directItems.length > 0) {
    return directItems;
  }

  const reelsMediaConnection = findNestedValue(payload, 'xdt_api__v1__feed__reels_media__connection');
  const connectionItems = getReelsMediaItemsFromPayload(reelsMediaConnection);
  if (connectionItems.length > 0) {
    return connectionItems;
  }

  const reelsMedia = findNestedValue(payload, 'reels_media');
  return getReelsMediaItemsFromPayload({ reels_media: reelsMedia });
}

async function loadReelsMediaItems(page, url, expectedPathFragment) {
  let responseItems = [];

  const handleResponse = async (response) => {
    try {
      if (!response.url().includes('/graphql/query')) return;
      const payload = JSON.parse(await response.text());
      const items = extractReelsMediaItemsFromResponsePayload(payload);
      if (items.length > 0) {
        responseItems = items;
      }
    } catch {
      // Ignore unrelated responses.
    }
  };

  page.on('response', handleResponse);

  try {
    await page.goto(url, {
      waitUntil: NAVIGATION_WAIT_UNTIL,
      timeout: NAVIGATION_TIMEOUT_MS,
    });

    if (expectedPathFragment && !page.url().includes(expectedPathFragment)) {
      return [];
    }

    if (responseItems.length > 0) {
      return responseItems;
    }

    const html = await page.content();
    return extractReelsMediaItemsFromHtml(html);
  } finally {
    page.off('response', handleResponse);
  }
}

async function extractHighlights(page, username, highlightEntries, onProgress = null) {
  const assets = [];
  let tick = 0;

  if (highlightEntries.length === 0) {
    return assets;
  }

  for (let i = 0; i < highlightEntries.length; i++) {
    const entry = highlightEntries[i];
    if (typeof onProgress === 'function') {
      onProgress(i + 1, highlightEntries.length, entry.title || `highlight_${i + 1}`);
    } else {
      renderProgressLine(
        'Collecting highlights',
        i + 1,
        highlightEntries.length,
        tick,
        entry.title || `highlight_${i + 1}`
      );
      tick += 1;
    }

    try {
      const highlightUrl = entry.href.startsWith('http')
        ? entry.href
        : `https://www.instagram.com${entry.href.startsWith('/') ? '' : '/'}${entry.href}`;
      const items = await loadReelsMediaItems(page, highlightUrl, '/stories/highlights/');

      if (!items.length) {
        continue;
      }

      const folderName = sanitizeSegment(entry.title || `highlight_${i + 1}`, `highlight_${i + 1}`);

      items.forEach((item, itemIndex) => {
        const baseName = `${username}_${folderName}_${String(itemIndex + 1).padStart(2, '0')}`;

        if (item.media_type === 2) {
          const bestVideo = getBestVideoCandidate(item.video_versions);
          if (bestVideo?.url) {
            assets.push(
              createAsset({
                url: bestVideo.url,
                folder: `highlights/${folderName}`,
                baseName,
                extensionFallback: '.mp4',
                category: 'highlight-video',
                sourceCode: item.pk || baseName,
              })
            );
          }
        } else {
          const bestImage = getBestImageCandidate(item.image_versions2?.candidates);
          if (bestImage?.url) {
            assets.push(
              createAsset({
                url: bestImage.url,
                folder: `highlights/${folderName}`,
                baseName,
                extensionFallback: '.jpg',
                category: 'highlight-image',
                sourceCode: item.pk || baseName,
              })
            );
          }
        }
      });
    } catch {
      // Skip highlights that fail to load.
    }
  }

  if (typeof onProgress !== 'function') {
    finishProgressLine();
  }
  return assets;
}

module.exports = {
  getBestImageCandidate,
  getBestVideoCandidate,
  createAsset,
  extractJsonValueAfterKey,
  findNestedValue,
  hydratePostNode,
  ensureNodeHasMedia,
  buildPostAssets,
  extractStories,
  extractHighlights,
};
