const puppeteer = require('puppeteer');
const {
  PAGE_SIZE,
  BROWSER_LAUNCH_OPTIONS,
  DEFAULT_USER_AGENT,
  DEFAULT_ACCEPT_LANGUAGE,
  NAVIGATION_WAIT_UNTIL,
  NAVIGATION_TIMEOUT_MS,
  INSTAGRAM_WEB_APP_ID,
  INSTAGRAM_HOST_PATTERN,
  RESERVED_ROOT_SEGMENTS,
  PROFILE_SECTION_SEGMENTS,
  PROFILE_META_SELECTORS,
  OWNER_USERNAME_REGEX_PATTERNS,
  USERNAME_FROM_TEXT_PATTERNS,
} = require('./constants');
const {
  normalizeInstagramUsername,
  buildProfileTarget,
  resolveProfileTargetFromPath,
  resolveInstagramInput,
  finishProgressLine,
  createSmoothProgress,
  loadCookies,
} = require('./cli');
const {
  extractJsonValueAfterKey,
  findNestedValue,
  extractStories,
  extractHighlights,
} = require('./instagram-media');

function getProfilePictureUrl(profileData) {
  return (
    profileData?.hd_profile_pic_url_info?.url ||
    profileData?.profile_pic_url_hd ||
    profileData?.profile_pic_url ||
    null
  );
}

function normalizeProfileCount(...values) {
  for (const value of values) {
    const count = Number(value);
    if (Number.isFinite(count) && count >= 0) {
      return count;
    }
  }

  return 0;
}

function getFollowerCount(profileData) {
  return normalizeProfileCount(
    profileData?.follower_count,
    profileData?.followers_count,
    profileData?.edge_followed_by?.count
  );
}

function getFollowingCount(profileData) {
  return normalizeProfileCount(
    profileData?.following_count,
    profileData?.follow_count,
    profileData?.edge_follow?.count
  );
}

async function runWithProgressDetails(task, onProgress, details, intervalMs = 2500) {
  let index = 0;
  let timer = null;
  const startedAt = Date.now();

  if (typeof onProgress === 'function' && details.length > 0) {
    onProgress(details[0]);
    timer = setInterval(() => {
      if (index < details.length - 1) {
        index += 1;
        onProgress(details[index]);
        return;
      }

      const elapsedSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      onProgress(`${details[index]} (${elapsedSeconds}s)`);
    }, intervalMs);
  }

  try {
    return await task();
  } finally {
    if (timer) {
      clearInterval(timer);
    }
  }
}

