const fs = require('fs');
const readline = require('readline');

const {
  COOKIE_FILE,
  ANSI,
  DOWNLOAD_OPTIONS,
  INSTAGRAM_HOST_PATTERN,
  INSTAGRAM_USERNAME_PATTERN,
  PROFILE_SECTION_SEGMENTS,
  RESOURCE_PATH_SEGMENTS,
  STAR_SPINNER_FRAMES,
} = require('./constants');

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) =>
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    })
  );
}

function normalizeProfileUrl(input) {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Instagram username or URL is required.');
  }

  const directUsername = normalizeInstagramUsername(trimmed);
  if (directUsername && !trimmed.includes('/') && !trimmed.includes('instagram.com')) {
    return buildProfileTarget(directUsername);
  }

  const url = parseInstagramUrl(trimmed);
  if (!INSTAGRAM_HOST_PATTERN.test(url.hostname)) {
    throw new Error('Please enter a valid Instagram username or URL.');
  }

  const directResolution = resolveProfileTargetFromPath(url.pathname);
  if (!directResolution) {
    throw new Error('This Instagram link type needs owner resolution before scanning.');
  }

  return directResolution;
}

function normalizeInstagramUsername(value) {
  const normalized = String(value || '')
    .trim()
    .replace(/^@+/, '')
    .replace(/^\/+|\/+$/g, '');

  if (!normalized || !INSTAGRAM_USERNAME_PATTERN.test(normalized)) {
    return null;
  }

  return normalized;
}

function buildProfileTarget(username) {
  return {
    username,
    profileUrl: `https://www.instagram.com/${username}/`,
  };
}

function parseInstagramUrl(input) {
  const trimmed = input.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    return new URL(withProtocol);
  } catch {
    throw new Error('Please enter a valid Instagram username or URL.');
  }
}

function toCanonicalInstagramUrl(url) {
  return `https://www.instagram.com${url.pathname.replace(/\/?$/, '/')}`;
}

function resolveProfileTargetFromPath(pathname) {
  const parts = pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment));

  if (parts.length === 0) {
    return null;
  }

  if (parts[0] === 'stories' && parts[1] && parts[1] !== 'highlights') {
    const username = normalizeInstagramUsername(parts[1]);
    return username ? buildProfileTarget(username) : null;
  }

  const rootUsername = normalizeInstagramUsername(parts[0]);
  if (!rootUsername) {
    return null;
  }

  if (parts.length === 1 || PROFILE_SECTION_SEGMENTS.has(parts[1])) {
    return buildProfileTarget(rootUsername);
  }

  return null;
}

function resolveInstagramInput(input) {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Instagram username or URL is required.');
  }

  const directUsername = normalizeInstagramUsername(trimmed);
  if (directUsername && !trimmed.includes('/') && !trimmed.includes('instagram.com')) {
    return {
      ...buildProfileTarget(directUsername),
      resolutionKind: 'username',
      sourceUrl: null,
      needsLookup: false,
    };
  }

  const url = parseInstagramUrl(trimmed);
  if (!INSTAGRAM_HOST_PATTERN.test(url.hostname)) {
    throw new Error('Please enter a valid Instagram username or URL.');
  }

  const directResolution = resolveProfileTargetFromPath(url.pathname);
  if (directResolution) {
    return {
      ...directResolution,
      resolutionKind: 'direct-path',
      sourceUrl: toCanonicalInstagramUrl(url),
      needsLookup: false,
    };
  }

  const parts = url.pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment));

  if (
    (RESOURCE_PATH_SEGMENTS.has(parts[0]) && parts[1]) ||
    (parts[0] === 'stories' && parts[1] === 'highlights' && parts[2])
  ) {
    return {
      username: null,
      profileUrl: null,
      resolutionKind: 'resource-owner-lookup',
      sourceUrl: toCanonicalInstagramUrl(url),
      needsLookup: true,
    };
  }

  throw new Error('Unsupported Instagram input. Use a username, profile URL, story URL, highlight URL, post URL, or reel URL.');
}

function sanitizeName(value) {
  return value.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
}

function sanitizeSegment(value, fallback = 'item') {
  const sanitized = sanitizeName(String(value || fallback))
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return sanitized || fallback;
}

function formatCount(value) {
  if (value == null) return '0';
  if (value >= 1000000) return `${(value / 1000000).toFixed(value >= 10000000 ? 0 : 1).replace(/\.0$/, '')}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 100000 ? 0 : 1).replace(/\.0$/, '')}K`;
  return String(value);
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const digits = size >= 100 || unitIndex === 0 ? 0 : size >= 10 ? 1 : 2;
  return `${size.toFixed(digits).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1')} ${units[unitIndex]}`;
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(value);
}

