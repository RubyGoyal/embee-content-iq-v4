import type { ParsedContent, Issue, Severity, AssetType } from "../types";

let id = 0;
const mk = (severity: Severity, title: string, found: string, fix: string, rule: string): Issue => ({
  id: id++,
  severity,
  category: "Conversion",
  title,
  found,
  fix,
  rule,
});

const ACTION_VERBS = [
  "get", "book", "schedule", "start", "try", "download", "join", "watch",
  "register", "request", "see", "explore", "find", "discover", "take",
  "claim", "reserve", "save", "unlock",
];

const GENERIC_CTA = [
  "learn more", "read more", "click here", "know more", "more",
  "find out", "more info", "submit", "go", "continue", "next",
];

/**
 * Embee's homepage uses strong outcome-led CTAs — we treat these as the gold standard.
 */
const EMBEE_GOLD_CTAS = [
  "Schedule a Free Consultation Call",
  "Book a 1:1 Consultation",
  "Get a free Azure cloud assessment worth US$3,000",
  "Book a Free Demo",
  "Free assessment: Azure Cloud Managed Services",
];

export function analyzeConversion(c: ParsedContent, assetType: AssetType, isStructured: boolean): Issue[] {
  id = 7000;
  const issues: Issue[] = [];

  const fullText = c.bodyText + " " + c.title + " " + c.h1.join(" ") + " " + c.h2.join(" ");

  // ---- CTA strength & count (6) ----
  if (isStructured && c.ctaButtons.length > 0) {
    // Action-verb check
    const actionVerbCtas = c.ctaButtons.filter((cta) => {
      const firstWord = cta.trim().split(/\s+/)[0]?.toLowerCase() || "";
      return ACTION_VERBS.includes(firstWord);
    });
    const ratio = actionVerbCtas.length / c.ctaButtons.length;
    if (ratio < 0.3 && c.ctaButtons.length >= 3) {
      issues.push(mk(
        "important",
        "CTAs don't start with action verbs",
        `Only ${actionVerbCtas.length} of ${c.ctaButtons.length} CTAs begin with a verb.`,
        "Start CTAs with action verbs — Get, Book, Schedule, Start, Download. Verbs trigger decision-making. \"Book a Free Demo\" beats \"Free Demo\" by 20–40% click-through in most tests.",
        "CTA / Action Verbs"
      ));
    }

    // Short, meaningless CTAs
    const shortCtas = c.ctaButtons.filter((cta) => cta.trim().length < 5 && cta.trim().length > 0);
    if (shortCtas.length > 0) {
      issues.push(mk(
        "nice",
        `${shortCtas.length} very short CTA${shortCtas.length > 1 ? "s" : ""}`,
        `Examples: ${shortCtas.slice(0, 3).map((c) => `"${c}"`).join(", ")}`,
        "CTAs under 5 characters rarely convert. Expand to describe the outcome.",
        "CTA / Copy"
      ));
    }

    // Quantified CTAs — a bonus, flag absence for conversion-critical pages
    const hasQuantifiedCta = c.ctaButtons.some((cta) =>
      /\$[\d,]+|₹[\d,]+|worth|free|\d+\s*(day|week|month|min|hour)/i.test(cta)
    );
    if (!hasQuantifiedCta && (assetType === "solution-page" || assetType === "landing-page")) {
      issues.push(mk(
        "nice",
        "No quantified/risk-reversal CTAs",
        "No CTA mentions specific value, free offer, or time commitment.",
        "Add a quantified CTA. Embee homepage uses \"Free assessment worth US$3,000\" — specifics dramatically outperform generic \"Book a Call\".",
        "CTA / Copy"
      ));
    }

    // Competing CTAs
    if (c.ctaButtons.length > 10 && assetType === "solution-page") {
      issues.push(mk(
        "important",
        `Too many CTAs (${c.ctaButtons.length})`,
        "Decision paralysis: when a page has many competing CTAs, none of them convert well.",
        "Identify ONE primary CTA and repeat it 2–3 times down the page. Demote everything else to secondary or tertiary actions.",
        "CTA / Count"
      ));
    }

    // Inconsistent CTA labeling — if multiple CTAs that should be the same
    const ctaLower = c.ctaButtons.map((c) => c.toLowerCase());
    const hasDemo = ctaLower.some((c) => c.includes("demo"));
    const hasBookCall = ctaLower.some((c) => /book|schedule.*call/i.test(c));
    const hasTryFree = ctaLower.some((c) => /try|free trial/i.test(c));
    const hasAssessment = ctaLower.some((c) => c.includes("assessment"));
    const primaryCtaTypes = [hasDemo, hasBookCall, hasTryFree, hasAssessment].filter(Boolean).length;
    if (primaryCtaTypes >= 3) {
      issues.push(mk(
        "nice",
        "Mixed primary CTA types compete for attention",
        "Page offers demo + book call + free trial + assessment — all as primary actions.",
        "Pick one primary conversion path for this page's buyer stage. Top-of-funnel = assessment; mid-funnel = demo; bottom-funnel = consultation call.",
        "CTA / Hierarchy"
      ));
    }
  }

  // ---- Trust & social proof (6) ----
  // Testimonial presence
  const quotedText = (c.bodyText.match(/["'""]([^"'""]{40,300})["'""]/g) || []).length;
  const hasTestimonial = quotedText > 0 || /(case study|success story|testimonial)/i.test(fullText);
  if (!hasTestimonial && (assetType === "solution-page" || assetType === "landing-page") && c.bodyText.length > 500) {
    issues.push(mk(
      "important",
      "No testimonials or customer quotes",
      "Page has no customer voice at all.",
      "Add 1–2 attributed customer quotes. Embee's homepage features strong quotes from Satnam Singh (Innova), Gianni Giacomelli (Genpact), Aditya Sharda (Venus Remedies). Named-customer proof converts better than abstract claims.",
      "Trust / Testimonial"
    ));
  }

  // Named customer mentions — pattern: logos often appear as named mentions in body
  const customerMentions = (c.bodyText.match(/\b(Aegon Life|Sun Pharma|Venus Remedies|Genpact|JSW|Innova|Fullerton|SBI|Tata|Welspun|Oil India|Hero FinCorp|Indigo|FCB Ulka|GEP|Corbus)\b/g) || []).length;
  if (customerMentions === 0 && (assetType === "solution-page" || assetType === "landing-page")) {
    issues.push(mk(
      "nice",
      "No named customer logos or references",
      "Solution page doesn't name any of Embee's 2500+ customers.",
      "Reference 2–3 relevant named customers (or link to their case studies). Embee's most-visible proof-logos: JSW, SBI, Tata, Aegon Life, Sun Pharma, Genpact, Welspun, Indigo.",
      "Trust / Named Customers"
    ));
  }

  // Specific metrics in quotes (vs vague praise)
  if (quotedText > 0) {
    const quotesContent = c.bodyText.match(/["'""]([^"'""]{40,300})["'""]/g) || [];
    const vagueQuotes = quotesContent.filter((q) => {
      const hasNumber = /\d+%|\d+x|\d+\s*(times|fold|hours|days|months|years)/i.test(q);
      return !hasNumber && /(great|excellent|amazing|fantastic|wonderful|pleasure|highly recommend)/i.test(q);
    });
    if (vagueQuotes.length >= quotesContent.length * 0.6 && quotesContent.length >= 2) {
      issues.push(mk(
        "nice",
        "Testimonials use vague praise without specifics",
        "Customer quotes say \"great partner\" / \"excellent service\" without measurable outcomes.",
        "Swap for metric-backed quotes: \"cut our migration time by 40%\" > \"great migration partner\". Ask customers for specific outcomes when collecting testimonials.",
        "Trust / Specificity"
      ));
    }
  }

  // Contact options
  const hasPhoneNumber = /\+?\d{1,3}[-.\s]?\(?\d{3,5}\)?[-.\s]?\d{3,6}[-.\s]?\d{3,6}/.test(fullText);
  const hasEmail = /[\w.+-]+@[\w-]+\.[\w.-]+/.test(fullText);
  if (!hasPhoneNumber && !hasEmail && (assetType === "solution-page" || assetType === "landing-page")) {
    issues.push(mk(
      "important",
      "No visible contact options",
      "Neither phone nor email visible on-page.",
      "Show contact methods on every conversion-critical page. Indian B2B buyers especially expect a phone number (Embee's is +91 8447877367).",
      "Trust / Contact"
    ));
  }

  // Geographic/locational signals — Indian address/HQ trust signal
  const hasIndianContext = /\b(india|indian|bengaluru|bangalore|mumbai|delhi|kolkata|chennai|pune|hyderabad|gurgaon|noida)\b/i.test(fullText);
  if (!hasIndianContext && (assetType === "solution-page" || assetType === "landing-page") && c.bodyText.length > 500) {
    issues.push(mk(
      "nice",
      "No Indian geography signals",
      "Page doesn't mention India or any Indian city.",
      "Embee's moat is Indian-enterprise expertise. Reference it: \"serving 2500+ Indian enterprises\", \"locally delivered from Kolkata/Bengaluru\", \"aligned with Indian compliance\". Localization signals also help geo-targeted SEO.",
      "Trust / Geo"
    ));
  }

  // Currency localization — where prices/offers appear
  const hasPriceRef = /\b(\$|₹|usd|inr|rupees?|dollars?|pricing|cost|price)\b/i.test(fullText);
  const hasInr = /₹|\bINR\b|\brupees?\b/i.test(fullText);
  const hasUsd = /\$\d|\bUSD\b|US\$/i.test(fullText);
  if (hasPriceRef && hasUsd && !hasInr && (assetType === "solution-page" || assetType === "landing-page")) {
    issues.push(mk(
      "nice",
      "Pricing referenced only in USD, no INR",
      "Page mentions $ or USD without equivalent INR amounts.",
      "Indian B2B buyers prefer INR pricing. If you must use USD (e.g., for assessment offers), show the INR equivalent.",
      "Trust / Currency"
    ));
  }

  // ---- Risk reversal (3) ----
  const riskReversalPhrases = /\b(free trial|free assessment|no credit card|money back|guarantee|risk[-\s]?free|cancel anytime|no commitment|no obligation|30[-\s]?day free)\b/i;
  if (!riskReversalPhrases.test(fullText) && (assetType === "landing-page" || assetType === "solution-page") && c.bodyText.length > 600) {
    issues.push(mk(
      "nice",
      "No risk-reversal language",
      "Page doesn't mention free assessments, guarantees, or no-commitment offers.",
      "Add risk-reversal where appropriate. Embee already uses \"Free assessment for Azure Cloud worth US$3,000\", \"Free ERP POC\", \"Book a Free Demo\" on the homepage. Reduces friction to conversion meaningfully.",
      "Conversion / Risk"
    ));
  }

  // Urgency/scarcity — should exist on time-sensitive campaigns, but shouldn't feel fake
  const fakeUrgency = /\b(limited time|act now|hurry|don't miss|last chance|only \d+ left|ends (today|tonight|soon))\b/i.test(fullText);
  if (fakeUrgency && assetType === "solution-page") {
    issues.push(mk(
      "nice",
      "Fake urgency language on evergreen page",
      "Phrases like \"limited time\" or \"act now\" on a non-campaign page.",
      "Remove fake urgency from evergreen solution pages. CXO audiences recognize and distrust it. Reserve for genuinely time-bound campaigns.",
      "Conversion / Trust"
    ));
  }

  // ---- Above-fold CTA heuristic (1) ----
  // We can't see the actual render, but can check: is a CTA referenced in the hero (within first ~200 chars of bodyText)?
  if (isStructured && c.ctaButtons.length > 0 && (assetType === "solution-page" || assetType === "landing-page")) {
    const first200 = c.bodyText.slice(0, 500).toLowerCase();
    const ctaInHero = c.ctaButtons.some((cta) => first200.includes(cta.toLowerCase().slice(0, 20)));
    if (!ctaInHero && c.bodyText.length > 1000) {
      issues.push(mk(
        "important",
        "Primary CTA may not be above the fold",
        "No CTA text appears in the first ~500 chars of body content.",
        "Place the primary CTA in the hero section, visible without scrolling. Every scroll before a CTA = conversion drop.",
        "CTA / Position"
      ));
    }
  }

  return issues;
}
