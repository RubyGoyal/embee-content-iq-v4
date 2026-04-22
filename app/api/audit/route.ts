import { NextRequest, NextResponse } from "next/server";
import { runAllAnalyzers, computeScore, verdictFor } from "@/lib/engine";
import { normalizeText } from "@/lib/parser";
import { enrichWithAi } from "@/lib/anthropic";
import type { AssetType, AuditReport, Issue, ParsedContent } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface AuditRequest {
  mode: "url" | "text" | "file";
  parsed?: ParsedContent;
  text?: string;
  source: string;
  assetType: AssetType;
  skipAi?: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AuditRequest;
    const { mode, parsed, text, source, assetType } = body;

    let content: ParsedContent;
    let isStructured: boolean;

    if (mode === "url") {
      if (!parsed) {
        return NextResponse.json({ error: "Parsed content required for URL mode" }, { status: 400 });
      }
      content = parsed;
      isStructured = true;
    } else {
      if (!text || text.length < 50) {
        return NextResponse.json(
          { error: "Content too short — paste at least 50 characters" },
          { status: 400 }
        );
      }
      content = normalizeText(text);
      isStructured = false;
    }

    const { issues: ruleIssues, keywords, stats, insights } = runAllAnalyzers({
      content,
      assetType,
      isStructured,
    });

    // AI enrichment
    let aiRewrites: AuditReport["aiRewrites"] | undefined;
    if (!body.skipAi && process.env.ANTHROPIC_API_KEY) {
      try {
        const textForAi = [
          content.title,
          content.metaDescription,
          content.h1.join(" "),
          content.bodyText.slice(0, 5000),
        ]
          .filter(Boolean)
          .join("\n\n");
        const ai = await enrichWithAi(textForAi, assetType, {
          critical: ruleIssues.filter((i) => i.severity === "critical" || i.severity === "blocker").length,
          important: ruleIssues.filter((i) => i.severity === "important").length,
        });
        aiRewrites = {
          headlines: ai.headlines,
          metaDescription: ai.meta_description,
          extraIssues: ai.extra_issues,
        };
      } catch (err) {
        console.warn("AI enrichment failed:", err);
      }
    }

    const allIssues: Issue[] = [...ruleIssues];
    let nextId = ruleIssues.length + 5000;
    if (aiRewrites?.extraIssues) {
      for (const extra of aiRewrites.extraIssues) {
        allIssues.push({
          ...extra,
          id: nextId++,
          rule: "LLM judge",
        });
      }
    }

    // Sort: blockers first, then criticals, etc.
    const sevOrder: Record<string, number> = { blocker: 0, critical: 1, important: 2, nice: 3 };
    allIssues.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);

    const { score, subScores } = computeScore(allIssues);

    const report: AuditReport = {
      source,
      assetType,
      score,
      subScores,
      verdict: verdictFor(score),
      stats,
      issues: allIssues,
      keywords,
      insights,
      aiRewrites,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json({ report });
  } catch (err: any) {
    console.error("Audit error:", err);
    return NextResponse.json(
      { error: err?.message || "Audit failed" },
      { status: 500 }
    );
  }
}