function truncateMiddle(value, maxLength = 42) {
  if (!value || value.length <= maxLength) return value || '';
  const left = Math.ceil((maxLength - 3) / 2);
  const right = Math.floor((maxLength - 3) / 2);
  return `${value.slice(0, left)}...${value.slice(value.length - right)}`;
}

function colorize(value, color) {
  return `${color}${value}${ANSI.reset}`;
}

function padRight(value, width) {
  return `${value}${' '.repeat(Math.max(width - value.length, 0))}`;
}

function renderMenuBox(title, subtitle, rows, accent = ANSI.cyan) {
  const contentWidth = Math.max(
    title.length,
    subtitle ? subtitle.length : 0,
    ...rows.map((row) => row.length),
    24
  );
  const top = `+${'-'.repeat(contentWidth + 2)}+`;

  console.log('');
  console.log(colorize(top, accent));
  console.log(`${colorize('|', accent)} ${colorize(padRight(title, contentWidth), ANSI.bold)} ${colorize('|', accent)}`);

  if (subtitle) {
    console.log(`${colorize('|', accent)} ${colorize(padRight(subtitle, contentWidth), ANSI.dim)} ${colorize('|', accent)}`);
  }

  console.log(colorize(top, accent));
  rows.forEach((row) => {
    console.log(`${colorize('|', accent)} ${padRight(row, contentWidth)} ${colorize('|', accent)}`);
  });
  console.log(colorize(top, accent));
}

function formatItemCountLabel(count) {
  if (!count) return '';
  return `(${count} item${count === 1 ? '' : 's'})`;
}

function countEstimatedThumbnailAssets(posts) {
  return posts.reduce((total, node) => {
    const mediaItems = node.media_type === 8 ? node.carousel_media || [] : [node];
    return total + mediaItems.filter((item) => item.media_type === 2).length;
  }, 0);
}

function countEstimatedCarouselAssets(posts) {
  return posts.reduce((total, node) => {
    if (node.media_type !== 8) return total;
    return total + (node.carousel_media || []).length;
  }, 0);
}

function countEstimatedWholeProfileAssets(scan) {
  return (
    scan.summary.videos +
    scan.summary.reels +
    scan.summary.photoPosts +
    countEstimatedCarouselAssets(scan.timelinePosts) +
    countEstimatedThumbnailAssets(scan.timelinePosts) +
    (scan.profile.dpUrl ? 1 : 0) +
    scan.storyAssets.length +
    Math.max(scan.highlightAssets.length, scan.highlightCount)
  );
}

function buildDownloadMenuRows(scan) {
  return [
    `Total Scanned     : ${scan.summary.totalScannedPosts}`,
    '',
    `1.  ${padRight('Videos', 18)} ${formatItemCountLabel(scan.summary.videos)}`.trimEnd(),
    `2.  ${padRight('Reels', 18)} ${formatItemCountLabel(scan.summary.reels)}`.trimEnd(),
    `3.  ${padRight('Photos', 18)} ${formatItemCountLabel(scan.summary.photoPosts)}`.trimEnd(),
    `4.  ${padRight('Carousel Posts', 18)} ${formatItemCountLabel(countEstimatedCarouselAssets(scan.timelinePosts))}`.trimEnd(),
    `5.  ${padRight('Thumbnails', 18)} ${formatItemCountLabel(countEstimatedThumbnailAssets(scan.timelinePosts))}`.trimEnd(),
    `6.  ${padRight('DP', 18)} ${formatItemCountLabel(scan.profile.dpUrl ? 1 : 0)}`.trimEnd(),
    `7.  ${padRight('Stories', 18)} ${formatItemCountLabel(scan.storyAssets.length)}`.trimEnd(),
    `8.  ${padRight('Highlights', 18)} ${formatItemCountLabel(scan.highlightAssets.length)}`.trimEnd(),
    `9.  ${padRight('Whole Profile', 18)} ${formatItemCountLabel(countEstimatedWholeProfileAssets(scan))}`.trimEnd(),
    '10. Download Selected Media',
    '11. Select another Instagram profile',
    '12. Exit',
  ];
}


function getProgressColors(label) {
  if (label === 'Starting session' || label === 'Resolving input') {
    return { spinner: ANSI.cyan, bar: ANSI.cyan, label: ANSI.cyan };
  }

  if (label === 'Scan progress') {
    return { spinner: ANSI.cyan, bar: ANSI.cyan, label: ANSI.cyan };
  }

  if (label === 'Loading profile') {
    return { spinner: ANSI.cyan, bar: ANSI.cyan, label: ANSI.cyan };
  }

  if (label === 'Scanning posts') {
    return { spinner: ANSI.cyan, bar: ANSI.cyan, label: ANSI.cyan };
  }

  if (label === 'Collecting extras' || label === 'Collecting highlights') {
    return { spinner: ANSI.magenta, bar: ANSI.magenta, label: ANSI.magenta };
  }

  if (label === 'Preparing media') {
    return { spinner: ANSI.yellow, bar: ANSI.yellow, label: ANSI.yellow };
  }

  if (label === 'Packaging ZIP') {
    return { spinner: ANSI.blue, bar: ANSI.blue, label: ANSI.blue };
  }

  if (label === 'Downloading') {
    return { spinner: ANSI.green, bar: ANSI.green, label: ANSI.green };
  }

  return { spinner: ANSI.bold, bar: ANSI.bold, label: ANSI.bold };
}

