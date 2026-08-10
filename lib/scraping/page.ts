import type { Browser, Page } from "puppeteer-core";
import { launchBrowser, SCRAPER_USER_AGENT } from "./browser";
import { extractBrandFromPage, type BrandInfo } from "./brand";

export interface ScrapedPage {
  url: string;
  title: string;
  metaDescription: string;
  text: string;
  /** Same-origin links, used to decide which other pages are worth reading. */
  links: string[];
}

const DEFAULT_MAX_CHARS = 10_000;
const NAVIGATION_TIMEOUT_MS = 30_000;

/**
 * Path segments that describe the business rather than the marketing hook,
 * ordered by how much they tend to explain what a company actually sells.
 * Matched whole, because a loose match pulls in pages like
 * "service-information", which is regulatory boilerplate.
 */
const INFORMATIVE_PATH_SEGMENTS = [
  ["about", "about-us", "company", "what-we-do"],
  ["product", "products", "platform", "solutions"],
  ["pricing", "plans"],
  ["customers", "case-studies", "who-we-serve", "industries"],
];

function normaliseUrl(input: string): string {
  return input.startsWith("http://") || input.startsWith("https://") ? input : `https://${input}`;
}

async function readPage(
  page: Page,
  url: string,
  maxChars: number,
  settleMs: number
): Promise<ScrapedPage> {
  await page.goto(url, { waitUntil: "networkidle2", timeout: NAVIGATION_TIMEOUT_MS });

  // Marketing sites lazy-load most of their copy, so the text is read after a beat.
  await new Promise((resolve) => setTimeout(resolve, settleMs));

  const extracted = await page.evaluate((limit: number) => {
    document.querySelectorAll("script, style, noscript").forEach((element) => element.remove());

    const metaDescription =
      document.querySelector("meta[name=\"description\"]")?.getAttribute("content") ??
      document.querySelector("meta[property=\"og:description\"]")?.getAttribute("content") ??
      "";

    const body = document.body;
    const text = (body?.innerText || body?.textContent || "")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join("\n")
      .substring(0, limit);

    const links = Array.from(document.querySelectorAll("a[href]"))
      .map((anchor) => (anchor as HTMLAnchorElement).href)
      .filter((href) => href.startsWith(window.location.origin));

    return { title: document.title, metaDescription, text, links };
  }, maxChars);

  return {
    url,
    title: extracted.title?.trim() ?? "",
    metaDescription: extracted.metaDescription?.trim() ?? "",
    text: extracted.text,
    links: Array.from(new Set(extracted.links)),
  };
}

async function openPage(browser: Browser): Promise<Page> {
  const page = await browser.newPage();
  await page.setUserAgent(SCRAPER_USER_AGENT);
  return page;
}

/** Reads a single page's visible text. */
export async function scrapePageText(options: {
  url: string;
  maxChars?: number;
}): Promise<{ data: ScrapedPage | null; error: string | null }> {
  const { url, maxChars = DEFAULT_MAX_CHARS } = options;

  let browser: Browser | null = null;

  try {
    browser = await launchBrowser();
    const page = await openPage(browser);
    const scraped = await readPage(page, normaliseUrl(url), maxChars, 2000);

    return { data: scraped, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to scrape page";
    console.log(`[Scrape] ${url} failed: ${message}`);
    return { data: null, error: message };
  } finally {
    await browser?.close().catch(() => undefined);
  }
}

/** Ranks a homepage's own links so the crawl spends its budget on real substance. */
function pickFollowUpLinks(homepage: ScrapedPage, limit: number): string[] {
  const scored = homepage.links
    .filter((link) => link !== homepage.url && !link.includes("#"))
    .map((link) => {
      const segments = link
        .replace(/^https?:\/\/[^/]+/, "")
        .toLowerCase()
        .split("/")
        .filter(Boolean);

      const rank = INFORMATIVE_PATH_SEGMENTS.findIndex((group) =>
        segments.some((segment) => group.includes(segment))
      );

      return { link, rank, depth: segments.length };
    })
    .filter((candidate) => candidate.rank !== -1)
    // Prefer the most informative kind of page, and the shallowest of its kind.
    .sort((a, b) => a.rank - b.rank || a.depth - b.depth);

  // One page per kind, so the crawl does not spend its budget on four products.
  const seenRank = new Set<number>();
  const picked: string[] = [];

  for (const candidate of scored) {
    if (seenRank.has(candidate.rank)) continue;
    seenRank.add(candidate.rank);
    picked.push(candidate.link);
    if (picked.length === limit) break;
  }

  return picked;
}

export interface ScrapedSite {
  pages: ScrapedPage[];
  brand: BrandInfo | null;
}

/**
 * Reads a company's homepage plus the few sub-pages that best explain what it
 * sells, and takes the brand off the homepage on the way past, so one browser
 * covers everything the research needs.
 */
export async function scrapeCompanySite(options: {
  domain: string;
  maxPages?: number;
  maxCharsPerPage?: number;
  includeBrand?: boolean;
}): Promise<{ data: ScrapedSite | null; error: string | null }> {
  const { domain, maxPages = 3, maxCharsPerPage = 6000, includeBrand = true } = options;
  const homeUrl = normaliseUrl(domain);

  let browser: Browser | null = null;

  try {
    console.log(`[Scrape] reading ${homeUrl} and up to ${maxPages - 1} sub-page(s)...`);

    browser = await launchBrowser();
    const page = await openPage(browser);

    const homepage = await readPage(page, homeUrl, maxCharsPerPage, 1500);
    const pages: ScrapedPage[] = [homepage];

    // Taken before navigating away, while the homepage is still loaded.
    const brand = includeBrand ? await extractBrandFromPage(page, domain) : null;

    for (const link of pickFollowUpLinks(homepage, maxPages - 1)) {
      try {
        // Sub-pages settle faster than the homepage and are worth less, so a
        // slow one is dropped rather than holding up the research.
        pages.push(await readPage(page, link, maxCharsPerPage, 800));
      } catch (error) {
        console.log(
          `[Scrape] skipped ${link}: ${error instanceof Error ? error.message : "unknown error"}`
        );
      }
    }

    console.log(
      `[Scrape] read ${pages.length} page(s) from ${domain} (${pages.reduce((total, entry) => total + entry.text.length, 0)} chars)`
    );

    return { data: { pages, brand }, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to scrape site";
    console.log(`[Scrape] ${homeUrl} failed: ${message}`);
    return { data: null, error: message };
  } finally {
    await browser?.close().catch(() => undefined);
  }
}
