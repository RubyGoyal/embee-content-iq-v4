import type { ParsedContent, Issue, Severity } from "../types";

let id = 0;
const mk = (severity: Severity, title: string, found: string, fix: string, rule: string): Issue => ({
  id: id++,
  severity,
  category: "On-page SEO",
  title,
  found,
  fix,
  rule,
});

export function analyzeOnPageSeo(c: ParsedContent, isStructured: boolean): Issue[] {
  id = 1000;
  const issues: Issue[] = [];
  if (!isStructured) return issues; // these checks need parsed HTML

  // ---- Meta & head (12) ----
  if (!c.title) {
    issues.push(mk("blocker", "No <title> tag", "The page has no title element.", "Add a <title> with your primary keyword front-loaded (50–60 chars).", "Meta / Title"));
  } else {
    if (c.title.length > 60) {
      issues.push(mk("important", `Title tag too long (${c.title.length} chars)`, `"${c.title}"`, "Trim to 50–60 chars. Front-load keyword; brand at the end.", "Meta / Title"));
    } else if (c.title.length < 25) {
      issues.push(mk("important", `Title tag too short (${c.title.length} chars)`, `"${c.title}"`, "Aim for 50–60 chars to use available SERP space.", "Meta / Title"));
    }
    // Title vs H1 identical
    if (c.h1[0] && c.title.trim().toLowerCase() === c.h1[0].trim().toLowerCase()) {
      issues.push(mk("nice", "Title tag identical to H1", `Both are "${c.title}"`, "Differentiate — title should be SERP-optimized with brand at end; H1 can be more conversational.", "Meta / Title"));
    }
  }

  if (!c.metaDescription) {
    issues.push(mk("critical", "Missing meta description", "No <meta name=\"description\"> tag found.", "Add 140–160 char meta description with primary keyword, proof point (e.g. \"2500+ enterprises\"), and CTA cue.", "Meta / Description"));
  } else {
    if (c.metaDescription.length < 120) {
      issues.push(mk("important", `Meta description too short (${c.metaDescription.length} chars)`, `"${c.metaDescription}"`, "Expand to 140–160 chars. Include keyword + proof + CTA.", "Meta / Description"));
    } else if (c.metaDescription.length > 165) {
      issues.push(mk("nice", `Meta description too long (${c.metaDescription.length} chars)`, `Current: "${c.metaDescription.slice(0, 90)}…"`, "Trim to 140–160 chars to avoid SERP truncation.", "Meta / Description"));
    }
  }

  if (!c.canonical) {
    issues.push(mk("important", "Missing canonical tag", "No <link rel=\"canonical\"> found.", "Add a self-referencing canonical — prevents duplicate-content issues across URL variants.", "Meta / Canonical"));
  }

  if (c.robotsMeta && /noindex/i.test(c.robotsMeta)) {
    issues.push(mk("blocker", "Page has noindex directive", `robots meta: "${c.robotsMeta}"`, "Remove noindex unless this page is intentionally hidden from search.", "Meta / Robots"));
  }

  // OG completeness
  const missingOg: string[] = [];
  if (!c.ogTitle) missingOg.push("og:title");
  if (!c.ogDescription) missingOg.push("og:description");
  if (!c.ogImage) missingOg.push("og:image");
  if (!c.ogType) missingOg.push("og:type");
  if (missingOg.length > 0) {
    issues.push(mk("important", `Open Graph incomplete (${missingOg.length} missing)`, `Missing: ${missingOg.join(", ")}.`, "Add the missing OG tags. LinkedIn is Embee's primary social channel — broken OG = broken previews.", "Meta / OpenGraph"));
  }

  if (!c.twitterCard) {
    issues.push(mk("nice", "Missing Twitter Card meta", "No twitter:card tag.", "Add twitter:card (summary_large_image), twitter:title, twitter:image for X previews.", "Meta / Twitter"));
  }

  if (!c.lang) {
    issues.push(mk("important", "Missing lang attribute on <html>", "<html> has no lang.", "Add lang=\"en-IN\" — helps search engines and screen readers identify content locale.", "Meta / Lang"));
  } else if (c.lang === "en" || c.lang === "en-US") {
    issues.push(mk("nice", `lang="${c.lang}" is generic`, `Currently "${c.lang}".`, "Consider lang=\"en-IN\" for Indian B2B audience targeting.", "Meta / Lang"));
  }

  if (!c.favicon) {
    issues.push(mk("nice", "No favicon", "No icon link found in head.", "Add favicon.ico and apple-touch-icon for browser tabs and bookmarks.", "Meta / Favicon"));
  }

  if (!c.viewport) {
    issues.push(mk("critical", "Missing viewport meta", "No <meta name=\"viewport\"> found.", "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"> — required for mobile.", "Meta / Viewport"));
  }

  // ---- Heading hierarchy (8) ----
  if (c.h1.length === 0) {
    issues.push(mk("blocker", "No H1 on page", "No <h1> element detected.", "Add exactly one H1 with the primary keyword.", "Headings / H1"));
  } else if (c.h1.length > 1) {
    issues.push(mk("important", `Multiple H1s (${c.h1.length})`, c.h1.slice(0, 3).map((h) => `"${h}"`).join(" · "), "Keep exactly one H1. Demote the others to H2.", "Headings / H1"));
  } else if (c.h1[0].length > 70) {
    issues.push(mk("nice", `H1 too long (${c.h1[0].length} chars)`, `"${c.h1[0]}"`, "Trim to <70 chars. Long H1s dilute keyword focus.", "Headings / H1"));
  }

  // Skipped heading levels
  for (let i = 0; i < c.headingSequence.length - 1; i++) {
    const cur = c.headingSequence[i];
    const next = c.headingSequence[i + 1];
    if (next.level - cur.level > 1) {
      issues.push(mk("nice", `Skipped heading level: H${cur.level} → H${next.level}`, `After "${cur.text.slice(0, 60)}" jumps to H${next.level} "${next.text.slice(0, 60)}".`, "Don't skip heading levels — it breaks accessibility and document outline.", "Headings / Hierarchy"));
      break; // flag once
    }
  }

  // Empty headings
  if (c.h2.length === 0 && c.bodyText.length > 1500) {
    issues.push(mk("important", "No H2 subheadings on long-form content", `${c.bodyText.length}-char body with no H2s.`, "Add H2 subheadings every 200–300 words. Improves scannability and SEO.", "Headings / Structure"));
  }

  // ---- URL & navigation (6) ----
  if (c.url) {
    try {
      const u = new URL(c.url);
      const slug = u.pathname.split("/").filter(Boolean).pop() || "";
      const pathDepth = u.pathname.split("/").filter(Boolean).length;

      if (pathDepth > 4) {
        issues.push(mk("nice", `URL is ${pathDepth} folders deep`, `${u.pathname}`, "Keep URLs ≤3–4 folders deep. Deep URLs get crawled less.", "URL / Depth"));
      }

      if (/^\d{4}[-\/]\d{2}[-\/]\d{2}/.test(slug)) {
        issues.push(mk("nice", "Date-prefixed URL on evergreen content", `Slug: "${slug}"`, "Remove date from URL unless this is news/dated content — evergreen content ages poorly with dates in URL.", "URL / Slug"));
      }

      if (slug.split("-").length < 2 && slug.length > 0) {
        issues.push(mk("nice", "URL slug is too short", `Slug: "${slug}"`, "Use descriptive, keyword-containing slugs (3–5 words separated by hyphens).", "URL / Slug"));
      }

      const stopWordsInSlug = ["and", "or", "the", "a", "an", "of", "for", "with", "to", "in", "on"].filter((w) =>
        new RegExp(`(^|-)${w}(-|$)`, "i").test(slug)
      );
      if (stopWordsInSlug.length > 0) {
        issues.push(mk("nice", "Stop words in URL slug", `Contains: ${stopWordsInSlug.join(", ")}`, "Remove stop words from URL slug — denser keyword signal.", "URL / Slug"));
      }
    } catch {
      // not a URL, skip
    }
  }

  if (!c.httpsOk) {
    issues.push(mk("blocker", "Page not served over HTTPS", "URL uses http://, not https://.", "Force HTTPS site-wide. Chrome flags HTTP pages as insecure.", "URL / HTTPS"));
  }

  if (!c.hasBreadcrumbs) {
    issues.push(mk("important", "No breadcrumb navigation", "No breadcrumb schema or breadcrumb nav element detected.", "Add a breadcrumb component + BreadcrumbList schema. Improves crawl understanding and SERP display.", "Navigation / Breadcrumbs"));
  }

  // ---- Images (8) ----
  const imgsWithoutAlt = c.images.filter((i) => i.alt === null);
  const imgsWithEmptyAlt = c.images.filter((i) => i.alt === "");
  const imgsWithBadAlt = c.images.filter(
    (i) =>
      i.alt !== null &&
      i.alt !== "" &&
      (/^(image|img|photo|picture|dsc[_-]?\d+|screenshot|banner)\d*\.?(jpg|png|webp)?$/i.test(i.alt) ||
        /^(image|img|photo|picture)\s*\d*$/i.test(i.alt))
  );
  const imgsNoDimensions = c.images.filter((i) => !i.hasDimensions);

  if (imgsWithoutAlt.length > 0) {
    issues.push(mk("critical", `${imgsWithoutAlt.length} image${imgsWithoutAlt.length > 1 ? "s" : ""} missing alt attribute`, `Examples: ${imgsWithoutAlt.slice(0, 2).map((i) => i.filename || i.src.slice(0, 40)).join(", ")}`, "Every img needs an alt attribute. Use alt=\"\" for purely decorative images, descriptive text otherwise.", "Images / Alt"));
  }

  if (imgsWithBadAlt.length > 0) {
    issues.push(mk("important", `${imgsWithBadAlt.length} image${imgsWithBadAlt.length > 1 ? "s" : ""} with low-quality alt text`, `Examples: ${imgsWithBadAlt.slice(0, 3).map((i) => `"${i.alt}"`).join(", ")}`, "Rewrite alt text to describe what's in the image, ideally with a keyword. \"image1.png\" is useless for SEO and accessibility.", "Images / Alt"));
  }

  if (imgsNoDimensions.length > 2) {
    issues.push(mk("important", `${imgsNoDimensions.length} images without width/height attributes`, `Missing dimensions cause layout shift (CLS).`, "Add explicit width and height on every <img> — prevents Cumulative Layout Shift, a Core Web Vital.", "Images / CLS"));
  }

  const badFilenames = c.images.filter((i) => /^(dsc|img|image|screenshot)[_-]?\d+\./i.test(i.filename));
  if (badFilenames.length > 0) {
    issues.push(mk("nice", `${badFilenames.length} image${badFilenames.length > 1 ? "s" : ""} with generic filename`, `Examples: ${badFilenames.slice(0, 3).map((i) => i.filename).join(", ")}`, "Rename to descriptive filenames like azure-migration-embee.webp. Filenames are a minor SEO signal.", "Images / Filename"));
  }

  // ---- Content markup (8) ----
  const ratio = c.htmlLength > 0 ? c.textLength / c.htmlLength : 0;
  if (ratio < 0.1 && c.htmlLength > 5000) {
    issues.push(mk("important", `Low content-to-HTML ratio (${(ratio * 100).toFixed(1)}%)`, `${c.textLength} chars of text vs ${c.htmlLength} chars of HTML.`, "Target >15%. Too much markup and too little content suggests over-engineered templates or thin content.", "Content / Ratio"));
  }

  if (c.hiddenTextSuspect) {
    issues.push(mk("critical", "Possible hidden text detected", "Found text inside display:none or visibility:hidden elements.", "Remove hidden text. Google treats deliberately hidden keyword text as spam.", "Content / Hidden Text"));
  }

  if (!c.hasMainLandmark) {
    issues.push(mk("important", "Missing <main> landmark", "No <main> or role=\"main\" element.", "Wrap primary content in <main>. Improves screen-reader navigation and crawler understanding of primary content.", "Markup / Landmarks"));
  }

  return issues;
}
