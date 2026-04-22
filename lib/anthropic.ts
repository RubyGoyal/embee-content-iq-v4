import Anthropic from "@anthropic-ai/sdk";
import type { AssetType, Severity, Category } from "./types";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface AiEnrichment {
  extra_issues: Array<{
    severity: Severity;
    category: Category;
    title: string;
    found: string;
    fix: string;
  }>;
  headlines: string[];
  meta_description: string;
}

const SYSTEM_PROMPT = `You are EmbeeContentIQ, a B2B content auditor for Embee Software — an Indian IT consulting firm, Microsoft Solutions Partner and SAP Partner with 2500+ customers and 34+ years in business. Embee sells Azure, Microsoft 365, Microsoft 365 Copilot, SAP S/4HANA, SAP Business One, Cybersecurity (Zero Trust, SIEM/SOAR), Octane HRMS, ARth, and EmSupport.

The audience is CXOs and IT leaders in India. Brand voice is confident, outcome-led, specific, and jargon-controlled. Avoid buzzwords like "best-in-class", "cutting-edge", "leverage", "synergy", "turnkey".

You respond only with valid JSON — no preamble, no markdown fences, no commentary.`;

const ASSET_GUIDANCE: Record<AssetType, string> = {
  "solution-page": "A solution page sells one offering to a considered B2B buyer. Headline should name the outcome + the partner. Meta must convert from search.",
  "landing-page": "A landing page is conversion-focused with a single CTA. Headline must match the source ad's promise.",
  blog: "A blog post establishes authority. Headline should promise a specific insight, not a generic category label.",
  email: "Email headlines are subject lines — under 60 chars, specific, no jargon. Avoid clickbait.",
  social: "Social posts are conversational. Headlines should hook with a number, a claim, or a question.",
  pdf: "PDF collateral is usually a datasheet or whitepaper. Headline should state the document's function clearly.",
};

export async function enrichWithAi(
  contentText: string,
  assetType: AssetType,
  ruleIssuesCount: { critical: number; important: number }
): Promise<AiEnrichment> {
  const userPrompt = `Asset type: ${assetType}
Guidance: ${ASSET_GUIDANCE[assetType]}

Content to audit (truncated to first 6000 chars):
"""
${contentText.slice(0, 6000)}
"""

The deterministic rule engine already detected ${ruleIssuesCount.critical} critical and ${ruleIssuesCount.important} important issues. Don't repeat those.

Return this JSON shape:
{
  "extra_issues": [
    { "severity": "blocker|critical|important|nice", "category": "On-page SEO|Technical SEO|Content Quality|E-E-A-T|Brand|Conversion", "title": "short label", "found": "specific evidence quoted from the content", "fix": "concrete rewrite or action" }
  ],
  "headlines": [ "3 alternate headline/subject-line rewrites, under 14 words, CXO-targeted, no buzzwords" ],
  "meta_description": "one rewritten meta description, 140-160 chars, with primary keyword, a proof point, and a CTA cue"
}

Up to 3 extra_issues. Exactly 3 headlines. JSON only.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlocks = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const cleaned = textBlocks
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON in AI response");
  const parsed = JSON.parse(match[0]) as AiEnrichment;

  // Validate shape
  if (!Array.isArray(parsed.headlines)) parsed.headlines = [];
  if (!Array.isArray(parsed.extra_issues)) parsed.extra_issues = [];
  if (typeof parsed.meta_description !== "string") parsed.meta_description = "";

  return parsed;
}
