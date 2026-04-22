import type { ParsedContent, Issue, Severity, AssetType } from "../types";

let id = 0;
const mk = (severity: Severity, title: string, found: string, fix: string, rule: string): Issue => ({
  id: id++,
  severity,
  category: "GEO",
  title,
  found,
  fix,
  rule,
});

/**
 * GEO = Generative Engine Optimization.
 *
 * Different from traditional SEO — this is about getting content cited by
 * ChatGPT, Perplexity, Claude, Google AI Overviews, Gemini. Signals that
 * matter: extractable direct answers, fact density, clear entity attribution,
 * definitions, structured Q&A, recency markers, original data.
 *
 * LLMs filter out derivative content and prefer content with high
 * "quotability" — short self-contained statements with clear subjects.
 */
export function analyzeGeo(c: ParsedContent, assetType: AssetType, isStructured: boolean): Issue[] {
  id = 8000;
  const issues: Issue[] = [];

  // Skip tiny content
  if (c.bodyText.length < 200) return issues;

  const fullText = c.bodyText;
  const wordCount = fullText.split(/\s+/).filter(Boolean).length;

  // ---- Direct-answer blocks (3) ----
  // LLMs preferentially extract short self-contained paragraphs that answer a question directly.
  // Heuristic: under each question H2, is there a 30-80 word paragraph as the first thing?
  const questionH2s = c.h2.filter((h) => /\?$/.test(h) || /^(what|how|why|when|where|who|which|is|are|can|does|should)\s/i.test(h));

  if (isStructured && questionH2s.length === 0 && c.h2.length >= 3) {
    issues.push(mk(
      "important",
      "No question-format headings for LLM extraction",
      `${c.h2.length} H2s, none are questions.`,
      "Convert 2–3 H2s into questions (\"How long does SAP migration take?\", \"What does Microsoft 365 Copilot cost in India?\"). LLMs extract direct-answer paragraphs under question headings — this is the single biggest GEO lever.",
      "GEO / Direct Answers"
    ));
  }

  // Answer-length heuristic under question H2s
  if (questionH2s.length > 0) {
    let goodAnswerCount = 0;
    for (const q of questionH2s) {
      const idx = fullText.indexOf(q);
      if (idx < 0) continue;
      const after = fullText.slice(idx + q.length, idx + q.length + 800);
      // First paragraph = first chunk until double newline or period + Cap
      const firstPara = after.split(/\n{2,}|(?<=\.)\s+(?=[A-Z])/)[0] || "";
      const words = firstPara.trim().split(/\s+/).filter(Boolean).length;
      if (words >= 25 && words <= 80) goodAnswerCount++;
    }
    if (goodAnswerCount === 0) {
      issues.push(mk(
        "important",
        "Question headings without concise direct-answer paragraphs",
        `${questionH2s.length} question H2s, none followed by a 25–80 word answer paragraph.`,
        "Under each question H2, lead with a 2–4 sentence direct answer (~40–60 words). Then expand with detail below. This is how ChatGPT and Perplexity pull answers for citation.",
        "GEO / Direct Answers"
      ));
    } else if (goodAnswerCount < questionH2s.length / 2) {
      issues.push(mk(
        "nice",
        `Only ${goodAnswerCount} of ${questionH2s.length} question H2s have proper direct-answer paragraphs`,
        "Some question headings are followed by walls of text or short fragments instead of a clean ~50-word answer.",
        "Standardize answer format: 2–4 sentence lead paragraph under every question H2. Expand below if needed.",
        "GEO / Direct Answers"
      ));
    }
  }

  // ---- Fact density & specificity (3) ----
  const numberMatches = fullText.match(/\b\d+(?:[.,]\d+)?%?\b/g) || [];
  const numberDensity = numberMatches.length / (wordCount / 100); // per 100 words
  if (numberDensity < 0.8 && wordCount > 500) {
    issues.push(mk(
      "important",
      `Low fact density: ${numberMatches.length} numbers in ${wordCount} words`,
      `LLMs preferentially cite fact-dense content. Purely qualitative prose gets skipped.`,
      "Add specific numbers: percentages, timeframes, customer counts, dollar figures, dates. Every claim should have a stat or proof near it.",
      "GEO / Fact Density"
    ));
  }

  // Named dates / years signal
  const hasRecentYear = /\b202[4-6]\b/.test(fullText);
  if (!hasRecentYear && wordCount > 400) {
    issues.push(mk(
      "nice",
      "No recent year references",
      "Content doesn't mention 2024, 2025, or 2026.",
      "Reference the current year somewhere in the content (\"As of 2026…\", \"Updated April 2026\"). LLMs prefer fresh-looking content and often filter out stale pages.",
      "GEO / Recency"
    ));
  }

  // Named-entity clarity check — look for vague pronouns
  const vaguePronounRatio = computeVaguePronounRatio(fullText);
  if (vaguePronounRatio > 0.06) {
    issues.push(mk(
      "nice",
      `High vague-pronoun ratio (${(vaguePronounRatio * 100).toFixed(1)}%)`,
      "\"We\", \"our\", \"the platform\", \"the solution\" used frequently without clear named entities.",
      "Replace vague pronouns with named entities. \"We migrate workloads\" → \"Embee Software migrates workloads\"; \"the platform\" → \"Microsoft Azure\". LLMs index named entities — pronouns are invisible to them.",
      "GEO / Entity Clarity"
    ));
  }

  // ---- Definition density (2) ----
  // Pages that define key terms get cited more — they teach LLMs what concepts mean
  const hasDefinitions =
    /\bis\s+a\s+(?:technology|platform|service|solution|framework|approach|system|tool)\b/i.test(fullText) ||
    /\brefers?\s+to\b/i.test(fullText) ||
    /\bmeans?\s+that\b/i.test(fullText) ||
    /\bdefined\s+as\b/i.test(fullText);
  if (!hasDefinitions && (assetType === "blog" || assetType === "solution-page") && wordCount > 600) {
    issues.push(mk(
      "nice",
      "No term definitions in content",
      "Content doesn't define its key concepts (no \"X is a...\", \"refers to\", \"defined as\" patterns).",
      "Add a definition for the primary concept early in the content. \"Microsoft 365 Copilot is an AI assistant that…\" — LLMs cite definition-containing pages when users ask \"what is X\".",
      "GEO / Definitions"
    ));
  }

  // ---- Structured data for LLM extraction (3) ----
  if (isStructured) {
    const hasFaq = c.schemaTypes.includes("FAQPage");
    const hasHowTo = c.schemaTypes.includes("HowTo");
    const hasArticle = c.schemaTypes.includes("Article") || c.schemaTypes.includes("BlogPosting");
    const hasPerson = c.schemaTypes.includes("Person");

    // FAQ schema is the highest-leverage GEO signal
    const faqContentPresent = /frequently asked|^\s*q:|^\s*a:|^\s*question\s*:/im.test(fullText);
    if (faqContentPresent && !hasFaq) {
      issues.push(mk(
        "critical",
        "FAQ content without FAQPage schema (GEO blocker)",
        "Page has Q&A content but no FAQPage schema.",
        "Wrap Q&A in FAQPage schema — this is the single highest-impact GEO markup. LLMs extract structured Q&A preferentially over unstructured text.",
        "GEO / Structured Q&A"
      ));
    }

    // Author schema for E-E-A-T + GEO
    if (assetType === "blog" && !hasPerson) {
      issues.push(mk(
        "important",
        "No Person / Author schema on blog content",
        "Author isn't exposed as structured data.",
        "Add Person schema with jobTitle, worksFor (Embee Software), knowsAbout array. LLMs use this to attribute claims and assess authority. Critical for Google AI Overviews.",
        "GEO / Author Schema"
      ));
    }

    // Blog/article without Article schema
    if (assetType === "blog" && !hasArticle) {
      issues.push(mk(
        "important",
        "No Article / BlogPosting schema",
        "Blog content without Article schema is much harder to attribute.",
        "Add Article schema with headline, author (linked to Person), datePublished, dateModified, publisher (Embee Software Organization), image.",
        "GEO / Article Schema"
      ));
    }
  }

  // ---- Quotable statements (2) ----
  // LLMs cite short declarative sentences well. Walls of nested clauses get skipped.
  const sentences = fullText.match(/[^.!?]+[.!?]+/g) || [];
  const quotableSentences = sentences.filter((s) => {
    const w = s.trim().split(/\s+/).length;
    const hasNumber = /\d/.test(s);
    const notNested = !/,\s+which\s+|,\s+and\s+that\s+/i.test(s);
    return w >= 8 && w <= 20 && hasNumber && notNested;
  });
  if (sentences.length > 20 && quotableSentences.length < sentences.length * 0.08) {
    issues.push(mk(
      "nice",
      "Few quotable short declarative sentences",
      `Only ${quotableSentences.length} of ${sentences.length} sentences are short (8–20 words), contain a number, and are non-nested.`,
      "LLMs preferentially cite short punchy fact-carrying sentences. Example: \"Embee has migrated 400+ SAP workloads to Azure since 2018.\" Sprinkle these throughout — they're quote bait.",
      "GEO / Quotability"
    ));
  }

  // ---- Comparison and contrast content (2) ----
  // LLMs are frequently asked "X vs Y" and "when to use X" — pages answering these get cited
  const hasComparison =
    /\bvs\.?\b|\bversus\b|\bcompared to\b|\bdifference between\b|\bwhen to (?:use|choose)\b/i.test(fullText);
  if (assetType === "blog" && wordCount > 800 && !hasComparison) {
    issues.push(mk(
      "nice",
      "No comparison or \"when to use\" framing",
      "Blog content without comparisons has limited GEO potential.",
      "Add a comparison section where relevant: \"Azure vs AWS for Indian enterprises\", \"When to use M365 Copilot vs ChatGPT Enterprise\", \"SAP Business One vs S/4HANA\". LLMs get asked these questions constantly.",
      "GEO / Comparison Content"
    ));
  }

  // ---- Originality markers (2) ----
  // LLMs filter out regurgitated content. Original data, named case studies, proprietary observations win.
  const originalityMarkers = [
    /\bour\s+(?:analysis|data|research|study|survey|benchmark|observation)/i,
    /\bin\s+our\s+experience/i,
    /\bwe\s+(?:found|measured|tested|analyzed)/i,
    /\bat Embee[,.]?\s+we/i,
    /\bacross\s+\d+\s+(?:engagements?|projects?|deployments?|migrations?|customers?)/i,
  ];
  const hasOriginality = originalityMarkers.some((p) => p.test(fullText));
  if (!hasOriginality && assetType === "blog" && wordCount > 600) {
    issues.push(mk(
      "important",
      "No originality signals (proprietary data or named analysis)",
      "Content reads as generic — no signals of original research, first-hand experience, or proprietary data.",
      "Add lines like \"Across 400+ Embee migrations, we've found X\", \"Our analysis of 2024 client deployments shows Y\", \"In our experience with Indian mid-market SAP customers…\". Original observations are the highest-signal GEO content.",
      "GEO / Originality"
    ));
  }

  // Named-client case references
  const hasNamedCase = /\b(Aegon Life|Sun Pharma|Venus Remedies|Genpact|JSW|Welspun|Hero FinCorp|Fullerton|SBI|Tata|Innova|Oil India)\b/i.test(fullText);
  if (!hasNamedCase && assetType === "blog" && wordCount > 800) {
    issues.push(mk(
      "nice",
      "No named customer references in long-form content",
      "Blog doesn't reference any of Embee's public named customers.",
      "Cite a named customer where the story fits: \"When we migrated Sun Pharma's 18,000 endpoints to a unified security dashboard…\". Named references drastically improve LLM citation — concrete > abstract.",
      "GEO / Named Cases"
    ));
  }

  return issues;
}

/**
 * Compute ratio of vague-pronoun / generic-reference words to total words.
 */
function computeVaguePronounRatio(text: string): number {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  const vaguePatterns = [
    /^(we|our|us)$/i,
    /^(it|its|this|that|these|those)$/i,
    /^(the\s+platform|the\s+solution|the\s+service|the\s+product)$/i,
  ];
  // Single-word matches
  const singleWordHits = words.filter((w) => vaguePatterns.some((p) => p.test(w.replace(/[^a-zA-Z]/g, "")))).length;
  // Bigram matches
  const text2 = text.toLowerCase();
  const bigramHits =
    (text2.match(/\bthe\s+(?:platform|solution|service|product|tool|system)\b/g) || []).length;
  const total = singleWordHits + bigramHits;
  return total / words.length;
}
