import { existsSync } from "fs";
import type { Browser } from "puppeteer-core";

/**
 * Chrome comes from the machine in local dev and from @sparticuz/chromium on
 * Vercel, so every scraper shares this launcher rather than repeating the
 * branch.
 */

const CHROME_PATHS = {
  mac: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
  ],
  linux: ["/usr/bin/google-chrome", "/usr/bin/chromium-browser", "/usr/bin/chromium"],
};

const VIEWPORT = { width: 1280, height: 800 };

export const SCRAPER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export function findLocalChrome(): string | null {
  const paths = process.platform === "darwin" ? CHROME_PATHS.mac : CHROME_PATHS.linux;

  for (const chromePath of paths) {
    if (existsSync(chromePath)) return chromePath;
  }

  return null;
}

export function isLocalChromeEnvironment(): boolean {
  return (
    process.platform === "darwin" ||
    process.env.NODE_ENV === "development" // pragma: allowlist secret
  );
}

/** Throws when local dev has no Chrome installed; callers decide how to degrade. */
export async function launchBrowser(): Promise<Browser> {
  const puppeteer = (await import("puppeteer-core")).default;

  if (isLocalChromeEnvironment()) {
    const localChrome = findLocalChrome();

    if (!localChrome) {
      throw new Error("Chrome not found. Please install Google Chrome.");
    }

    return puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
      defaultViewport: VIEWPORT,
      executablePath: localChrome,
      headless: true,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chromium = (await import("@sparticuz/chromium")).default as any;
  chromium.setHeadlessMode = true;
  chromium.setGraphicsMode = false;

  return puppeteer.launch({
    args: chromium.args,
    defaultViewport: VIEWPORT,
    executablePath: await chromium.executablePath(),
    headless: true,
  });
}
