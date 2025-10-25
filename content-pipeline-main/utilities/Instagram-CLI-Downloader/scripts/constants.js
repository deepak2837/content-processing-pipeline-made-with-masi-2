const path = require('path');

const GRAPHQL_URL = 'https://www.instagram.com/graphql/query';
const PAGE_SIZE = 12;
const POSTS_PAGINATION_DOC_ID = '26508860605453072';
const ROOT_DIR = path.resolve(__dirname, '..');
const COOKIE_FILE = path.join(ROOT_DIR, '.env', 'cookie.json');
const DOWNLOADS_DIR = path.join(ROOT_DIR, 'Downloads');
const BROWSER_LAUNCH_OPTIONS = { headless: true };
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';
const DEFAULT_ACCEPT_LANGUAGE = 'en-US,en;q=0.9';
const NAVIGATION_WAIT_UNTIL = 'networkidle2';
const NAVIGATION_TIMEOUT_MS = 60000;
const INSTAGRAM_WEB_APP_ID = '936619743392459';
const INSTAGRAM_HOST_PATTERN = /(^|\.)instagram\.com$/i;
const INSTAGRAM_USERNAME_PATTERN = /^(?!\.)(?!.*\.\.)(?!.*\.$)[A-Za-z0-9._]{1,30}$/;
const PROFILE_SECTION_SEGMENTS = new Set(['reels', 'tagged', 'guides', 'channels']);
const RESOURCE_PATH_SEGMENTS = new Set(['p', 'reel', 'reels', 'tv']);
const RESERVED_ROOT_SEGMENTS = new Set([
  'about',
  'accounts',
  'api',
  'challenge',
  'developer',
  'direct',
  'download',
  'explore',
  'legal',
  'notifications',
  'oauth',
  'p',
  'press',
  'privacy',
  'reel',
  'reels',
  'stories',
  'tv',
  'web',
]);
const STAR_SPINNER_FRAMES = ['\u2736', '\u2738', '\u2739', '\u273a', '\u2739', '\u2737'];
const ANSI = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  dim: '\x1b[90m',
  bold: '\x1b[1m',
};
const PROFILE_META_SELECTORS = [
  'meta[property="og:description"]',
  'meta[name="description"]',
  'meta[property="al:ios:url"]',
  'meta[property="al:android:url"]',
];
const OWNER_USERNAME_REGEX_PATTERNS = [
  /"owner"\s*:\s*\{[^{}]*"username"\s*:\s*"([A-Za-z0-9._]{1,30})"/,
  /"user"\s*:\s*\{[^{}]*"username"\s*:\s*"([A-Za-z0-9._]{1,30})"/,
  /"reel_owner"\s*:\s*\{[^{}]*"username"\s*:\s*"([A-Za-z0-9._]{1,30})"/,
];
const USERNAME_FROM_TEXT_PATTERNS = [
  /\(@([A-Za-z0-9._]{1,30})\)/,
  /-\s*([A-Za-z0-9._]{1,30})\s+on\s+/i,
  /from\s+.+?\s+\(@([A-Za-z0-9._]{1,30})\)/i,
  /^([A-Za-z0-9._]{1,30})\s+on\s+/i,
];

const DOWNLOAD_OPTIONS = {
  '1': { key: 'videos', label: 'Videos' },
  '2': { key: 'reels', label: 'Reels' },
  '3': { key: 'photos', label: 'Photos' },
  '4': { key: 'carousels', label: 'Carousel Posts' },
  '5': { key: 'thumbnails', label: 'Thumbnails' },
  '6': { key: 'dp', label: 'DP' },
  '7': { key: 'stories', label: 'Stories' },
  '8': { key: 'highlights', label: 'Highlights' },
  '9': { key: 'wholeProfile', label: 'Whole Profile' },
  '10': { key: 'downloadSelectedMedia', label: 'Download Selected Media' },
  '11': { key: 'selectAnotherProfile', label: 'Select another Instagram profile' },
  '12': { key: 'exit', label: 'Exit' },
};

module.exports = {
  GRAPHQL_URL,
  PAGE_SIZE,
  POSTS_PAGINATION_DOC_ID,
  COOKIE_FILE,
  DOWNLOADS_DIR,
  BROWSER_LAUNCH_OPTIONS,
  DEFAULT_USER_AGENT,
  DEFAULT_ACCEPT_LANGUAGE,
  NAVIGATION_WAIT_UNTIL,
  NAVIGATION_TIMEOUT_MS,
  INSTAGRAM_WEB_APP_ID,
  INSTAGRAM_HOST_PATTERN,
  INSTAGRAM_USERNAME_PATTERN,
  PROFILE_SECTION_SEGMENTS,
  RESOURCE_PATH_SEGMENTS,
  RESERVED_ROOT_SEGMENTS,
  STAR_SPINNER_FRAMES,
  ANSI,
  PROFILE_META_SELECTORS,
  OWNER_USERNAME_REGEX_PATTERNS,
  USERNAME_FROM_TEXT_PATTERNS,
  DOWNLOAD_OPTIONS,
};
