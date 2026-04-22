import { analyzeOnPageSeo } from "./analyzers/onPageSeo";
import { analyzeTechnicalSeo } from "./analyzers/technicalSeo";
import { analyzeContentQuality } from "./analyzers/contentQuality";
import { analyzeBrand } from "./analyzers/brand";
import { analyzeCopywriting } from "./analyzers/copywriting";
import { analyzeInternalLinking } from "./analyzers/internalLinking";
import { analyzeConversion } from "./analyzers/conversion";
import { analyzeGeo } from "./analyzers/geo";
import { SOLUTION_DICT } from "./dictionary";
import type {
  AssetType,
  AuditReport,
  Issue,
  KeywordCoverage,
  ParsedContent,
  SubScores,
  Category,
} from "./types";

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

interface RunOptions {
  content: ParsedContent;
  assetType: AssetType;
  isStructured: boolean;
}

export function runAllAnalyzers(opts: RunOptions): {
  issues: Issue[];
  keywords: KeywordCoverage[];
  stats: AuditReport["stats"];
  insights: AuditReport["insights"];
} {
  const { content, assetType, isStructured } = opts;

  const seoIssues = analyzeOnPageSeo(content, isStructured);
  const techIssues = analyzeTechnicalSeo(content, isStructured);
  const contentIssues = analyzeContentQuality(content, assetType);
  const brandResult = analyzeBrand(content, assetType);
  const copyResult = analyzeCopywriting(content, assetType, isStructured);
  const internalIssues = analyzeInternalLinking(content, assetType, isStructured);
  const conversionIssues = analyzeConversion(content, assetType, isStructured);
  const geoIssues = analyzeGeo(content, assetType, isStructured);

  const issues: Issue[] = [
    ...seoIssues,
    ...techIssues,
    ...contentIssues,
    ...brandResult.issues,
    ...copyResult.issues,
    ...internalIssues,
    ...conversionIssues,
    ...geoIssues,
  ];

  const keywords = computeKeywordCoverage(content);
  const words = content.bodyText.split(/\s+/).filter(Boolean);
  const sentences = content.bodyText.match(/[^.!?]+[.!?]+/g) || [];
  const paragraphs = content.bodyText.split(/\n{2,}/).filter((p) => p.trim().length > 20);

  const stats: AuditReport["stats"] = {
    words: words.length,
    sentences: sentences.length,
    paragraphs: paragraphs.length,
    images: content.images.length,
    internalLinks: content.links.filter((l) => l.isInternal).length,
    externalLinks: content.links.filter((l) => !l.isInternal).length,
  };

  const insights: AuditReport["insights"] = {
    flesch: brandResult.stats.flesch,
    passiveVoicePct: brandResult.stats.passivePct,
    contentHtmlRatio: content.htmlLength > 0 ? content.textLength / content.htmlLength : undefined,
    searchIntent: copyResult.insights.searchIntent,
    intentMatch: copyResult.insights.intentMatch,
  };

  return { issues, keywords, stats, insights };
}

export function computeKeywordCoverage(c: ParsedContent): KeywordCoverage[] {
  const found = new Set<string>();
  const haystack =
    c.bodyText + " " + c.title + " " + c.h1.join(" ") + " " + c.h2.join(" ") + " " + c.metaDescription;

  for (const rule of SOLUTION_DICT) {
    const re = new RegExp("\\b" + escapeRegex(rule.approved) + "\\b", "i");
    if (re.test(haystack)) found.add(rule.approved);
  }

  const coverage: KeywordCoverage[] = [];
  for (const kw of found) {
    const escaped = escapeRegex(kw);
    const inTitle = new RegExp(escaped, "i").test(c.title);
    const inH1 = new RegExp(escaped, "i").test(c.h1.join(" "));
    const inH2 = new RegExp(escaped, "i").test(c.h2.join(" "));
    const inMeta = new RegExp(escaped, "i").test(c.metaDescription);
    const inUrl = c.url
      ? new RegExp(escaped.toLowerCase().replace(/\s+/g, "[-_ ]?"), "i").test(c.url.toLowerCase())
      : false;
    const first100 = c.bodyText.split(/\s+/).slice(0, 100).join(" ");
    const inFirst100 = new RegExp(escaped, "i").test(first100);
    const inAlt = c.images.some((img) => img.alt && new RegExp(escaped, "i").test(img.alt));

    const occurrences = (c.bodyText.match(new RegExp(escaped, "gi")) || []).length;
    const wordCount = c.bodyText.split(/\s+/).filter(Boolean).length || 1;
    const density = ((occurrences / wordCount) * 100).toFixed(1) + "%";

    const signals = [inTitle, inH1, inH2, inMeta, inFirst100, inAlt].filter(Boolean).length;
    let status: "good" | "weak" | "miss" = "good";
    if (occurrences === 0) status = "miss";
    else if (signals < 2) status = "weak";

    coverage.push({ kw, inTitle, inH1, inUrl, inFirst100, inH2, inAlt, inMeta, density, status });
  }

  return coverage;
}

export function computeScore(issues: Issue[]): { score: number; subScores: SubScores } {
  const sub: SubScores = {
    onPageSeo: 100,
    technical: 100,
    contentQuality: 100,
    eeat: 100,
    copywriting: 100,
    internalLinking: 100,
    geo: 100,
    brand: 100,
    conversion: 100,
  };

  const cat2sub: Partial<Record<Category, keyof SubScores>> = {
    "On-page SEO": "onPageSeo",
    "Technical SEO": "technical",
    "Content Quality": "contentQuality",
    "E-E-A-T": "eeat",
    Copywriting: "copywriting",
    "Internal Linking": "internalLinking",
    GEO: "geo",
    Brand: "brand",
    Conversion: "conversion",
    Structure: "onPageSeo",
  };

  const penaltyFor = (s: string) => {
    if (s === "blocker") return 22;
    if (s === "critical") return 14;
    if (s === "important") return 7;
    return 2;
  };

  for (const i of issues) {
    const bucket = cat2sub[i.category];
    if (!bucket) continue;
    sub[bucket] -= penaltyFor(i.severity);
  }

  (Object.keys(sub) as (keyof SubScores)[]).forEach((k) => {
    sub[k] = Math.max(15, sub[k]);
  });

  // Rebalanced weights for 9 sub-scores (sum = 1.0)
  const weights: Record<keyof SubScores, number> = {
    onPageSeo: 0.15,
    technical: 0.1,
    contentQuality: 0.14,
    eeat: 0.1,
    copywriting: 0.12,
    internalLinking: 0.08,
    geo: 0.09,
    brand: 0.11,
    conversion: 0.11,
  };

  let weighted = 0;
  (Object.keys(weights) as (keyof SubScores)[]).forEach((k) => {
    weighted += sub[k] * weights[k];
  });

  const minSub = Math.min(...Object.values(sub));
  const floorCap = 40 + minSub * 0.55;

  const blockerCount = issues.filter((i) => i.severity === "blocker").length;
  const blockerCap = blockerCount > 0 ? 65 - (blockerCount - 1) * 5 : 100;

  const score = Math.round(Math.min(weighted, floorCap, blockerCap));

  return { score, subScores: sub };
}

export function verdictFor(score: number): "Publish-ready" | "Minor fixes" | "Significant rework" | "Do not publish" {
  if (score >= 85) return "Publish-ready";
  if (score >= 70) return "Minor fixes";
  if (score >= 50) return "Significant rework";
  return "Do not publish";
}
