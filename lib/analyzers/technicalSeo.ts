import type { ParsedContent, Issue, Severity } from "../types";

let id = 0;
const mk = (severity: Severity, title: string, found: string, fix: string, rule: string): Issue => ({
  id: id++,
  severity,
  category: "Technical SEO",
  title,
  found,
  fix,
  rule,
});

export function analyzeTechnicalSeo(c: ParsedContent, isStructured: boolean): Issue[] {
  id = 2000;
  const issues: Issue[] = [];
  if (!isStructured) return issues;

  // ---- Structured data (8) ----
  if (c.schemas.length === 0) {
    issues.push(mk("critical", "No structured data on page", "No JSON-LD schema blocks found.", "Add at minimum Organization schema (with logo, sameAs social links, contactPoint). Solution pages should also have Service schema.", "Schema / Presence"));
  } else {
    // Expected types by context
    const hasOrg = c.schemaTypes.includes("Organization") || c.schemaTypes.includes("Corporation");
    const hasWebsite = c.schemaTypes.includes("WebSite");
    const hasService = c.schemaTypes.includes("Service");
    const hasArticle = c.schemaTypes.includes("Article") || c.schemaTypes.includes("BlogPosting") || c.schemaTypes.includes("NewsArticle");
    const hasBreadcrumb = c.schemaTypes.includes("BreadcrumbList");
    const hasFaq = c.schemaTypes.includes("FAQPage");

    if (!hasOrg) {
      issues.push(mk("important", "No Organization schema", `Schemas present: ${c.schemaTypes.join(", ") || "none"}`, "Add Organization schema with name: \"Embee Software\", url, logo, sameAs (LinkedIn, X, YouTube, Medium), contactPoint.", "Schema / Organization"));
    }
    if (!hasBreadcrumb) {
      issues.push(mk("important", "No BreadcrumbList schema", "Breadcrumb trail not exposed to search engines as structured data.", "Add BreadcrumbList schema — shows breadcrumbs in SERP and improves crawl understanding.", "Schema / Breadcrumb"));
    }
    if (!hasWebsite) {
      issues.push(mk("nice", "No WebSite schema", "WebSite schema enables sitelinks search box in Google.", "Add WebSite schema with potentialAction search.", "Schema / WebSite"));
    }

    // Content-type appropriateness
    const faqMarkers = /frequently asked|faq|Q:|A:/i.test(c.bodyText);
    if (faqMarkers && !hasFaq) {
      issues.push(mk("important", "FAQ content without FAQPage schema", "Page contains Q&A content but no FAQPage schema.", "Wrap each Q&A in FAQPage schema — eligible for rich results and featured snippets.", "Schema / FAQ"));
    }
  }

  // Schema self-reference: Organization.sameAs should include social channels
  const orgSchema = c.schemas.find((s) => {
    const t = s?.["@type"];
    return t === "Organization" || t === "Corporation" || (Array.isArray(t) && t.includes("Organization"));
  });
  if (orgSchema && !orgSchema.sameAs) {
    issues.push(mk("nice", "Organization schema missing sameAs", "No sameAs property linking Embee's social profiles.", "Add sameAs array with LinkedIn, X, YouTube, Facebook, Medium URLs — consolidates entity signals.", "Schema / Organization"));
  }

  // ---- Performance signals (8) ----
  if (c.externalScriptDomains.length > 6) {
    issues.push(mk("important", `High third-party script count (${c.externalScriptDomains.length} domains)`, `Loaded from: ${c.externalScriptDomains.slice(0, 5).join(", ")}${c.externalScriptDomains.length > 5 ? " …" : ""}`, "Audit third-party scripts. Every one blocks main thread and adds DNS + TLS handshake. Target ≤5 external domains.", "Performance / Third-party"));
  }

  if (c.renderBlockingInHead > 3) {
    issues.push(mk("important", `${c.renderBlockingInHead} render-blocking resources in <head>`, "Synchronous <script> / <link rel=stylesheet> without media or defer/async in head.", "Add defer or async to non-critical scripts. Use media queries or preload for stylesheets. Render-blocking kills Largest Contentful Paint.", "Performance / Render-blocking"));
  }

  if (!c.hasPreloadedHero && isStructured) {
    issues.push(mk("nice", "No preloaded hero image", "<link rel=\"preload\" as=\"image\"> not found.", "Preload the hero image — usually drives Largest Contentful Paint. Saves 200–500ms on first render.", "Performance / LCP"));
  }

  // Charset
  if (!c.charset) {
    issues.push(mk("nice", "No explicit charset declaration", "No <meta charset> or Content-Type meta found.", "Add <meta charset=\"utf-8\"> as first element in <head>.", "Technical / Charset"));
  }

  // Viewport quality
  if (c.viewport && !/width=device-width/i.test(c.viewport)) {
    issues.push(mk("critical", "Viewport meta is incorrectly configured", `Current: "${c.viewport}"`, "Use content=\"width=device-width, initial-scale=1\". Anything else breaks mobile layout.", "Technical / Viewport"));
  }

  return issues;
}