function extractOwnerUsernameFromStructuredPayload(payload) {
  const directCandidates = [
    payload?.owner?.username,
    payload?.items?.[0]?.user?.username,
    payload?.items?.[0]?.owner?.username,
  ];

  for (const candidate of directCandidates) {
    const username = normalizeInstagramUsername(candidate);
    if (username) return username;
  }

  const shortcodePayload = findNestedValue(payload, 'xdt_api__v1__media__shortcode__web_info');
  const shortcodeCandidates = [
    shortcodePayload?.items?.[0]?.user?.username,
    shortcodePayload?.items?.[0]?.owner?.username,
  ];

  for (const candidate of shortcodeCandidates) {
    const username = normalizeInstagramUsername(candidate);
    if (username) return username;
  }

  const reelsPayload =
    findNestedValue(payload, 'xdt_api__v1__feed__reels_media') ||
    findNestedValue(payload, 'xdt_api__v1__feed__reels_media__connection');
  const reelsMediaGroups = [
    ...(Array.isArray(reelsPayload?.reels_media) ? reelsPayload.reels_media : []),
    ...(Array.isArray(reelsPayload) ? reelsPayload : []),
  ];

  for (const group of reelsMediaGroups) {
    const username = normalizeInstagramUsername(group?.owner?.username || group?.user?.username);
    if (username) return username;
  }

  const serializedPayload = JSON.stringify(payload);
  const ownerUsernameMatch =
    serializedPayload.match(/"owner"\s*:\s*\{[^{}]*"username"\s*:\s*"([A-Za-z0-9._]{1,30})"/) ||
    serializedPayload.match(/"user"\s*:\s*\{[^{}]*"username"\s*:\s*"([A-Za-z0-9._]{1,30})"/) ||
    serializedPayload.match(/"reel_owner"\s*:\s*\{[^{}]*"username"\s*:\s*"([A-Za-z0-9._]{1,30})"/);

  return normalizeInstagramUsername(ownerUsernameMatch?.[1]);
}

function extractOwnerUsernameFromHtml(html) {
  const payloadCandidates = [
    extractJsonValueAfterKey(html, '"xdt_api__v1__media__shortcode__web_info":'),
    extractJsonValueAfterKey(html, '"xdt_api__v1__feed__reels_media":'),
    extractJsonValueAfterKey(html, '"xdt_api__v1__feed__reels_media__connection":'),
    extractJsonValueAfterKey(html, '"reels_media":'),
  ];

  for (const payload of payloadCandidates) {
    const username = extractOwnerUsernameFromStructuredPayload(payload);
    if (username) return username;
  }

  for (const pattern of OWNER_USERNAME_REGEX_PATTERNS) {
    const username = normalizeInstagramUsername(html.match(pattern)?.[1]);
    if (username) return username;
  }

  return null;
}

function extractUsernameFromMetadataText(value) {
  const text = String(value || '').trim();
  if (!text) return null;

  for (const pattern of USERNAME_FROM_TEXT_PATTERNS) {
    const username = normalizeInstagramUsername(text.match(pattern)?.[1]);
    if (username) return username;
  }

  return null;
}

function extractUsernameFromInstagramHref(href) {
  if (!href || typeof href !== 'string') return null;

  try {
    const url = href.startsWith('http') ? new URL(href) : new URL(href, 'https://www.instagram.com');
    if (!INSTAGRAM_HOST_PATTERN.test(url.hostname)) return null;

    const parts = url.pathname
      .split('/')
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment));
    const root = normalizeInstagramUsername(parts[0]);

    if (!root || RESERVED_ROOT_SEGMENTS.has(root)) return null;
    if (parts.length === 1 || PROFILE_SECTION_SEGMENTS.has(parts[1])) return root;
  } catch {
    return null;
  }

  return null;
}

async function extractOwnerUsernameFromDocument(page) {
  const values = await page.evaluate((metaSelectors) => {
    const out = [];
    metaSelectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((node) => {
        const content = node.getAttribute('content');
        if (content) out.push(content);
      });
    });

    document.querySelectorAll('a[href]').forEach((anchor) => {
      const href = anchor.getAttribute('href');
      if (href) out.push(href);
    });

    return out;
  }, PROFILE_META_SELECTORS);

  for (const value of values) {
    const fromMeta = extractUsernameFromMetadataText(value);
    if (fromMeta) return fromMeta;

    const fromHref = extractUsernameFromInstagramHref(value);
    if (fromHref) return fromHref;
  }

  return null;
}

async function resolveProfileTargetFromResourceUrl(page, sourceUrl) {
  await page.goto(sourceUrl, { waitUntil: NAVIGATION_WAIT_UNTIL, timeout: NAVIGATION_TIMEOUT_MS });

  const html = await page.content();
  const extractedOwner = extractOwnerUsernameFromHtml(html) || (await extractOwnerUsernameFromDocument(page));
  const username = normalizeInstagramUsername(extractedOwner);

  if (!username) {
    throw new Error('Could not resolve owner username from this Instagram resource URL.');
  }

  return {
    ...buildProfileTarget(username),
    resolutionKind: 'resource-owner-lookup',
    sourceUrl,
    needsLookup: false,
  };
}

async function resolveProfileTarget(session, input) {
  const resolvedInput = resolveInstagramInput(input);

  if (!resolvedInput.needsLookup) {
    return resolvedInput;
  }

  return resolveProfileTargetFromResourceUrl(session.page, resolvedInput.sourceUrl);
}

async function createBrowserSession() {
  const browser = await puppeteer.launch(BROWSER_LAUNCH_OPTIONS);
  const page = await browser.newPage();
  const detailPage = await browser.newPage();
  const userAgent = DEFAULT_USER_AGENT;

  await page.setUserAgent(userAgent);
  await detailPage.setUserAgent(userAgent);
  await page.setExtraHTTPHeaders({ 'accept-language': DEFAULT_ACCEPT_LANGUAGE });
  await detailPage.setExtraHTTPHeaders({ 'accept-language': DEFAULT_ACCEPT_LANGUAGE });

  const cookies = loadCookies();
  if (cookies.length > 0) {
    await page.setCookie(...cookies);
    await detailPage.setCookie(...cookies);
  }

  return { browser, page, detailPage, userAgent };
}