function formatProgressNumber(value) {
  if (!Number.isFinite(value)) return '0';
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1).replace(/\.0$/, '');
}

function renderProgressLine(label, current, total, tick = 0, detail = '') {
  const spinner = STAR_SPINNER_FRAMES[tick % STAR_SPINNER_FRAMES.length];
  const width = 24;
  const ratio = total > 0 ? Math.min(current / total, 1) : 0;
  const filled = Math.round(ratio * width);
  const bar = `${'\u2588'.repeat(filled)}${'\u2591'.repeat(width - filled)}`;
  const totalLabel = total > 0 ? total : '?';
  const percentLabel = total > 0 ? `${Math.round(ratio * 100)}%` : '--%';
  const detailLabel = detail ? ` | ${truncateMiddle(detail)}` : '';
  const colors = getProgressColors(label);
  process.stdout.write(
    `\r\x1b[2K${colorize(spinner, colors.spinner)} ${colorize(label, colors.label)} [${colorize(bar, colors.bar)}] ${formatProgressNumber(current)}/${totalLabel} ${percentLabel}${colorize(detailLabel, ANSI.dim)}`
  );
}

function finishProgressLine() {
  process.stdout.write('\n');
}

function clearProgressLine() {
  process.stdout.write('\r\x1b[2K');
}

function renderActivityLine(label, tick = 0, detail = '') {
  const spinner = STAR_SPINNER_FRAMES[tick % STAR_SPINNER_FRAMES.length];
  const detailLabel = detail ? ` | ${truncateMiddle(detail, 80)}` : '';
  process.stdout.write(
    `\r\x1b[2K${colorize(spinner, ANSI.cyan)} ${colorize(label, ANSI.cyan)}${colorize(detailLabel, ANSI.dim)}`
  );
}

function createSmoothProgress(label, total = 100, options = {}) {
  const intervalMs = options.intervalMs || 120;
  const idleStep = options.idleStep || 0.22;
  const catchupRatio = options.catchupRatio || 0.28;
  let displayed = 0;
  let target = 0;
  let cap = 0;
  let detail = '';
  let tick = 0;
  let timer = null;

  const render = () => {
    renderProgressLine(label, Math.min(displayed, total), total, tick, detail);
    tick += 1;
  };

  const stopTimer = () => {
    if (!timer) return;
    clearInterval(timer);
    timer = null;
  };

  const startTimer = () => {
    if (timer) return;
    timer = setInterval(() => {
      const activeTarget = Math.max(target, Math.min(cap, displayed + idleStep));
      const delta = activeTarget - displayed;

      if (Math.abs(delta) < 0.05) {
        displayed = activeTarget;
      } else {
        displayed += delta * catchupRatio;
      }

      render();
    }, intervalMs);
  };

  const set = (value, nextDetail = detail) => {
    target = Math.max(0, Math.min(value, total));
    cap = Math.max(cap, target);
    detail = nextDetail;
    displayed = Math.max(displayed, target);
    render();
  };

  const pulseUntil = (nextCap, nextDetail = detail) => {
    cap = Math.max(cap, Math.min(nextCap, total));
    detail = nextDetail;
    startTimer();
    render();
  };

  const complete = (nextDetail = 'Complete') => {
    stopTimer();
    target = total;
    cap = total;
    detail = nextDetail;
    displayed = total;
    render();
    finishProgressLine();
  };

  return {
    set,
    pulseUntil,
    complete,
    stop: stopTimer,
  };
}

function ensureDirectoryExists(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }
}

function loadCookies(cookieFile = COOKIE_FILE) {
  try {
    if (!fs.existsSync(cookieFile)) {
      console.log(`Warning: ${cookieFile} not found. Running without cookies.`);
      return [];
    }

    const cookies = JSON.parse(fs.readFileSync(cookieFile, 'utf8'));
    const normalizedCookies = cookies.map((cookie) => {
      const normalized = {
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path || '/',
        expires: cookie.expirationDate || -1,
        httpOnly: Boolean(cookie.httpOnly),
        secure: Boolean(cookie.secure),
      };

      if (cookie.sameSite) {
        const sameSite = cookie.sameSite.toLowerCase();
        if (sameSite === 'no_restriction') normalized.sameSite = 'None';
        else if (sameSite === 'strict') normalized.sameSite = 'Strict';
        else normalized.sameSite = 'Lax';
      }

      return normalized;
    });

    console.log(`Loaded ${normalizedCookies.length} cookies from ${cookieFile}`);
    return normalizedCookies;
  } catch (error) {
    console.log(`Warning: Could not load cookies: ${error.message}`);
    return [];
  }
}

