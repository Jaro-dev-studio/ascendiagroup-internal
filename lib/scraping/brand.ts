import type { Browser, Page } from "puppeteer-core";
import { launchBrowser, SCRAPER_USER_AGENT } from "./browser";

export interface BrandInfo {
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  companyName: string;
}

/** Used whenever the site cannot be read, so callers always get a usable palette. */
const DEFAULT_BRAND: BrandInfo = {
  logoUrl: null,
  primaryColor: "#3B82F6",
  secondaryColor: "#1E293B",
  accentColor: "#10B981",
  companyName: "Company",
};

function rgbToHex(rgb: string): string | null {
  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return null;

  const r = parseInt(match[1], 10);
  const g = parseInt(match[2], 10);
  const b = parseInt(match[3], 10);

  if ((r === 255 && g === 255 && b === 255) || (r === 0 && g === 0 && b === 0)) {
    return null;
  }

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
}

/** White and black are on every site, so they say nothing about the brand. */
function isValidColor(hex: string | null): boolean {
  if (!hex) return false;
  const upper = hex.toUpperCase();
  return (
    upper !== "#FFFFFF" && upper !== "#000000" && upper !== "#FFF" && upper !== "#000" && hex.length >= 4
  );
}

export function extractCompanyNameFromDomain(domain: string): string {
  let name = domain.replace(/^https?:\/\//, "").replace(/^www\./, "");

  const parts = name.split(".");
  if (parts.length > 0) {
    name = parts[0];
  }

  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function extractDomainFromEmail(email: string): string {
  const parts = email.split("@");
  if (parts.length !== 2) return "";
  return parts[1];
}

/**
 * Reads the brand off a page that is already loaded, so a caller who is
 * visiting the homepage anyway does not pay for a second browser.
 */
export async function extractBrandFromPage(page: Page, domain: string): Promise<BrandInfo> {
  try {
    const brandData = await page.evaluate(() => {
      let logoUrl: string | null = null;

      const ogImage = document.querySelector("meta[property=\"og:image\"]");
      if (ogImage) {
        logoUrl = ogImage.getAttribute("content");
      }

      if (!logoUrl) {
        const appleTouchIcon = document.querySelector("link[rel=\"apple-touch-icon\"]");
        if (appleTouchIcon) {
          logoUrl = appleTouchIcon.getAttribute("href");
        }
      }

      if (!logoUrl) {
        const favicon =
          document.querySelector("link[rel=\"icon\"]") ||
          document.querySelector("link[rel=\"shortcut icon\"]");
        if (favicon) {
          logoUrl = favicon.getAttribute("href");
        }
      }

      if (!logoUrl) {
        const logoImages = Array.from(document.querySelectorAll("img")).filter((img) => {
          const src = img.src?.toLowerCase() || "";
          const alt = img.alt?.toLowerCase() || "";
          const className = img.className?.toLowerCase() || "";
          return src.includes("logo") || alt.includes("logo") || className.includes("logo");
        });
        if (logoImages.length > 0) {
          logoUrl = logoImages[0].src;
        }
      }

      if (logoUrl && !logoUrl.startsWith("http")) {
        logoUrl = new URL(logoUrl, window.location.origin).href;
      }

      const colors: string[] = [];

      const styles = getComputedStyle(document.documentElement);
      const cssVarNames = [
        "--primary",
        "--primary-color",
        "--brand-color",
        "--brand",
        "--accent",
        "--accent-color",
        "--main-color",
        "--theme-color",
      ];

      for (const varName of cssVarNames) {
        const value = styles.getPropertyValue(varName).trim();
        if (value) {
          colors.push(value);
        }
      }

      const themeColor = document.querySelector("meta[name=\"theme-color\"]");
      if (themeColor) {
        const color = themeColor.getAttribute("content");
        if (color) colors.push(color);
      }

      const elementsToCheck = [
        document.querySelector("header"),
        document.querySelector("nav"),
        document.querySelector(".navbar"),
        document.querySelector(".header"),
        document.querySelector("button"),
        document.querySelector(".btn"),
        document.querySelector(".button"),
        document.querySelector("a.btn"),
        document.querySelector("[class*='primary']"),
        document.querySelector("[class*='brand']"),
      ];

      for (const el of elementsToCheck) {
        if (el) {
          const computed = getComputedStyle(el);
          if (computed.backgroundColor && computed.backgroundColor !== "rgba(0, 0, 0, 0)") {
            colors.push(computed.backgroundColor);
          }
          if (computed.color) {
            colors.push(computed.color);
          }
        }
      }

      let companyName = "";

      const ogSiteName = document.querySelector("meta[property=\"og:site_name\"]");
      if (ogSiteName) {
        companyName = ogSiteName.getAttribute("content") || "";
      }

      if (!companyName) {
        companyName = document.title.split(/[|\-–—]/)[0].trim().substring(0, 50);
      }

      return { logoUrl, colors, companyName };
    });

    const processedColors: string[] = [];
    for (const color of brandData.colors) {
      if (color.startsWith("#")) {
        if (isValidColor(color)) {
          processedColors.push(color);
        }
      } else if (color.startsWith("rgb")) {
        const hex = rgbToHex(color);
        if (hex && isValidColor(hex)) {
          processedColors.push(hex);
        }
      }
    }

    const uniqueColors = [...new Set(processedColors)];

    const result: BrandInfo = {
      logoUrl: brandData.logoUrl,
      primaryColor: uniqueColors[0] || DEFAULT_BRAND.primaryColor,
      secondaryColor: uniqueColors[1] || DEFAULT_BRAND.secondaryColor,
      accentColor: uniqueColors[2] || DEFAULT_BRAND.accentColor,
      companyName: brandData.companyName || extractCompanyNameFromDomain(domain),
    };

    console.log("[scrape-brand] Extracted brand:", result);

    return result;
  } catch (error) {
    console.error("[scrape-brand] Error reading brand from page:", error);
    return { ...DEFAULT_BRAND, companyName: extractCompanyNameFromDomain(domain) };
  }
}

export async function scrapeBrandFromDomain(domain: string): Promise<BrandInfo> {
  let browser: Browser | null = null;

  try {
    let url = domain;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`;
    }

    console.log("[scrape-brand] Scraping brand from:", url);

    browser = await launchBrowser();

    const page = await browser.newPage();
    await page.setUserAgent(SCRAPER_USER_AGENT);

    await page.goto(url, { waitUntil: "networkidle2", timeout: 20000 });

    await new Promise((resolve) => setTimeout(resolve, 1500));

    return await extractBrandFromPage(page, domain);
  } catch (error) {
    console.error("[scrape-brand] Error scraping brand:", error);
    return { ...DEFAULT_BRAND, companyName: extractCompanyNameFromDomain(domain) };
  } finally {
    await browser?.close().catch(() => undefined);
  }
}