async function closeBrowserSession(session) {
  if (session?.browser) {
    await session.browser.close();
  }
}

async function captureProfileBootstrap(page, profileUrl, onProgress = null) {
  await runWithProgressDetails(
    () => page.goto(profileUrl, { waitUntil: NAVIGATION_WAIT_UNTIL, timeout: NAVIGATION_TIMEOUT_MS }),
    onProgress,
    [
      'Opening profile page',
      'Waiting for Instagram initial HTML',
      'Waiting for profile network requests',
      'Still loading profile page',
    ]
  );

  if (typeof onProgress === 'function') {
    onProgress('Reading loaded profile URL');
  }
  const pageUsername = normalizeInstagramUsername(
    new URL(page.url()).pathname.split('/').filter(Boolean)[0]
  );

  if (pageUsername) {
    try {
      const apiPayload = await runWithProgressDetails(
        () =>
          page.evaluate(
            async (username, appId) => {
              const response = await fetch(
                `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
                {
                  credentials: 'include',
                  headers: {
                    'x-ig-app-id': appId,
                    'x-requested-with': 'XMLHttpRequest',
                  },
                }
              );

              if (!response.ok) {
                return null;
              }

              return await response.json();
            },
            pageUsername,
            INSTAGRAM_WEB_APP_ID
          ),
        onProgress,
        [
          `Requesting profile API @${pageUsername}`,
          'Waiting for profile API response',
          'Parsing profile API payload',
        ],
        1800
      );

      const apiUser = apiPayload?.data?.user;
      if (apiUser?.username) {
        if (typeof onProgress === 'function') {
          onProgress('Profile API data found');
        }
        return {
          profileData: apiUser,
          timelineBootstrap: apiUser?.edge_owner_to_timeline_media || null,
        };
      }
      if (typeof onProgress === 'function') {
        onProgress('Profile API empty, trying HTML data');
      }
    } catch (error) {
      if (typeof onProgress === 'function') {
        onProgress(`Profile API failed: ${error.message}`);
      }
    }
  }

  const html = await runWithProgressDetails(
    () => page.content(),
    onProgress,
    [
      'Reading profile HTML fallback',
      'Extracting embedded profile JSON',
    ],
    1800
  );
  const profileCandidates = [
    extractJsonValueAfterKey(html, '"xdt_api__v1__users__web_profile_info":'),
    extractJsonValueAfterKey(html, '"web_profile_info":'),
  ];

  for (const candidate of profileCandidates) {
    const user = candidate?.data?.user || candidate?.user;
    if (user?.username) {
      if (typeof onProgress === 'function') {
        onProgress('Embedded profile data found');
      }
      return {
        profileData: user,
        timelineBootstrap:
          user?.edge_owner_to_timeline_media ||
          findNestedValue(candidate, 'edge_owner_to_timeline_media') ||
          null,
      };
    }
  }

  throw new Error('Could not locate profile bootstrap data.');
}

async function captureProfileBootstrapWithRetry(page, profileUrl, maxAttempts = 3, onProgress = null) {
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (typeof onProgress === 'function') {
        onProgress(`Loading profile (attempt ${attempt}/${maxAttempts})`);
      }
      const bootstrap = await captureProfileBootstrap(
        page,
        profileUrl,
        (detail) => {
          if (typeof onProgress === 'function') {
            onProgress(`Attempt ${attempt}/${maxAttempts}: ${detail}`);
          }
        }
      );
      return bootstrap;
    } catch (error) {
      lastError = error;
      if (typeof onProgress === 'function') {
        onProgress(`Attempt ${attempt}/${maxAttempts} failed: ${error.message}`);
      }
    }
  }

  throw lastError || new Error('Failed to load profile bootstrap data.');
}

async function getHighlightEntries(page) {
  return page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a[href*="/stories/highlights/"]'));
    const unique = new Map();

    anchors.forEach((anchor) => {
      const href = anchor.getAttribute('href');
      if (!href) return;
      if (!unique.has(href)) {
        const titleNode = anchor.querySelector('img[alt], span');
        const title = titleNode?.getAttribute?.('alt') || titleNode?.textContent?.trim() || null;
        unique.set(href, { href, title });
      }
    });

    return Array.from(unique.values());
  });
}

async function fetchTimelinePage(page, userId, maxId = null, onProgress = null) {
  try {
    if (typeof onProgress === 'function') {
      onProgress(maxId ? 'Requesting next timeline page' : 'Requesting first timeline page');
    }
    const payload = await page.evaluate(
      async ({ id, count, cursor, appId }) => {
        const endpoint = `https://www.instagram.com/api/v1/feed/user/${encodeURIComponent(id)}/`;
        const params = new URLSearchParams({ count: String(count) });
        if (cursor) {
          params.set('max_id', cursor);
        }

        const response = await fetch(`${endpoint}?${params.toString()}`, {
          credentials: 'include',
          headers: {
            'x-ig-app-id': appId,
            'x-requested-with': 'XMLHttpRequest',
          },
        });

        if (!response.ok) {
          return null;
        }

        return await response.json();
      },
      {
        id: userId,
        count: PAGE_SIZE,
        cursor: maxId,
        appId: INSTAGRAM_WEB_APP_ID,
      }
    );

    const items = Array.isArray(payload?.items) ? payload.items : [];
    if (typeof onProgress === 'function') {
      onProgress(`Timeline page returned ${items.length} item(s)`);
    }
    return {
      edges: items.map((item) => ({ node: item })),
      page_info: {
        has_next_page: Boolean(payload?.more_available),
        end_cursor: payload?.next_max_id || null,
      },
    };
  } catch (error) {
    if (typeof onProgress === 'function') {
      onProgress(`Timeline request failed: ${error.message}`);
    }
    return null;
  }
}

async function collectAllTimelinePosts(page, username, userId, expectedCount, bootstrap, onProgress = null, onLog = null) {
  const edges = Array.isArray(bootstrap?.edges) ? [...bootstrap.edges] : [];
  let pageInfo = bootstrap?.page_info || { has_next_page: false, end_cursor: null };

  if (typeof onLog === 'function') {
    onLog(`Timeline bootstrap has ${edges.length} item(s)`);
  }

  const reportProgress = () => {
    if (typeof onProgress === 'function') {
      const total = expectedCount || edges.length || 1;
      onProgress(edges.length, total, username);
    }
  };

  reportProgress();

  if (edges.length === 0) {
    const firstTimeline = await fetchTimelinePage(page, userId, null, onLog);

    if (firstTimeline?.edges?.length) {
      edges.push(...firstTimeline.edges);
      pageInfo = firstTimeline.page_info || { has_next_page: false, end_cursor: null };
      reportProgress();
    }
  }

  while (pageInfo?.has_next_page && pageInfo?.end_cursor) {
    const timeline = await fetchTimelinePage(page, userId, pageInfo.end_cursor, onLog);

    if (!timeline?.edges?.length) {
      if (typeof onLog === 'function') {
        onLog('Timeline pagination stopped: no more items returned');
      }
      break;
    }

    edges.push(...timeline.edges);
    pageInfo = timeline.page_info || { has_next_page: false, end_cursor: null };
    reportProgress();

    if (expectedCount && edges.length >= expectedCount) {
      if (typeof onLog === 'function') {
        onLog('Timeline pagination reached profile post count');
      }
      break;
    }
  }

  const unique = new Map();
  edges.forEach((edge) => {
    const node = edge?.node;
    const id = node?.id || node?.pk;
    if (id && !unique.has(id)) unique.set(id, node);
  });

  const posts = Array.from(unique.values());
  if (typeof onLog === 'function') {
    onLog(`Timeline dedupe complete: ${posts.length} unique post(s)`);
  }
  return posts;
}

function summarizeTimelinePosts(posts) {
  const summary = {
    reels: 0,
    videos: 0,
    photoPosts: 0,
    carouselPosts: 0,
    totalScannedPosts: posts.length,
  };

  for (const node of posts) {
    if (node.product_type === 'clips') summary.reels += 1;
    else if (node.media_type === 2) summary.videos += 1;
    else if (node.media_type === 8) summary.carouselPosts += 1;
    else if (node.media_type === 1) summary.photoPosts += 1;
  }

  return summary;
}

async function scanProfile(session, profileUrl) {
  const progress = createSmoothProgress('Scan progress', 100);

  try {
    progress.pulseUntil(12, 'Resolving input URL');
    progress.pulseUntil(12, 'Resolving Instagram input');
    const resolvedTarget = await resolveProfileTarget(session, profileUrl);
    progress.set(12, `Resolved @${resolvedTarget.username}`);

    progress.pulseUntil(35, `Loading profile @${resolvedTarget.username}`);
    const reportProfileLoad = (detail) => {
      progress.pulseUntil(35, detail);
    };
    const { profileData, timelineBootstrap } = await captureProfileBootstrapWithRetry(
      session.page,
      resolvedTarget.profileUrl,
      3,
      reportProfileLoad
    );
    if (!profileData?.username) {
      throw new Error('Could not load profile data. Check cookies or profile visibility.');
    }
    progress.set(35, `Loaded profile @${profileData.username}`);

    const totalPosts = profileData.media_count || profileData.edge_owner_to_timeline_media?.count || 0;
    progress.pulseUntil(40, `Profile count detected: ${totalPosts} post(s)`);
    progress.pulseUntil(42, 'Reading highlight entries from profile page');
    const highlightEntries = await getHighlightEntries(session.page);
    progress.set(42, `Found ${highlightEntries.length} highlight entr${highlightEntries.length === 1 ? 'y' : 'ies'}`);
    progress.pulseUntil(68, `Scanning posts for @${profileData.username}`);
    const timelinePosts = await collectAllTimelinePosts(
      session.page,
      profileData.username,
      profileData.id,
      totalPosts,
      timelineBootstrap,
      (current, total, username) => {
        const postRatio = total > 0 ? Math.min(current / total, 1) : 0;
        progress.set(35 + postRatio * 33, `Scanning posts ${current}/${total} @${username}`);
        progress.pulseUntil(68, `Scanning posts ${current}/${total} @${username}`);
      },
      (detail) => {
        progress.pulseUntil(68, detail);
      }
    );
    progress.set(68, `Scanned ${timelinePosts.length} post(s)`);

    progress.pulseUntil(82, `Collecting stories for @${profileData.username}`);
    const storyAssets = await extractStories(session.detailPage, profileData.username);
    progress.set(82, `Collected ${storyAssets.length} story item(s)`);

    progress.pulseUntil(
      96,
      highlightEntries.length > 0
        ? `Collecting ${highlightEntries.length} highlight(s)`
        : 'Skipping highlights: none found'
    );
    const highlightAssets = await extractHighlights(
      session.detailPage,
      profileData.username,
      highlightEntries,
      (current, total, title) => {
        const highlightRatio = total > 0 ? Math.min(current / total, 1) : 0;
        progress.set(82 + highlightRatio * 14, `Highlight ${current}/${total}: ${title}`);
        progress.pulseUntil(96, `Highlight ${current}/${total}: ${title}`);
      }
    );
    progress.set(96, `Highlight collection complete: ${highlightAssets.length} item(s)`);
    progress.complete('Scan complete');
    console.log(`Collected ${storyAssets.length} story item(s) and ${highlightAssets.length} highlight item(s).`);

    return {
      session,
      profile: {
        username: profileData.username,
        isPrivate: Boolean(profileData.is_private),
        totalPosts,
        followers: getFollowerCount(profileData),
        following: getFollowingCount(profileData),
        links: (profileData.bio_links || []).map((link) => link.url).filter(Boolean),
        dpUrl: getProfilePictureUrl(profileData),
      },
      highlightCount: highlightEntries.length,
      highlightEntries,
      highlightAssets,
      timelinePosts,
      storyAssets,
      summary: summarizeTimelinePosts(timelinePosts),
      input: {
        original: profileUrl,
        resolvedFrom: resolvedTarget.sourceUrl || profileUrl,
        resolutionKind: resolvedTarget.resolutionKind,
      },
    };
  } catch (error) {
    progress.stop();
    finishProgressLine();
    throw error;
  }
}

module.exports = {
  createBrowserSession,
  closeBrowserSession,
  scanProfile,
};
