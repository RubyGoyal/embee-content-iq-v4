import * as cheerio from "cheerio";
import type { ParsedContent, ParsedImage, ParsedLink } from "./types";

export function parseHTML(html: string, baseUrl: string): ParsedContent {
  const $ = cheerio.load(html);
  const htmlLength = html.length;

  // ------ Meta / head ------
  const title = $("title").first().text().trim();
  const metaDescription = $('meta[name="description"]').attr("content")?.trim() || "";
  const canonical = $('link[rel="canonical"]').attr("href")?.trim() || "";
  const robotsMeta = $('meta[name="robots"]').attr("content")?.trim() || "";
  const lang = $("html").attr("lang")?.trim() || "";
  const charset =
    $("meta[charset]").attr("charset") ||
    $('meta[http-equiv="Content-Type"]').attr("content") ||
    "";
  const viewport = $('meta[name="viewport"]').attr("content")?.trim() || "";
  const favicon =
    $('link[rel="icon"]').length > 0 ||
    $('link[rel="shortcut icon"]').length > 0 ||
    $('link[rel="apple-touch-icon"]').length > 0;

  // ------ Open Graph & Twitter ------
  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim() || "";
  const ogDescription = $('meta[property="og:description"]').attr("content")?.trim() || "";
  const ogImage = $('meta[property="og:image"]').attr("content")?.trim() || "";
  const ogType = $('meta[property="og:type"]').attr("content")?.trim() || "";
  const ogUrl = $('meta[property="og:url"]').attr("content")?.trim() || "";
  const twitterCard = $('meta[name="twitter:card"]').attr("content")?.trim() || "";
  const twitterTitle = $('meta[name="twitter:title"]').attr("content")?.trim() || "";
  const twitterImage = $('meta[name="twitter:image"]').attr("content")?.trim() || "";

  // ------ Headings (before chrome removal so we keep everything) ------
  const h1 = $("h1").map((_, el) => $(el).text().trim()).get().filter(Boolean);
  const h2 = $("h2").map((_, el) => $(el).text().trim()).get().filter(Boolean);
  const h3 = $("h3").map((_, el) => $(el).text().trim()).get().filter(Boolean);

  const headingSequence: Array<{ level: number; text: string }> = [];
  $("h1, h2, h3, h4, h5, h6").each((_, el) => {
    const tag = (el as any).tagName || (el as any).name;
    const level = parseInt(tag.replace(/[^\d]/g, ""));
    const text = $(el).text().trim();
    if (text) headingSequence.push({ level, text });
  });

  // ------ Schemas (before we strip scripts) ------
  const schemas: any[] = [];
  const schemaTypes = new Set<string>();
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).text());
      const collect = (obj: any) => {
        if (!obj || typeof obj !== "object") return;
        if (Array.isArray(obj)) {
          obj.forEach(collect);
          return;
        }
        if (obj["@type"]) {
          if (Array.isArray(obj["@type"])) obj["@type"].forEach((t: string) => schemaTypes.add(t));
          else schemaTypes.add(obj["@type"]);
        }
        if (obj["@graph"]) obj["@graph"].forEach(collect);
      };
      collect(parsed);
      schemas.push(parsed);
    } catch {
      // ignore malformed schema blocks
    }
  });

  // ------ Performance signals ------
  const scripts = $("script[src]");
  const scriptCount = scripts.length;
  const externalScriptDomains = new Set<string>();
  let renderBlockingInHead = 0;
  const headHtml = $("head").html() || "";
  $("head script[src]").each((_, el) => {
    const hasAsync = $(el).attr("async") !== undefined;
    const hasDefer = $(el).attr("defer") !== undefined;
    if (!hasAsync && !hasDefer) renderBlockingInHead++;
  });
  $("head link[rel=stylesheet]").each((_, el) => {
    const media = $(el).attr("media");
    if (!media || media === "all" || media === "screen") renderBlockingInHead++;
  });
  scripts.each((_, el) => {
    const src = $(el).attr("src") || "";
    if (src.startsWith("http")) {
      try {
        externalScriptDomains.add(new URL(src).hostname);
      } catch {
        /* ignore */
      }
    }
  });

  const hasPreloadedHero = $('link[rel="preload"][as="image"]').length > 0;

  // ------ Author / date / freshness ------
  const publishDate =
    $('meta[property="article:published_time"]').attr("content") ||
    $("time[datetime]").first().attr("datetime") ||
    $('meta[name="date"]').attr("content") ||
    "";
  const modifiedDate =
    $('meta[property="article:modified_time"]').attr("content") ||
    $('meta[name="last-modified"]').attr("content") ||
    "";
  const authorName =
    $('meta[name="author"]').attr("content") ||
    $('[rel="author"]').first().text().trim() ||
    $(".author, .byline").first().text().trim() ||
    "";

  // ------ Breadcrumbs ------
  const hasBreadcrumbs =
    schemaTypes.has("BreadcrumbList") ||
    $('nav[aria-label*="readcrumb" i], .breadcrumb, .breadcrumbs, [class*=breadcrumb]').length > 0;

  // ------ Images ------
  const images: ParsedImage[] = [];
  $("img").each((_, el) => {
    const $el = $(el);
    const src = $el.attr("src") || $el.attr("data-src") || "";
    const altAttr = el.attribs?.alt;
    const alt = altAttr === undefined ? null : altAttr;
    const hasDimensions = Boolean($el.attr("width") && $el.attr("height"));
    const isLazy = $el.attr("loading") === "lazy" || Boolean($el.attr("data-src"));
    const filename = src.split("/").pop()?.split("?")[0] || "";
    if (src) images.push({ src, alt, hasDimensions, isLazy, filename });
  });

  // ------ Landmarks & accessibility ------
  const hasMainLandmark = $("main, [role=main]").length > 0;
  const hasArticleLandmark = $("article").length > 0;
  const hasSkipLink = $('a[href^="#"]').first().text().trim().toLowerCase().includes("skip") || false;

  // ------ Hidden text sniffer ------
  let hiddenTextSuspect = false;
  $("[style]").each((_, el) => {
    const style = ($(el).attr("style") || "").toLowerCase();
    if (style.includes("display:none") || style.includes("visibility:hidden")) {
      const txt = $(el).text().trim();
      if (txt.length > 40) hiddenTextSuspect = true;
    }
  });

  // ------ Links (classify before chrome removal) ------
  const baseHost = safeHost(baseUrl);
  const linksRaw: ParsedLink[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    const anchor = $(el).text().trim();
    if (!href || href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:") || href.startsWith("tel:")) {
      return;
    }
    let isInternal = false;
    if (href.startsWith("/")) {
      isInternal = true;
    } else if (href.startsWith("http")) {
      try {
        const h = new URL(href).hostname;
        isInternal =
          baseHost !== "" &&
          (h === baseHost || h.endsWith("." + baseHost) || h === "embee.co.in" || h.endsWith(".embee.co.in"));
      } catch {
        /* ignore */
      }
    }
    linksRaw.push({
      href,
      anchor,
      isInternal,
      rel: $(el).attr("rel") || "",
      target: $(el).attr("target") || "",
    });
  });

  // ------ CTA candidates (before chrome removal) ------
  const ctaSet = new Set<string>();
  $("a.button, a.btn, .cta a, button, a[class*=cta], a[class*=button], a[class*=Button], a[class*=hero]").each((_, el) => {
    const t = $(el).text().trim();
    if (t && t.length > 0 && t.length < 80) ctaSet.add(t);
  });

  // ------ Body text (now safe to strip chrome) ------
  const $clone = cheerio.load($.html());
  $clone("script, style, noscript, nav, header, footer, iframe, aside").remove();
  const bodyText = $clone("body").text().replace(/\s+/g, " ").trim().slice(0, 30000);

  return {
    title,
    metaDescription,
    canonical,
    robotsMeta,
    lang,
    charset,
    viewport,
    favicon,

    ogTitle,
    ogDescription,
    ogImage,
    ogType,
    ogUrl,
    twitterCard,
    twitterTitle,
    twitterImage,

    h1,
    h2,
    h3,
    headingSequence,

    bodyText,
    htmlLength,
    textLength: bodyText.length,
    hasMainLandmark,
    hasArticleLandmark,

    links: linksRaw,
    images,
    ctaButtons: [...ctaSet].slice(0, 25),

    schemas,
    schemaTypes: [...schemaTypes],
    hasBreadcrumbs,

    scriptCount,
    externalScriptDomains: [...externalScriptDomains],
    renderBlockingInHead,
    hasPreloadedHero,

    publishDate,
    modifiedDate,
    authorName,

    finalUrl: baseUrl,
    url: baseUrl,
    httpsOk: baseUrl.startsWith("https://"),

    hiddenTextSuspect,
    hasSkipLink,
  };
}

