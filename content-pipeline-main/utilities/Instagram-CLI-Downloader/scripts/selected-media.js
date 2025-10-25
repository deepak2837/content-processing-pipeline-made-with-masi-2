const {
  ANSI,
  INSTAGRAM_HOST_PATTERN,
  INSTAGRAM_WEB_APP_ID,
  NAVIGATION_TIMEOUT_MS,
  NAVIGATION_WAIT_UNTIL,
  PROFILE_SECTION_SEGMENTS,
} = require('./constants');
const {
  createSmoothProgress,
  normalizeInstagramUsername,
  parseInstagramUrl,
  renderMenuBox,
  sanitizeSegment,
} = require('./cli');
const {
  buildPostAssets,
  createAsset,
  extractHighlights,
  extractJsonValueAfterKey,
  extractStories,
  hydratePostNode,
} = require('./instagram-media');

const DIRECT_POST_OPTIONS = new Set(['videos', 'reels', 'photos', 'carousels']);

function canonicalizeInstagramUrl(url) {
  return `https://www.instagram.com${url.pathname.replace(/\/?$/, '/')}`;
}

function getProfilePictureUrl(profileData) {
  return (
    profileData?.hd_profile_pic_url_info?.url ||
    profileData?.profile_pic_url_hd ||
    profileData?.profile_pic_url ||
    null
  );
}

function classifySelectedMediaLink(input) {
  const url = parseInstagramUrl(input);
  if (!INSTAGRAM_HOST_PATTERN.test(url.hostname)) {
    throw new Error(`Invalid Instagram link: ${input}`);
  }

  const parts = url.pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment));

  if ((parts[0] === 'p' || parts[0] === 'reel' || parts[0] === 'reels' || parts[0] === 'tv') && parts[1]) {
    return { type: 'post', url: canonicalizeInstagramUrl(url), code: parts[1] };
  }

  if (parts[0] === 'stories' && parts[1] === 'highlights' && parts[2]) {
    return { type: 'highlight', url: canonicalizeInstagramUrl(url), id: parts[2] };
  }

  if (parts[0] === 'stories' && parts[1]) {
    const username = normalizeInstagramUsername(parts[1]);
    if (username) return { type: 'story', url: canonicalizeInstagramUrl(url), username };
  }

  const username = normalizeInstagramUsername(parts[0]);
  if (username && (parts.length === 1 || PROFILE_SECTION_SEGMENTS.has(parts[1]))) {
    return {
      type: 'profile-dp',
      url: `https://www.instagram.com/${username}/`,
      username,
    };
  }

  throw new Error(`Unsupported selected media link: ${input}`);
}

async function fetchProfileDpAsset(page, username) {
  await page.goto(`https://www.instagram.com/${username}/`, {
    waitUntil: NAVIGATION_WAIT_UNTIL,
    timeout: NAVIGATION_TIMEOUT_MS,
  });

  let profileData = null;
  try {
    const payload = await page.evaluate(
      async (targetUsername, appId) => {
        const response = await fetch(
          `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(targetUsername)}`,
          {
            credentials: 'include',
            headers: {
              'x-ig-app-id': appId,
              'x-requested-with': 'XMLHttpRequest',
            },
          }
        );

        if (!response.ok) return null;
        return await response.json();
      },
      username,
      INSTAGRAM_WEB_APP_ID
    );
    profileData = payload?.data?.user || null;
  } catch {
    profileData = null;
  }

  if (!profileData) {
    const html = await page.content();
    const candidate =
      extractJsonValueAfterKey(html, '"xdt_api__v1__users__web_profile_info":') ||
      extractJsonValueAfterKey(html, '"web_profile_info":');
    profileData = candidate?.data?.user || candidate?.user || null;
  }

  const dpUrl = getProfilePictureUrl(profileData);
  if (!dpUrl) return [];

  return [
    createAsset({
      url: dpUrl,
      folder: 'dp',
      baseName: `${username}_dp`,
      extensionFallback: '.jpg',
      category: 'dp',
      sourceCode: 'dp',
    }),
  ];
}

function dedupeAssets(assets) {
  const unique = new Map();
  for (const asset of assets) {
    const key = `${asset.folder}|${asset.url}`;
    if (!unique.has(key)) unique.set(key, asset);
  }
  return Array.from(unique.values());
}

function printSelectedMediaReport(items, assets) {
  renderMenuBox(
    'Selected Media',
    'Direct links scanned without bulk profile loading',
    [
      `Input Links      : ${items.length}`,
      `Download Files   : ${assets.length}`,
    ],
    ANSI.cyan
  );
}

async function scanSelectedMedia(session, links) {
  const items = links.map(classifySelectedMediaLink);
  const assets = [];
  const progress = createSmoothProgress('Scan progress', 100);

  try {
    progress.pulseUntil(2, `Scanning ${items.length} selected link(s)`);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const label = `${item.type}: ${item.code || item.id || item.username}`;
      progress.pulseUntil(((i + 0.5) / items.length) * 100, label);

      if (item.type === 'post') {
        const node = await hydratePostNode(session.detailPage, item.url);
        if (node) {
          assets.push(...buildPostAssets(node, DIRECT_POST_OPTIONS));
        }
      } else if (item.type === 'highlight') {
        const title = `highlight_${sanitizeSegment(item.id, 'selected')}`;
        assets.push(
          ...(await extractHighlights(session.detailPage, 'selected_media', [
            { href: item.url, title },
          ], () => {}))
        );
      } else if (item.type === 'story') {
        assets.push(...(await extractStories(session.detailPage, item.username)));
      } else if (item.type === 'profile-dp') {
        assets.push(...(await fetchProfileDpAsset(session.detailPage, item.username)));
      }

      progress.set(((i + 1) / items.length) * 100, label);
    }

    progress.complete('Selected media scan complete');
  } catch (error) {
    progress.stop();
    throw error;
  }

  const uniqueAssets = dedupeAssets(assets);
  printSelectedMediaReport(items, uniqueAssets);
  return uniqueAssets;
}

module.exports = {
  scanSelectedMedia,
};
