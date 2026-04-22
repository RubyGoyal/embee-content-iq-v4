import type { ParsedContent, Issue, Severity, AssetType } from "../types";

let id = 0;
const mk = (severity: Severity, title: string, found: string, fix: string, rule: string): Issue => ({
  id: id++,
  severity,
  category: "Internal Linking",
  title,
  found,
  fix,
  rule,
});

// Authoritative domains — links TO these from Embee are good
const AUTHORITY_DOMAINS = [
  "learn.microsoft.com", "docs.microsoft.com", "microsoft.com",
  "help.sap.com", "sap.com",
  "gartner.com", "forrester.com", "idc.com",
  "nist.gov", "iso.org",
  "mckinsey.com", "bain.com", "bcg.com",
  "hbr.org",
];

// Low-authority / flag-worthy domains
const LOW_AUTHORITY_PATTERNS = [
  /^blog\d/i, // numbered blog subdomains (ghost content)
  /medium\.com\/@\w+$/, // personal Medium accounts (exception: embeesoftware's own)
];

// Competitor domains (for Embee — Indian Microsoft LSPs / IT consulting)
const COMPETITOR_DOMAINS = [
  "wipro.com", "infosys.com", "tcs.com", "hcltech.com",
  "techmahindra.com", "mindtree.com", "birlasoft.com",
  "cognizant.com", "happiestminds.com", "ltimindtree.com",
];

