import type { ParsedContent, Issue, Severity, AssetType } from "../types";
import { SOLUTION_DICT, JARGON_PHRASES } from "../dictionary";

let id = 0;
const mk = (severity: Severity, title: string, found: string, fix: string, rule: string, category: "Brand" | "Conversion" = "Brand"): Issue => ({
  id: id++,
  severity,
  category,
  title,
  found,
  fix,
  rule,
});

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const MARKETING_SPEAK = [
  "revolutionize", "revolutionise", "transform your business", "unleash",
  "game-changing", "game-changer", "disrupt", "disruption",
  "paradigm shift", "next-level", "skyrocket", "supercharge",
  "unparalleled", "unprecedented", "top-tier", "best of breed",
  "tailor-made", "tailor made", "hand-in-hand", "end-to-end seamless",
];

export function analyzeBrand(c: ParsedContent, assetType: AssetType): { issues: Issue[]; stats: { passivePct: number; avgSentLen: number; flesch: number } } {
  id = 4000;
  const issues: Issue[] = [];

  const fullText = [
    c.title,
    c.metaDescription,
    c.h1.join(" "),
    c.h2.join(" "),
    c.bodyText,
  ].filter(Boolean).join(" ");

  // ---- Solution naming (expanded) ----
  for (const rule of SOLUTION_DICT) {
    for (const bad of rule.bad) {
      const re = new RegExp("\\b" + escapeRegex(bad) + "\\b", "gi");
      const matches = fullText.match(re);
      if (matches && matches.length > 0) {
        issues.push(mk(
          "critical",
          `"${bad}" should be "${rule.approved}"`,
          `Used ${matches.length} time${matches.length > 1 ? "s" : ""}. Microsoft / SAP partner guidelines require the approved canonical form.`,
          `Replace every "${bad}" with "${rule.approved}".`,
          "Canonical Solution Dictionary"
        ));
      }
    }
  }

  // ---- Jargon ----
  const foundJargon: string[] = [];
  for (const j of JARGON_PHRASES) {
    const re = new RegExp("\\b" + escapeRegex(j) + "\\b", "gi");
    if (re.test(fullText)) foundJargon.push(j);
  }
  if (foundJargon.length >= 3) {
    issues.push(mk(
      "important",
      `Jargon overload (${foundJargon.length} flagged phrases)`,
      `Found: ${foundJargon.slice(0, 6).join(", ")}${foundJargon.length > 6 ? ", …" : ""}.`,
      "Replace buzzwords with concrete outcomes. Every buzzword is an opportunity to be specific. Example: 'cutting-edge' → 'Microsoft Copilot deployed in 90 days'.",
      "Brand Voice Judge"
    ));
  } else if (foundJargon.length >= 1) {
    issues.push(mk(
      "nice",
      `${foundJargon.length} jargon phrase${foundJargon.length > 1 ? "s" : ""}`,
      `Found: ${foundJargon.join(", ")}.`,
      "Consider replacing with specific language.",
      "Brand Voice Judge"
    ));
  }

  // ---- Marketing speak ----
  const foundMarketingSpeak: string[] = [];
  for (const m of MARKETING_SPEAK) {
    const re = new RegExp("\\b" + escapeRegex(m) + "\\b", "i");
    if (re.test(fullText)) foundMarketingSpeak.push(m);
  }
  if (foundMarketingSpeak.length >= 2) {
    issues.push(mk(
      "important",
      `Marketing-speak detected (${foundMarketingSpeak.length} phrases)`,
      `Found: ${foundMarketingSpeak.slice(0, 5).join(", ")}.`,
      "CXOs are pattern-matchers — words like \"revolutionize\" and \"unparalleled\" trigger their ad-speak filter and hurt credibility. Use concrete claims.",
      "Brand Voice Judge"
    ));
  }

  // ---- Legal name creep ----
  if (/Embee Software Pvt\.?\s*Ltd/i.test(fullText)) {
    issues.push(mk(
      "nice",
      "Legal name used in body copy",
      '"Embee Software Pvt Ltd" appears in content.',
      'Use "Embee Software" in body copy. Reserve legal name for footer/disclaimer.',
      "Corporate Identity"
    ));
  }

  // ---- We/You ratio ----
  const weMatches = (fullText.match(/\b(we|our|us)\b/gi) || []).length;
  const youMatches = (fullText.match(/\b(you|your)\b/gi) || []).length;
  const totalPronouns = weMatches + youMatches;
  if (totalPronouns > 20) {
    const weRatio = weMatches / totalPronouns;
    if (weRatio > 0.65) {
      issues.push(mk(
        "important",
        `Self-referential copy (${Math.round(weRatio * 100)}% we/our, ${Math.round((1 - weRatio) * 100)}% you/your)`,
        `${weMatches} mentions of we/our/us vs ${youMatches} of you/your.`,
        "Shift to customer-centric language. B2B best practice is roughly 60% 'you', 40% 'we'. Make the reader the hero.",
        "Brand Voice Judge"
      ));
    }
  }

  // ---- Partner marks ----
  if (/Microsoft\s+Partner\b(?!\s+of\s+the\s+Year|\s+Network|\s+Solution)/i.test(fullText)) {
    issues.push(mk(
      "important",
      "Outdated partner mark: \"Microsoft Partner\"",
      "The correct mark since 2022 is \"Microsoft Solutions Partner\" followed by the solution area.",
      "Replace with \"Microsoft Solutions Partner\" and (where relevant) the designation (e.g., \"Modern Work\", \"Infrastructure Azure\"). Using the old \"Microsoft Partner\" label violates current Microsoft Partner branding guidelines.",
      "Partner Compliance"
    ));
  }

  // ---- Award attribution ----
  if (/partner\s+of\s+the\s+year/i.test(fullText)) {
    // Check if it's properly attributed with year + region + category
    const hasFullAttribution = /2024|2023|India|South\s+Asia|Modern\s+Work|Fabric/i.test(fullText);
    if (!hasFullAttribution) {
      issues.push(mk(
        "nice",
        "Award claim lacks full attribution",
        "\"Partner of the Year\" mentioned without year, region, and category.",
        "Use the full form: \"Microsoft India & South Asia Partner of the Year 2024 — Modern Work\". Partial claims look weaker than they are.",
        "Partner Compliance"
      ));
    }
  }

  // ---- Reading level & passive voice ----
  const sentences = fullText.match(/[^.!?]+[.!?]+/g) || [];
  let flesch = 0;
  let avgSentLen = 0;
  let passivePct = 0;

  if (sentences.length > 4) {
    avgSentLen = sentences.reduce((a, s) => a + s.trim().split(/\s+/).length, 0) / sentences.length;
    const words = fullText.split(/\s+/).filter(Boolean);
    const syllables = estimateSyllables(words);
    const avgSyllables = syllables / Math.max(words.length, 1);
    // Flesch Reading Ease
    flesch = 206.835 - 1.015 * avgSentLen - 84.6 * avgSyllables;
    flesch = Math.round(flesch);

    const passive = sentences.filter((s) => /\b(is|are|was|were|be|been|being)\s+\w+(ed|en)\b/i.test(s)).length;
    passivePct = Math.round((passive / sentences.length) * 100);

    if (avgSentLen > 25 && assetType !== "pdf") {
      issues.push(mk(
        "important",
        `Sentences too long (avg ${Math.round(avgSentLen)} words)`,
        `${sentences.length} sentences, averaging ${avgSentLen.toFixed(1)} words. CXO audiences prefer 14–22.`,
        "Break long sentences. One idea per sentence. Target 18-word average.",
        "Readability"
      ));
    }

    if (passivePct > 25 && assetType !== "pdf") {
      issues.push(mk(
        "important",
        `High passive voice (${passivePct}%)`,
        `${passive} of ${sentences.length} sentences use passive constructions.`,
        "Rewrite in active voice. \"Embee migrated them to Azure\" beats \"They were migrated to Azure by Embee\".",
        "Readability"
      ));
    }

    if (flesch < 30 && assetType !== "pdf") {
      issues.push(mk(
        "nice",
        `Very difficult reading level (Flesch ${flesch})`,
        `Flesch Reading Ease ${flesch} is college-graduate+ territory.`,
        "Shorten sentences and use simpler words. B2B sweet spot is Flesch 50–70.",
        "Readability"
      ));
    } else if (flesch > 85) {
      issues.push(mk(
        "nice",
        `Unusually simple reading level (Flesch ${flesch})`,
        `Very simple vocabulary — may feel lightweight for CXO audience.`,
        "B2B enterprise content usually runs Flesch 50–65. Very high scores can feel like you're underestimating the reader.",
        "Readability"
      ));
    }
  }

  // ---- Conversion CTA checks moved to conversion.ts analyzer ----

  return { issues, stats: { passivePct, avgSentLen, flesch } };
}

function estimateSyllables(words: string[]): number {
  let total = 0;
  for (const w of words) {
    const clean = w.toLowerCase().replace(/[^a-z]/g, "");
    if (!clean) continue;
    // crude heuristic: count vowel groups
    const groups = clean.match(/[aeiouy]+/g) || [];
    let count = groups.length;
    if (clean.endsWith("e")) count = Math.max(1, count - 1);
    total += Math.max(1, count);
  }
  return total;
}
