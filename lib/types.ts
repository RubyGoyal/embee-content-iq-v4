export type Severity = "blocker" | "critical" | "important" | "nice";
export type Category =
  | "On-page SEO"
  | "Technical SEO"
  | "Content Quality"
  | "E-E-A-T"
  | "Copywriting"
  | "Internal Linking"
  | "Conversion"
  | "GEO"
  | "Brand"
  | "Structure";
export type AssetType = "solution-page" | "landing-page" | "blog" | "email" | "social" | "pdf";

export interface Issue {
  id: number;
  severity: Severity;
  category: Category;
  title: string;
  found: string;
  fix: string;
  rule: string;
}

export interface ParsedImage {
  src: string;
  alt: string | null; // null means missing alt attribute entirely
  hasDimensions: boolean;
  isLazy: boolean;
  filename: string;
}

export interface ParsedLink {
  href: string;
  anchor: string;
  isInternal: boolean;
  rel: string;
  target: string;
}

export interface ParsedContent {
  title: string;
  metaDescription: string;
  canonical: string;
  robotsMeta: string;
  lang: string;
  charset: string;
  viewport: string;
  favicon: boolean;

  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  ogType: string;
  ogUrl: string;
  twitterCard: string;
  twitterTitle: string;
  twitterImage: string;

  h1: string[];
  h2: string[];
  h3: string[];
  headingSequence: Array<{ level: number; text: string }>;

  bodyText: string;
  htmlLength: number;
  textLength: number;
  hasMainLandmark: boolean;
  hasArticleLandmark: boolean;

  links: ParsedLink[];
  images: ParsedImage[];
  ctaButtons: string[];

  schemas: any[];
  schemaTypes: string[];
  hasBreadcrumbs: boolean;

  scriptCount: number;
  externalScriptDomains: string[];
  renderBlockingInHead: number;
  hasPreloadedHero: boolean;

  publishDate: string;
  modifiedDate: string;
  authorName: string;

  finalUrl: string;
  url: string;
  httpsOk: boolean;

  hiddenTextSuspect: boolean;
  hasSkipLink: boolean;
}

export interface KeywordCoverage {
  kw: string;
  inTitle: boolean;
  inH1: boolean;
  inUrl: boolean;
  inFirst100: boolean;
  inH2: boolean;
  inAlt: boolean;
  inMeta: boolean;
  density: string;
  status: "good" | "weak" | "miss";
}

export interface SubScores {
  onPageSeo: number;
  technical: number;
  contentQuality: number;
  eeat: number;
  copywriting: number;
  internalLinking: number;
  geo: number;
  brand: number;
  conversion: number;
}

export interface AuditReport {
  source: string;
  assetType: AssetType;
  score: number;
  subScores: SubScores;
  verdict: "Publish-ready" | "Minor fixes" | "Significant rework" | "Do not publish";
  stats: {
    words: number;
    sentences: number;
    paragraphs: number;
    images: number;
    internalLinks: number;
    externalLinks: number;
  };
  issues: Issue[];
  keywords: KeywordCoverage[];
  insights: {
    searchIntent?: string;
    intentMatch?: "matched" | "partial" | "mismatch";
    flesch?: number;
    gradeLevel?: string;
    contentHtmlRatio?: number;
    passiveVoicePct?: number;
  };
  aiRewrites?: {
    headlines: string[];
    metaDescription: string;
    extraIssues: Array<{
      severity: Severity;
      category: Category;
      title: string;
      found: string;
      fix: string;
    }>;
  };
  generatedAt: string;
}

export interface BulkAuditItem {
  url: string;
  status: "pending" | "running" | "done" | "failed";
  score?: number;
  verdict?: string;
  issueCounts?: { blocker: number; critical: number; important: number; nice: number };
  topIssues?: string[]; // short labels
  error?: string;
  durationMs?: number;
}

export interface BulkAuditReport {
  startedAt: string;
  totalUrls: number;
  completed: number;
  failed: number;
  items: BulkAuditItem[];
  summary?: {
    avgScore: number;
    distribution: { publishReady: number; minorFixes: number; significantRework: number; doNotPublish: number };
    topRecurringIssues: Array<{ title: string; count: number; category: string }>;
    worstPages: Array<{ url: string; score: number }>;
    bestPages: Array<{ url: string; score: number }>;
  };
}

export interface CompetitorComparison {
  target: {
    url: string;
    score: number;
    wordCount: number;
    schemaTypes: string[];
    h1: string;
    metaDescription: string;
  };
  competitors: Array<{
    url: string;
    ok: boolean;
    wordCount?: number;
    schemaTypes?: string[];
    h1?: string;
    metaDescription?: string;
    error?: string;
  }>;
  gaps: Array<{
    dimension: string;
    finding: string;
    recommendation: string;
  }>;
}