export function analyzeInternalLinking(c: ParsedContent, assetType: AssetType, isStructured: boolean): Issue[] {
  id = 6000;
  const issues: Issue[] = [];
  if (!isStructured) return issues;

  const internalLinks = c.links.filter((l) => l.isInternal);
  const externalLinks = c.links.filter((l) => !l.isInternal);

  // ---- Internal link count by asset type (3) ----
  const targets: Record<string, { min: number; ideal: number }> = {
    "solution-page": { min: 3, ideal: 6 },
    "landing-page": { min: 1, ideal: 3 },
    blog: { min: 5, ideal: 10 },
    email: { min: 1, ideal: 3 },
    social: { min: 0, ideal: 1 },
    pdf: { min: 2, ideal: 5 },
  };
  const t = targets[assetType];

  if (internalLinks.length < t.min) {
    issues.push(mk(
      "important",
      `Very few internal links (${internalLinks.length})`,
      `A ${assetType.replace("-", " ")} should have ≥${t.min} internal links, ideally ${t.ideal}+.`,
      "Add contextual links to related Embee pages. Solution pages should link to related solutions, success stories, and relevant blog posts. Internal linking distributes authority and improves crawl coverage.",
      "Internal Link Count"
    ));
  } else if (internalLinks.length < t.ideal && assetType !== "social") {
    issues.push(mk(
      "nice",
      `Internal linking could be richer (${internalLinks.length} links)`,
      `Currently ${internalLinks.length}, ideal is ${t.ideal}+.`,
      "Layer in more contextual links where they add reader value — not for SEO's sake, but because a solution page that references \"SAP workloads\" should naturally link to /solutions/sap-on-azure.",
      "Internal Link Count"
    ));
  }

  // ---- Solution-page → related-solution + success-story (2) ----
  if (assetType === "solution-page" && isStructured) {
    const hasSolutionLink = internalLinks.some((l) => /\/solutions\//i.test(l.href));
    const hasSuccessStoryLink = internalLinks.some((l) => /\/success-stor(?:y|ies)/i.test(l.href));
    if (!hasSolutionLink) {
      issues.push(mk(
        "important",
        "No links to related solution pages",
        "Solution page has no internal links pointing to other /solutions/ URLs.",
        "Add 2–3 links to related Embee solutions. Azure pages should link to SAP on Azure, Cloud Security, Azure Managed Services. SAP pages should link to SAP on Azure, SAP S/4HANA. Related-link blocks also keep readers on site.",
        "Solution Graph"
      ));
    }
    if (!hasSuccessStoryLink) {
      issues.push(mk(
        "important",
        "No link to a success story or case study",
        "Solution page does not link to /success-story/ or /success-stories/ URL.",
        "Link to at least one relevant success story. Embee's homepage features Aegon Life (Azure + VDI), Sun Pharma (endpoint security), Venus Remedies (M365), JSW, Genpact. Pick one whose industry matches this page's target buyer.",
        "Solution Graph"
      ));
    }
  }

  // ---- Anchor text quality (6) ----
  const genericAnchors = internalLinks.filter((l) =>
    /^(click here|read more|learn more|know more|more|here|link|this|this link)$/i.test(l.anchor.trim())
  );
  if (genericAnchors.length > 0) {
    issues.push(mk(
      "important",
      `${genericAnchors.length} internal link${genericAnchors.length > 1 ? "s use" : " uses"} generic anchor text`,
      `Examples: ${genericAnchors.slice(0, 3).map((l) => `"${l.anchor}" → ${l.href.slice(0, 50)}`).join(", ")}`,
      "Use descriptive anchor text containing the target page's topic. \"Click here\" teaches search engines nothing; \"our Azure migration playbook\" teaches it everything. Also a big accessibility win for screen-reader users.",
      "Anchor Text"
    ));
  }

  // Empty anchors
  const emptyAnchors = internalLinks.filter((l) => !l.anchor || l.anchor.trim().length === 0);
  if (emptyAnchors.length > 0) {
    issues.push(mk(
      "important",
      `${emptyAnchors.length} internal link${emptyAnchors.length > 1 ? "s have" : " has"} no anchor text`,
      "Likely image-only links without alt text, or empty <a> tags.",
      "Every link needs accessible text — either descriptive anchor text, or for image-only links, alt text on the image that describes the destination.",
      "Anchor Text"
    ));
  }

  // Over-optimization: same anchor text pointing to same page 3+ times
  const anchorMap = new Map<string, number>();
  for (const l of internalLinks) {
    if (l.anchor.length > 3) {
      const key = `${l.anchor.toLowerCase()}→${l.href}`;
      anchorMap.set(key, (anchorMap.get(key) || 0) + 1);
    }
  }
  const overOptimized = [...anchorMap.entries()].filter(([_, count]) => count >= 3);
  if (overOptimized.length > 0) {
    issues.push(mk(
      "nice",
      "Same anchor text to same page used 3+ times",
      `${overOptimized[0][0].split("→")[0]} points to the same URL ${overOptimized[0][1]} times.`,
      "Vary anchor text. Repeated identical anchors look manipulative to search engines and redundant to readers.",
      "Anchor Text"
    ));
  }

  // Very long anchor text
  const longAnchors = internalLinks.filter((l) => l.anchor.length > 100);
  if (longAnchors.length > 0) {
    issues.push(mk(
      "nice",
      `${longAnchors.length} internal link${longAnchors.length > 1 ? "s have" : " has"} very long anchor text`,
      `Example: "${longAnchors[0].anchor.slice(0, 80)}..." (${longAnchors[0].anchor.length} chars)`,
      "Anchor text over 100 chars usually means the whole paragraph is inside an <a> tag. Link only the relevant phrase.",
      "Anchor Text"
    ));
  }

  // ---- External link quality (6) ----
  if (externalLinks.length > 0) {
    // Missing rel=noopener
    const noopenerMissing = externalLinks.filter((l) => l.target === "_blank" && !l.rel.includes("noopener"));
    if (noopenerMissing.length > 0) {
      issues.push(mk(
        "important",
        `${noopenerMissing.length} external link${noopenerMissing.length > 1 ? "s" : ""} opening in new tab without rel="noopener"`,
        "target=\"_blank\" without rel=\"noopener\" is a known security risk (reverse tabnabbing).",
        "Add rel=\"noopener noreferrer\" to every external link that uses target=\"_blank\".",
        "External Links"
      ));
    }

    // Competitor links
    const competitorLinks = externalLinks.filter((l) => {
      try {
        const host = new URL(l.href, c.url).hostname.replace(/^www\./, "");
        return COMPETITOR_DOMAINS.some((c) => host === c || host.endsWith("." + c));
      } catch {
        return false;
      }
    });
    if (competitorLinks.length > 0) {
      issues.push(mk(
        "important",
        `Linking to competitor domain${competitorLinks.length > 1 ? "s" : ""}`,
        `Examples: ${competitorLinks.slice(0, 2).map((l) => new URL(l.href, c.url).hostname).join(", ")}`,
        "Review whether these competitor links are intentional. Most B2B sites avoid linking to direct competitors — it passes authority to them and potentially sends buyers their way.",
        "External Links"
      ));
    }

    // Authority links — positive signal, flag absence
    const hasAuthorityLinks = externalLinks.some((l) => {
      try {
        const host = new URL(l.href, c.url).hostname.replace(/^www\./, "");
        return AUTHORITY_DOMAINS.some((d) => host === d || host.endsWith("." + d));
      } catch {
        return false;
      }
    });
    if (!hasAuthorityLinks && externalLinks.length > 2 && c.bodyText.length > 1500) {
      issues.push(mk(
        "nice",
        "No external links to authoritative sources",
        "Outbound linking to Microsoft Learn, SAP Help, Gartner, or similar authoritative sources signals E-E-A-T and content research.",
        "Where you reference a fact or product, link to its primary source — Microsoft Learn for Azure/M365 claims, SAP Help Portal for SAP, Gartner for market stats.",
        "External Links"
      ));
    }
  }

  // ---- URL quality in links (2) ----
  const httpLinks = externalLinks.filter((l) => l.href.startsWith("http://"));
  if (httpLinks.length > 0) {
    issues.push(mk(
      "nice",
      `${httpLinks.length} external link${httpLinks.length > 1 ? "s use" : " uses"} insecure HTTP`,
      `Examples: ${httpLinks.slice(0, 2).map((l) => l.href).join(", ")}`,
      "Update to HTTPS where the destination supports it. Otherwise consider removing — Chrome flags HTTP destinations.",
      "External Links"
    ));
  }

  // Anchor-text-as-URL (lazy)
  const urlAsAnchor = c.links.filter((l) =>
    /^https?:\/\//i.test(l.anchor) || /^www\./i.test(l.anchor)
  );
  if (urlAsAnchor.length > 0) {
    issues.push(mk(
      "nice",
      `${urlAsAnchor.length} link${urlAsAnchor.length > 1 ? "s use the URL itself" : " uses the URL itself"} as anchor text`,
      `Example: "${urlAsAnchor[0].anchor.slice(0, 60)}"`,
      "Replace the URL with descriptive anchor text. URLs as link text are hard to scan and tell search engines nothing about the destination.",
      "Anchor Text"
    ));
  }

  return issues;
}
