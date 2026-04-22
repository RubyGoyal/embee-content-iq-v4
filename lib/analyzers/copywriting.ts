import type { ParsedContent, Issue, Severity, AssetType } from "../types";
import { SOLUTION_DICT } from "../dictionary";

let id = 0;
const mk = (severity: Severity, title: string, found: string, fix: string, rule: string): Issue => ({
  id: id++,
  severity,
  category: "Copywriting",
  title,
  found,
  fix,
  rule,
});

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Guess the primary keyword from title or H1.
 * The primary keyword is usually the first 2-5 words before "—" or "|" in the title,
 * or the first solution-dictionary term that appears in the H1.
 */
function inferPrimaryKeyword(c: ParsedContent): string {
  // First, check if an approved solution name appears in H1 → that's likely the primary
  const h1Text = c.h1.join(" ");
  const titleText = c.title;
  for (const rule of SOLUTION_DICT) {
    const re = new RegExp("\\b" + escapeRegex(rule.approved) + "\\b", "i");
    if (re.test(h1Text) || re.test(titleText)) return rule.approved;
  }
  // Fallback: use first meaningful segment of title
  const firstSeg = c.title.split(/[|–—\-·]/)[0]?.trim() || "";
  return firstSeg.split(/\s+/).slice(0, 4).join(" ");
}

/**
 * Classify search intent from content signals.
 * informational: explainer content, "how to", "what is"
 * commercial: comparison content, "best", "vs", "review"
 * transactional: pricing, demo, buy, get started
 * navigational: brand-specific entry point
 */
function classifyIntent(c: ParsedContent, assetType: AssetType): {
  detected: "informational" | "commercial" | "transactional" | "navigational" | "mixed";
  expected: "informational" | "commercial" | "transactional" | "navigational";
} {
  const text = (c.title + " " + c.h1.join(" ") + " " + c.bodyText.slice(0, 2000)).toLowerCase();
  const informational = /\b(how to|what is|guide|tutorial|explained|introduction|overview|understanding|learn)\b/.test(text);
  const commercial = /\b(best|top \d+|vs\b|versus|compare|comparison|review|alternatives?|which is better)\b/.test(text);
  const transactional = /\b(buy|pricing|cost|price|demo|free trial|get started|schedule|book|request|quote|sign up)\b/.test(text);

  let detected: "informational" | "commercial" | "transactional" | "navigational" | "mixed" = "mixed";
  const hits = [informational, commercial, transactional].filter(Boolean).length;
  if (hits === 0) detected = "navigational";
  else if (informational && !commercial && !transactional) detected = "informational";
  else if (commercial && !transactional) detected = "commercial";
  else if (transactional) detected = "transactional";

  let expected: "informational" | "commercial" | "transactional" | "navigational";
  switch (assetType) {
    case "blog":
      expected = "informational";
      break;
    case "solution-page":
    case "landing-page":
      expected = "transactional";
      break;
    case "email":
      expected = "transactional";
      break;
    default:
      expected = "informational";
  }

  return { detected, expected };
}

