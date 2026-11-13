import fs from 'fs';
import path from 'path';
import { chromium, type BrowserContext, type Page } from 'playwright';
import { getSettings } from '@/db/settings';

const PROFILE_DIR = process.env.CHROME_PROFILE_PATH || '/app/data/chrome-profile';
const MAX_CACHE_BYTES = 250 * 1024 * 1024; // 250 MB HTTP disk cache ceiling

let sharedContext: BrowserContext | null = null;
let activeProxySignature: string | null = null;
let launchPromise: Promise<BrowserContext> | null = null;

function getDirectorySizeBytes(targetDir: string): number {
  if (!fs.existsSync(targetDir)) return 0;
  let total = 0;
  const entries = fs.readdirSync(targetDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(targetDir, entry.name);
    try {
      if (entry.isDirectory()) {
        total += getDirectorySizeBytes(fullPath);
      } else if (entry.isFile()) {
        total += fs.statSync(fullPath).size;
      }
    } catch {
      // Ignore transient Chromium lock files
    }
  }
  return total;
}

export function pruneChromeDiskCache(): void {
  const cacheDirs = [
    path.join(PROFILE_DIR, 'Default', 'Cache'),
    path.join(PROFILE_DIR, 'Default', 'Code Cache'),
    path.join(PROFILE_DIR, 'Default', 'GPUCache'),
    path.join(PROFILE_DIR, 'ShaderCache'),
  ];

  let combinedBytes = 0;
  for (const dir of cacheDirs) {
    combinedBytes += getDirectorySizeBytes(dir);
  }

  if (combinedBytes <= MAX_CACHE_BYTES) {
    return;
  }

  for (const dir of cacheDirs) {
    try {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    } catch {
      // Best-effort cache pruning while preserving Cookies & Local Storage
    }
  }
}

async function seedGoogleConsentCookies(context: BrowserContext): Promise<void> {
  const expires = Math.floor(Date.now() / 1000) + 180 * 24 * 60 * 60;
  await context.addCookies([
    {
      name: 'CONSENT',
      value: 'PENDING+987',
      domain: '.google.com',
      path: '/',
      expires,
      httpOnly: false,
      secure: true,
      sameSite: 'Lax',
    },
    {
      name: 'SOCS',
      value: 'CAISHAgCEhJnd3NfMjAyNDA4MTUtMF9SQzIaAmVuIAEaBgiA_LyaBg',
      domain: '.google.com',
      path: '/',
      expires,
      httpOnly: false,
      secure: true,
      sameSite: 'Lax',
    },
  ]);
}

async function launchPersistentBrowser(
  proxyUrl: string | null
): Promise<BrowserContext> {
  if (!fs.existsSync(PROFILE_DIR)) {
    fs.mkdirSync(PROFILE_DIR, { recursive: true });
  }

  pruneChromeDiskCache();

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: true,
    viewport: { width: 1366, height: 768 },
    locale: 'en-US',
    timezoneId: process.env.TZ || 'America/New_York',
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    proxy: proxyUrl ? { server: proxyUrl } : undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });
  });

  await seedGoogleConsentCookies(context);

  context.on('close', () => {
    if (sharedContext === context) {
      sharedContext = null;
      activeProxySignature = null;
    }
  });

  sharedContext = context;
  activeProxySignature = proxyUrl ?? '';
  return context;
}

export async function getBrowserContext(): Promise<BrowserContext> {
  const settings = getSettings();
  const desiredProxy = settings.proxyUrl ?? '';

  // If proxy configuration changed since last launch, recycle the persistent context cleanly
  if (sharedContext && activeProxySignature !== desiredProxy) {
    const oldContext = sharedContext;
    sharedContext = null;
    activeProxySignature = null;
    try {
      await oldContext.close();
    } catch {
      // Ignore already-closed browser context
    }
  }

  if (sharedContext) {
    return sharedContext;
  }

  if (!launchPromise) {
    launchPromise = launchPersistentBrowser(settings.proxyUrl).finally(() => {
      launchPromise = null;
    });
  }

  return launchPromise;
}

export async function openIsolatedGooglePage(): Promise<Page> {
  const context = await getBrowserContext();
  const page = await context.newPage();

  // Defense-in-depth: lock network requests strictly to Google Flights domains and strip heavy assets
  await page.route('**/*', async (route) => {
    const request = route.request();
    const urlStr = request.url();
    const resourceType = request.resourceType();

    if (
      urlStr.startsWith('data:') ||
      urlStr.startsWith('blob:') ||
      urlStr === 'about:blank'
    ) {
      await route.continue();
      return;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(urlStr);
    } catch {
      await route.abort('blockedbyclient');
      return;
    }

    if (parsedUrl.protocol !== 'https:') {
      await route.abort('blockedbyclient');
      return;
    }

    const host = parsedUrl.hostname.toLowerCase();
    const isAllowedDomain =
      host === 'www.google.com' ||
      host === 'google.com' ||
      host === 'consent.google.com' ||
      host.endsWith('.gstatic.com') ||
      host.endsWith('.googleapis.com');

    if (!isAllowedDomain) {
      await route.abort('blockedbyclient');
      return;
    }

    if (
      resourceType === 'image' ||
      resourceType === 'media' ||
      resourceType === 'font'
    ) {
      await route.abort('blockedbyclient');
      return;
    }

    await route.continue();
  });

  return page;
}