async function askDownloadSelection(scan) {
  while (true) {
    renderMenuBox(
      'Menu',
      'Choose one or more media types',
      buildDownloadMenuRows(scan),
      ANSI.magenta
    );

    const raw = await askQuestion(colorize('Selection > ', ANSI.bold));
    const values = raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    const unique = [...new Set(values)];
    const allValid = unique.length > 0 && unique.every((value) => DOWNLOAD_OPTIONS[value]);

    if (!allValid) {
      console.log(colorize('Invalid selection. Example: 2 or 1,3,5', ANSI.yellow));
      continue;
    }

    const selectedKeys = new Set(unique.map((value) => DOWNLOAD_OPTIONS[value].key));
    if (selectedKeys.has('exit')) {
      return { action: 'exit', selectedOptions: null };
    }
    if (selectedKeys.has('downloadSelectedMedia')) {
      return { action: 'downloadSelectedMedia', selectedOptions: null };
    }
    if (selectedKeys.has('selectAnotherProfile')) {
      return { action: 'selectAnotherProfile', selectedOptions: null };
    }

    if (selectedKeys.has('wholeProfile')) {
      return {
        action: 'download',
        selectedOptions: new Set(['videos', 'reels', 'photos', 'carousels', 'thumbnails', 'dp', 'stories', 'highlights']),
      };
    }

    return {
      action: 'download',
      selectedOptions: selectedKeys,
    };
  }
}

async function askDownloadMode() {
  while (true) {
    renderMenuBox(
      'Download Mode',
      'Choose how you want to download',
      [
        '1. Download Selected Media',
        '2. Download Bulk Media',
      ],
      ANSI.magenta
    );

    const choice = await askQuestion(colorize('Mode > ', ANSI.bold));
    if (choice === '1') return 'downloadSelectedMedia';
    if (choice === '2') return 'downloadBulkMedia';
    console.log(colorize('Invalid selection. Choose 1 or 2.', ANSI.yellow));
  }
}

async function askSelectedMediaLinks() {
  while (true) {
    const raw = await askQuestion(colorize('Enter Instagram media link(s): ', ANSI.bold));
    const instagramLinks = raw.match(/(?:https?:\/\/)?(?:www\.)?instagram\.com\/[^\s,]+/gi) || [];
    const sourceItems = instagramLinks.length > 0 ? instagramLinks : raw.split(/[\s,]+/);
    const links = sourceItems
      .map((item) => item.trim())
      .map((item) => item.replace(/[),.;]+$/g, ''))
      .filter(Boolean);

    if (links.length > 0) return links;
    console.log(colorize('Please enter at least one Instagram media link.', ANSI.yellow));
  }
}

async function askPostDownloadAction() {
  while (true) {
    renderMenuBox(
      'Next Action',
      'Choose what you want to do after download',
      [
        '1. Exit',
        '2. Return to Download Menu',
        '3. Select Another Instagram Account',
        '4. Download Selected Media',
      ],
      ANSI.green
    );

    const choice = await askQuestion(colorize('Action > ', ANSI.bold));
    if (choice === '1') return 'exit';
    if (choice === '2') return 'returnToDownloadMenu';
    if (choice === '3') return 'selectAnotherProfile';
    if (choice === '4') return 'downloadSelectedMedia';
    console.log(colorize('Invalid selection. Choose 1, 2, 3 or 4.', ANSI.yellow));
  }
}

module.exports = {
  askQuestion,
  normalizeProfileUrl,
  normalizeInstagramUsername,
  buildProfileTarget,
  parseInstagramUrl,
  toCanonicalInstagramUrl,
  resolveProfileTargetFromPath,
  resolveInstagramInput,
  sanitizeName,
  sanitizeSegment,
  formatCount,
  formatFileSize,
  formatDateTime,
  truncateMiddle,
  colorize,
  padRight,
  renderMenuBox,
  formatItemCountLabel,
  countEstimatedThumbnailAssets,
  countEstimatedCarouselAssets,
  countEstimatedWholeProfileAssets,
  buildDownloadMenuRows,
  getProgressColors,
  renderProgressLine,
  finishProgressLine,
  clearProgressLine,
  renderActivityLine,
  createSmoothProgress,
  ensureDirectoryExists,
  loadCookies,
  askDownloadMode,
  askSelectedMediaLinks,
  askDownloadSelection,
  askPostDownloadAction,
};