export function analyzeCopywriting(
  c: ParsedContent,
  assetType: AssetType,
  isStructured: boolean
): { issues: Issue[]; insights: { searchIntent?: string; intentMatch?: "matched" | "partial" | "mismatch"; primaryKeyword?: string } } {
  id = 5000;
  const issues: Issue[] = [];

  const primaryKeyword = inferPrimaryKeyword(c);
  const intent = classifyIntent(c, assetType);

  // ---- Keyword placement (8) ----
  if (primaryKeyword && isStructured) {
    const escapedKw = escapeRegex(primaryKeyword);
    const kwRe = new RegExp("\\b" + escapedKw + "\\b", "i");
    const inTitle = kwRe.test(c.title);
    const inH1 = kwRe.test(c.h1.join(" "));
    const inUrl = c.url ? new RegExp(escapedKw.toLowerCase().replace(/\s+/g, "[-_ ]?"), "i").test(c.url.toLowerCase()) : false;
    const first100 = c.bodyText.split(/\s+/).slice(0, 100).join(" ");
    const inFirst100 = kwRe.test(first100);
    const inAnyH2 = c.h2.some((h) => kwRe.test(h));
    const inMeta = kwRe.test(c.metaDescription);
    const inAlt = c.images.some((img) => img.alt && kwRe.test(img.alt));

    const placements = [
      { label: "title", ok: inTitle, critical: true },
      { label: "H1", ok: inH1, critical: true },
      { label: "URL", ok: inUrl, critical: false },
      { label: "first 100 words", ok: inFirst100, critical: true },
      { label: "at least one H2", ok: inAnyH2, critical: false },
      { label: "meta description", ok: inMeta, critical: true },
      { label: "image alt text", ok: inAlt, critical: false },
    ];

    const missingCritical = placements.filter((p) => !p.ok && p.critical);
    const missingAny = placements.filter((p) => !p.ok);

    if (missingCritical.length >= 3) {
      issues.push(mk(
        "critical",
        `Primary keyword "${primaryKeyword}" missing from critical positions`,
        `Not in: ${missingCritical.map((p) => p.label).join(", ")}.`,
        `Place "${primaryKeyword}" in the title, H1, first 100 words, and meta description — these are the highest-weight positions for ranking.`,
        "Keyword Placement"
      ));
    } else if (missingAny.length >= 3) {
      issues.push(mk(
        "important",
        `Primary keyword "${primaryKeyword}" could be more prominent`,
        `Missing from: ${missingAny.map((p) => p.label).join(", ")}.`,
        "Naturally work the primary keyword into the missing positions. Avoid stuffing — once per position is enough.",
        "Keyword Placement"
      ));
    }

    // Keyword density check
    const occurrences = (c.bodyText.match(new RegExp(escapedKw, "gi")) || []).length;
    const wordCount = c.bodyText.split(/\s+/).filter(Boolean).length;
    const density = wordCount > 0 ? (occurrences / wordCount) * 100 : 0;

    if (density > 3.5 && wordCount > 300) {
      issues.push(mk(
        "important",
        `Keyword stuffing: "${primaryKeyword}" density is ${density.toFixed(1)}%`,
        `Used ${occurrences} times in ${wordCount} words.`,
        "Reduce to 0.5–2.5% density. Over-optimization is a negative ranking signal and reads as spam to humans.",
        "Keyword Density"
      ));
    } else if (density === 0 && wordCount > 200 && (inTitle || inH1)) {
      issues.push(mk(
        "important",
        `Primary keyword "${primaryKeyword}" in title/H1 but not in body`,
        "Title/H1 signals relevance but body doesn't reinforce it.",
        "Mention the primary keyword naturally 2–4 times in the body, starting in the first 100 words.",
        "Keyword Density"
      ));
    }
  }

  // ---- Search intent match (4) ----
  if (intent.detected !== "mixed" && intent.detected !== intent.expected) {
    const severityMap: Record<string, Severity> = {
      "blog:transactional": "nice",
      "solution-page:informational": "important",
      "solution-page:commercial": "nice",
      "landing-page:informational": "important",
    };
    const severityKey = `${assetType}:${intent.detected}`;
    const sev: Severity = severityMap[severityKey] || "important";
    issues.push(mk(
      sev,
      `Intent mismatch: ${assetType.replace("-", " ")} reads as ${intent.detected}`,
      `Content signals ${intent.detected} intent but a ${assetType.replace("-", " ")} should target ${intent.expected} intent.`,
      intent.expected === "transactional"
        ? "Add clear offering statements, pricing or engagement-model signals, and a primary CTA above the fold. Make it obvious this is something someone can buy or book."
        : intent.expected === "informational"
        ? "Shift to explanation mode — less selling, more teaching. Add definitions, how-to sections, and FAQ-style Q&A."
        : "Realign content format with the target intent.",
      "Search Intent"
    ));
  }

  // ---- Featured snippet optimization (3) ----
  // Check for question-format headings
  const questionHeadings = c.h2.filter((h) => /^(what|how|why|when|where|who|which|can|does|is|are|should)\s/i.test(h) || /\?$/.test(h));
  if (questionHeadings.length === 0 && c.h2.length >= 3 && (assetType === "blog" || assetType === "solution-page")) {
    issues.push(mk(
      "nice",
      "No question-format H2s",
      `${c.h2.length} H2s on page, none are questions.`,
      "Reframe 2–3 H2s as questions your audience actually asks (\"How long does an Azure migration take?\", \"What does Microsoft 365 Copilot cost in India?\"). Question-H2s win featured snippets and People Also Ask boxes.",
      "Featured Snippet"
    ));
  }

  // Direct-answer paragraph check — under a question H2, is there a concise 40-60 word answer?
  if (questionHeadings.length > 0) {
    // Heuristic: look at first paragraph after each question heading in headingSequence order
    let foundDirectAnswer = false;
    for (const h of c.headingSequence) {
      if (h.level === 2 && (/\?$/.test(h.text) || /^(what|how|why)\s/i.test(h.text))) {
        // Find the paragraph following this heading — proxy via bodyText
        const idx = c.bodyText.indexOf(h.text);
        if (idx >= 0) {
          const after = c.bodyText.slice(idx + h.text.length, idx + h.text.length + 500);
          const firstPara = after.split(/\n{2,}|[.!?]\s+(?=[A-Z])/)[0] || "";
          const wordsInPara = firstPara.trim().split(/\s+/).length;
          if (wordsInPara >= 20 && wordsInPara <= 70) {
            foundDirectAnswer = true;
            break;
          }
        }
      }
    }
    if (!foundDirectAnswer) {
      issues.push(mk(
        "nice",
        "Question H2s without concise direct-answer paragraphs",
        "Featured-snippet winners put a 40–60 word direct answer immediately under a question heading.",
        "For each question H2, lead with a single 2–3 sentence paragraph that answers it directly. Then expand below.",
        "Featured Snippet"
      ));
    }
  }

  // ---- Copy quality: hook strength (4) ----
  if (c.bodyText.length > 100) {
    const words = c.bodyText.split(/\s+/).filter(Boolean);
    const firstSentence = c.bodyText.match(/^[^.!?]+[.!?]/)?.[0] || words.slice(0, 25).join(" ");

    // Weak hooks: generic openers
    const weakHooks = [
      /^(welcome to|in today's|in the modern|as we all know|more and more)/i,
      /^(businesses today|companies today|organizations today)/i,
      /^(the world of|the landscape of|the future of)/i,
      /^(are you looking for|do you need|have you ever)/i,
    ];
    if (weakHooks.some((re) => re.test(firstSentence.trim()))) {
      issues.push(mk(
        "important",
        "Weak opening hook",
        `First sentence: "${firstSentence.slice(0, 120)}..."`,
        "Rewrite with a specific claim or number. Example: \"Embee has migrated 400+ SAP workloads to Azure in the last 18 months — here's what we've learned.\" Concrete > abstract.",
        "Copy / Hook"
      ));
    }

    // First-sentence length
    const firstSentenceWords = firstSentence.trim().split(/\s+/).length;
    if (firstSentenceWords > 30) {
      issues.push(mk(
        "nice",
        `Long opening sentence (${firstSentenceWords} words)`,
        `First sentence is ${firstSentenceWords} words.`,
        "Open with a short, punchy sentence (under 15 words). Long opens lose readers.",
        "Copy / Hook"
      ));
    }
  }

  // Benefit-oriented language vs feature dump
  const featureWords = (c.bodyText.match(/\b(we offer|our services?|we provide|our solution|features? include|includes?|capabilit(?:y|ies))\b/gi) || []).length;
  const benefitWords = (c.bodyText.match(/\b(reduce|save|cut|grow|accelerate|boost|improve|eliminate|avoid|prevent|increase|deliver|faster|cheaper|safer|simpler)\b/gi) || []).length;
  if (featureWords > 5 && benefitWords < featureWords * 0.5) {
    issues.push(mk(
      "important",
      "Feature-dump language dominates over benefits",
      `${featureWords} feature phrases vs ${benefitWords} benefit phrases.`,
      "For every feature mention, pair it with the outcome. \"Azure DevOps with automated CI/CD\" → \"Azure DevOps cuts release cycles from 2 weeks to 2 days.\"",
      "Copy / Benefits"
    ));
  }

  // ---- Wall-of-text / scannability (2) ----
  const paragraphs = c.bodyText.split(/\n{2,}/).filter((p) => p.trim().length > 40);
  const longParas = paragraphs.filter((p) => p.split(/\s+/).length > 100);
  if (longParas.length > 2) {
    issues.push(mk(
      "important",
      `${longParas.length} walls of text (100+ word paragraphs)`,
      "On mobile these render as huge unbroken blocks. CXOs scan first, read later.",
      "Break long paragraphs. Bold key claims. Convert lists-in-prose into actual bulleted lists.",
      "Copy / Scannability"
    ));
  }

  // Lists vs prose
  const listMatches = (c.bodyText.match(/(?:^|\n)\s*(?:[-*•]|\d+\.)\s+/g) || []).length;
  if (c.bodyText.length > 2000 && listMatches < 3) {
    issues.push(mk(
      "nice",
      "Long content with almost no lists",
      `${c.bodyText.length}-char piece with fewer than 3 list items.`,
      "Add bulleted lists for capabilities, outcomes, requirements, FAQs. Lists get 2-3x the engagement of equivalent prose on B2B content.",
      "Copy / Scannability"
    ));
  }

  return {
    issues,
    insights: {
      searchIntent: intent.detected,
      intentMatch: intent.detected === intent.expected ? "matched" : intent.detected === "mixed" ? "partial" : "mismatch",
      primaryKeyword,
    },
  };
}
