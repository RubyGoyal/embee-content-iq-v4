import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const USER_AGENT =
  "Mozilla/5.0 (compatible; EmbeeContentIQ/3.0; +https://embee.co.in)";

export async function POST(req: NextRequest) {
  try {
    const { sitemapUrl, rawList } = await req.json();

    let urls: string[] = [];

    if (rawList && typeof rawList === "string") {
      // Parse a line-separated URL list
      urls = rawList
        .split(/\r?\n/)
        .map((l: string) => l.trim())
        .filter((l: string) => /^https?:\/\//i.test(l));
    } else if (sitemapUrl && typeof sitemapUrl === "string") {
      if (!/^https?:\/\//i.test(sitemapUrl)) {
        return NextResponse.json({ error: "Sitemap URL must start with http(s)://" }, { status: 400 });
      }
      urls = await fetchSitemap(sitemapUrl);
    } else {
      return NextResponse.json({ error: "Provide sitemapUrl or rawList" }, { status: 400 });
    }

    // Dedupe + cap
    urls = [...new Set(urls)].slice(0, 50);

    if (urls.length === 0) {
      return NextResponse.json({ error: "No valid URLs found" }, { status: 400 });
    }

    return NextResponse.json({ urls, count: urls.length });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Sitemap parse failed" }, { status: 500 });
  }
}

async function fetchSitemap(url: string, depth = 0): Promise<string[]> {
  if (depth > 2) return []; // avoid infinite sitemap index recursion

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    const xml = await res.text();

    // Sitemap index — recurse
    if (xml.includes("<sitemapindex")) {
      const childUrls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
      const all: string[] = [];
      // Limit: only first 5 child sitemaps, each returns up to 50 URLs
      for (const child of childUrls.slice(0, 5)) {
        try {
          const nested = await fetchSitemap(child, depth + 1);
          all.push(...nested);
          if (all.length >= 100) break;
        } catch {
          // skip failed child sitemap
        }
      }
      return all;
    }

    // Regular sitemap
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map((m) => m[1].trim())
      .filter((u) => /^https?:\/\//i.test(u));

    return locs;
  } finally {
    clearTimeout(timeout);
  }
}
