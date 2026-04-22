import type { ParsedContent, Issue, Severity, AssetType } from "../types";

let id = 0;
const mk = (severity: Severity, title: string, found: string, fix: string, rule: string, category: "Content Quality" | "E-E-A-T" = "Content Quality"): Issue => ({
  id: id++,
  severity,
  category,
  title,
  found,
  fix,
  rule,
});

const targetWordCount: Record<AssetType, { min: number; max: number }> = {
  "solution-page": { min: 800, max: 2500 },
  "landing-page": { min: 400, max: 1200 },
  blog: { min: 1200, max: 4000 },
  email: { min: 80, max: 500 },
  social: { min: 20, max: 300 },
  pdf: { min: 300, max: 10000 },
};

export function analyzeContentQuality(c: ParsedContent, assetType: AssetType): Issue[] {
  id = 3000;
  const issues: Issue[] = [];

  const words = c.bodyText.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const targets = targetWordCount[assetType];

  // ---- Depth & completeness ----
  if (wordCount < targets.min) {
    const severity = wordCount < targets.min * 0.5 ? "critical" : "important";
    issues.push(mk(severity, `Content is thin (${wordCount} words)`, `A ${assetType.replace("-", " ")} should be at least ${targets.min} words. This page has ${wordCount}.`, `Expand the content. Cover what the offering does, who it's for, typical outcomes, how Embee delivers it, and proof. Aim for ${targets.min}–${targets.max} words.`, "Content / Length"));
  } else if (wordCount > targets.max * 1.3) {
    issues.push(mk("nice", `Content is longer than typical (${wordCount} words)`, `A ${assetType.replace("-", " ")} typically runs ${targets.min}–${targets.max} words.`, "Consider splitting into multiple focused pages or adding more structure (H2s, TOC) so readers can scan.", "Content / Length"));
  }

  // First 100 words should sell the value
  const first100 = words.slice(0, 100).join(" ");
  const throatClearers = ["welcome to", "in today's", "in the modern", "as we all know", "more and more", "businesses today", "the world of"];
  const hasThroatClear = throatClearers.some((t) => first100.toLowerCase().includes(t));
  if (hasThroatClear) {
    const match = throatClearers.find((t) => first100.toLowerCase().includes(t));
    issues.push(mk("important", "Opening is a throat-clear, not a value prop", `First 100 words contain: "${match}…"`, "Rewrite the first 100 words to name the outcome and the reader. Example: \"Move SAP to Azure with Embee — India's #1 SAP partner, 500+ engineers, 34+ years.\" State the benefit in sentence one.", "Content / Opening"));
  }

  // Paragraph lengths
  const paragraphs = c.bodyText.split(/\n{2,}|\.\s+(?=[A-Z])/).filter((p) => p.trim().length > 20);
  const longParas = paragraphs.filter((p) => p.split(/\s+/).length > 80);
  if (longParas.length > 0 && assetType !== "email") {
    issues.push(mk("nice", `${longParas.length} wall-of-text paragraph${longParas.length > 1 ? "s" : ""}`, `Some paragraphs are 80+ words — hard to scan on mobile.`, "Break long paragraphs. Target 3–4 sentences per paragraph for B2B readability.", "Content / Paragraphs"));
  }

  // Structure: subheadings every 200-300 words on long content
  if (wordCount > 600 && c.h2.length < Math.floor(wordCount / 400)) {
    issues.push(mk("important", `Not enough subheadings for ${wordCount}-word content`, `Only ${c.h2.length} H2s — CXOs scan, they don't read linearly.`, "Add an H2 every 200–300 words. Use question-format H2s where possible (e.g. \"How does Embee handle SAP-on-Azure migrations?\") — eligible for featured snippets.", "Content / Structure"));
  }

  // FAQ on solution pages
  const faqMarkers = /frequently asked|^faq/im.test(c.bodyText);
  if (assetType === "solution-page" && !faqMarkers && wordCount > 600) {
    issues.push(mk("important", "No FAQ section on solution page", "Solution pages without FAQ miss featured-snippet traffic and GEO citations.", "Add a 5–8 question FAQ block. Target questions like \"How long does X migration take?\", \"What's the cost model?\", \"What results can we expect?\". Wrap in FAQPage schema.", "Content / FAQ"));
  }

  // Freshness signal visible to readers
  if (assetType === "blog" && !c.publishDate && !c.modifiedDate) {
    issues.push(mk("important", "No publish or last-updated date visible", "No article:published_time or visible date found.", "Show publication date prominently. For evergreen content, add a \"Last updated\" stamp. LLMs and Google both prefer fresh-looking content.", "Content / Freshness"));
  }

  // ---- E-E-A-T signals ----
  // Author
  if (assetType === "blog" && !c.authorName) {
    issues.push(mk("important", "No author byline on article content", "No author meta, byline, or rel=author found.", "Add a named author with a link to their bio. Google's E-E-A-T scoring rewards personally-authored content over anonymous corporate posts.", "E-E-A-T / Author", "E-E-A-T"));
  }

  // Proof points presence (company-wide)
  const proofPatterns = [
    { pattern: /\b2500\+?\s*(?:organizations?|enterprises?|customers?|companies)/i, label: "2500+ orgs" },
    { pattern: /\b34\+?\s*years?/i, label: "34+ years" },
    { pattern: /\b1500\+?\s*engagements?/i, label: "1500+ engagements" },
    { pattern: /\b500\+?\s*(?:cloud\s+)?engineers?/i, label: "500+ engineers" },
    { pattern: /Microsoft\s+Solutions?\s+Partner/i, label: "Microsoft Solutions Partner" },
    { pattern: /Partner\s+of\s+the\s+Year/i, label: "Partner of the Year" },
    { pattern: /#1\s+in\s+APAC|rank(?:ed)?\s+#1/i, label: "#1 APAC" },
  ];
  const proofsFound = proofPatterns.filter((p) => p.pattern.test(c.bodyText)).map((p) => p.label);
  if (proofsFound.length === 0 && wordCount > 300) {
    issues.push(mk("important", "No Embee proof points mentioned", `${wordCount}-word piece with no reference to 2500+ orgs, 34+ years, Microsoft Partner of the Year, APAC #1 ranking, etc.`, "Weave in at least 1–2 relevant proof points. Trust cues lift conversion measurably — they also give LLMs something to cite.", "E-E-A-T / Proof points", "E-E-A-T"));
  } else if (proofsFound.length === 1 && wordCount > 600 && assetType === "solution-page") {
    issues.push(mk("nice", "Only one proof point referenced", `Found: ${proofsFound[0]}`, "Layer 2–3 proof points on solution pages (years, customer count, named logos, award). Single data point reads like a brag; layered proof reads like credibility.", "E-E-A-T / Proof points", "E-E-A-T"));
  }

  // Customer / testimonial mentions
  const hasTestimonial =
    /testimonial|case study|success story|customer/i.test(c.bodyText) ||
    /["'""].{40,200}["'""].{0,60}\b(said|says|told|shares?)\b/i.test(c.bodyText);
  if (assetType === "solution-page" && wordCount > 500 && !hasTestimonial) {
    issues.push(mk("important", "No customer testimonial or case study reference", "Solution pages need social proof from real customers.", "Add 1–2 customer quotes with named attribution, or link to a success story. Embee's homepage features Aegon Life, Sun Pharma, JSW, Genpact — pick one relevant to this page's audience.", "E-E-A-T / Social Proof", "E-E-A-T"));
  }

  // Certification badges
  const certMentions = /(Microsoft\s+(Gold|Solutions)\s+Partner|SAP\s+Gold|ISO\s*\d{4,5}|CMMI|SOC\s*2)/i.test(c.bodyText);
  if (assetType === "solution-page" && !certMentions) {
    issues.push(mk("nice", "No certifications referenced", "No mention of Microsoft, SAP, ISO, or other certifications.", "Add relevant certifications near proof points. B2B buyers look for these as de-risking signals.", "E-E-A-T / Certifications", "E-E-A-T"));
  }

  // Specific numbers density (specificity check)
  const numberMatches = c.bodyText.match(/\b\d{1,3}(?:,\d{3})*(?:\.\d+)?%?\b/g) || [];
  if (wordCount > 400 && numberMatches.length < 3) {
    issues.push(mk("nice", "Very few specific numbers in content", `Only ${numberMatches.length} number${numberMatches.length === 1 ? "" : "s"} in ${wordCount} words.`, "B2B content is more persuasive with specifics. Add metrics: \"reduced TCO 30%\", \"deployed in 90 days\", \"2500+ enterprises\". Vague content loses to specific content.", "Content / Specificity"));
  }

  return issues;
}
