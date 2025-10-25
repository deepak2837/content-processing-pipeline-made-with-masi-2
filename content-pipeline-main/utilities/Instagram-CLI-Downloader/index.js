const { ANSI } = require('./scripts/constants');

const {
  askQuestion,
  sanitizeName,
  formatCount,
  colorize,
  renderMenuBox,
  askDownloadMode,
  askSelectedMediaLinks,
  askDownloadSelection,
  askPostDownloadAction,
} = require('./scripts/cli');

const {
  createBrowserSession,
  closeBrowserSession,
  scanProfile,
} = require('./scripts/instagram-session');

const {
  buildAssetsForSelection,
  downloadMedia,
} = require('./scripts/downloader');

const { scanSelectedMedia } = require('./scripts/selected-media');

function renderWelcome() {
  const rows = [
    'Instagram CLI Downloader',
    'Scan once, then download selected media types.',
  ];

  renderMenuBox('Welcome', null, rows, ANSI.blue);
}

function buildScanOverviewRows(scan) {
  const rows = [
    `Instagram Username : @${scan.profile.username}`,
    `Profile Type       : ${scan.profile.isPrivate ? 'Private' : 'Public'}`,
    `Total Posts        : ${scan.profile.totalPosts}`,
    `Followers          : ${formatCount(scan.profile.followers)}`,
    `Following          : ${formatCount(scan.profile.following)}`,
  ];

  if (scan.profile.links.length > 0) {
    scan.profile.links.forEach((link, index) => {
      rows.push(`Link ${index + 1}            : ${link}`);
    });
  } else {
    rows.push('Links              : None');
  }

  return rows;
}

function printScanReport(scan) {
  renderMenuBox(
    'Scan Result',
    'Profile overview and discovered media',
    buildScanOverviewRows(scan),
    ANSI.cyan
  );

  if (scan.summary.totalScannedPosts !== scan.profile.totalPosts) {
    renderMenuBox(
      'Scan Note',
      'Instagram returned fewer accessible posts than the profile total',
      [
        `Profile shows     : ${scan.profile.totalPosts} posts`,
        `Timeline returned : ${scan.summary.totalScannedPosts} accessible posts`,
      ],
      ANSI.dim
    );
  }
}

function buildZipFilename(scan, selectedOptions) {
  const selectedSlug = [...selectedOptions].sort().join('_');
  return `${sanitizeName(scan.profile.username)}_${selectedSlug}.zip`;
}

function buildSelectedZipFilename() {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, '');
  return `selected_media_${stamp}.zip`;
}

async function runSelectionLoop(scan, session) {
  while (true) {
    const selection = await askDownloadSelection(scan);
    if (selection.action === 'exit') {
      return 'exit';
    }
    if (selection.action === 'downloadSelectedMedia') {
      return 'downloadSelectedMedia';
    }
    if (selection.action === 'selectAnotherProfile') {
      return 'selectAnotherProfile';
    }

    const assets = await buildAssetsForSelection(scan, selection.selectedOptions);

    if (assets.length === 0) {
      console.log('No downloadable media matched your selected options.');
    } else {
      const zipFilename = buildZipFilename(scan, selection.selectedOptions);
      console.log(`\nReady to download ${assets.length} highest-quality file(s).`);
      await downloadMedia(assets, zipFilename, session.userAgent);
    }

    const nextAction = await askPostDownloadAction();
    if (nextAction === 'exit') {
      return 'exit';
    }
    if (nextAction === 'downloadSelectedMedia') {
      return 'downloadSelectedMedia';
    }
    if (nextAction === 'selectAnotherProfile') {
      return 'selectAnotherProfile';
    }
  }
}

async function runSelectedMediaFlow() {
  const links = await askSelectedMediaLinks();
  const session = await createBrowserSession();

  try {
    const assets = await scanSelectedMedia(session, links);

    if (assets.length === 0) {
      console.log('No downloadable media found for the selected links.');
    } else {
      console.log(`\nReady to download ${assets.length} highest-quality file(s).`);
      await downloadMedia(assets, buildSelectedZipFilename(), session.userAgent);
    }

    return await askPostDownloadAction();
  } finally {
    await closeBrowserSession(session);
  }
}

async function runProfileFlow() {
  const profileUrl = await askQuestion(colorize('Enter Instagram username or URL: ', ANSI.bold));
  const session = await createBrowserSession();

  try {
    const scan = await scanProfile(session, profileUrl);
    printScanReport(scan);
    return await runSelectionLoop(scan, session);
  } finally {
    await closeBrowserSession(session);
  }
}

async function main() {
  renderWelcome();

  let nextMode = await askDownloadMode();

  while (true) {
    try {
      const action = nextMode === 'downloadSelectedMedia'
        ? await runSelectedMediaFlow()
        : await runProfileFlow();

      if (action === 'exit') {
        return;
      }
      if (action === 'downloadSelectedMedia') {
        nextMode = 'downloadSelectedMedia';
        continue;
      }
      nextMode = 'downloadBulkMedia';
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exitCode = 1;
      return;
    }
  }
}

main();