export function normalizeText(raw: string, assetType?: string): ParsedContent {
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  const firstLine = lines[0] || "";
  const looksLikeTitle = firstLine.length > 0 && firstLine.length < 120 && !firstLine.endsWith(".");
  return {
    title: looksLikeTitle ? firstLine : "",
    metaDescription: "",
    canonical: "",
    robotsMeta: "",
    lang: "",
    charset: "",
    viewport: "",
    favicon: true,

    ogTitle: "",
    ogDescription: "",
    ogImage: "",
    ogType: "",
    ogUrl: "",
    twitterCard: "",
    twitterTitle: "",
    twitterImage: "",

    h1: looksLikeTitle ? [firstLine] : [],
    h2: [],
    h3: [],
    headingSequence: looksLikeTitle ? [{ level: 1, text: firstLine }] : [],

    bodyText: raw,
    htmlLength: raw.length,
    textLength: raw.length,
    hasMainLandmark: true,
    hasArticleLandmark: true,

    links: [],
    images: [],
    ctaButtons: [],

    schemas: [],
    schemaTypes: [],
    hasBreadcrumbs: true,

    scriptCount: 0,
    externalScriptDomains: [],
    renderBlockingInHead: 0,
    hasPreloadedHero: true,

    publishDate: "",
    modifiedDate: "",
    authorName: "",

    finalUrl: "",
    url: "",
    httpsOk: true,

    hiddenTextSuspect: false,
    hasSkipLink: true,
  };
}

function safeHost(u: string): string {
  try {
    return new URL(u).hostname;
  } catch {
    return "";
  }
}
