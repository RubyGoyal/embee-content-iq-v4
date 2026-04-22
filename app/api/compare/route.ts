import { NextRequest, NextResponse } from "next/server";
import { parseHTML } from "@/lib/parser";
import { runAllAnalyzers, computeScore } from "@/lib/engine";
import type { AssetType, CompetitorComparison } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const USER_AGENT =
  "Mozilla/5.0 (compatible; EmbeeContentIQ/3.0; +https://embee.co.in)";

interface CompRequest {
  targetUrl: string;
  competitorUrls: string[];
  assetType?: AssetType;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CompRequest;
    const target = body.targetUrl?.trim();
    const competitors = (body.competitorUrls || []).map((c) => c.trim()).filter((u) => /^https?:\/\//i.test(u)).slice(0, 3);
    const assetType: AssetType = body.assetType || "solution-page";

    if (!target || !/^https?:\/\//i.test(target)) {
      return NextResponse.json({ error: "Valid targetUrl required" }, { status: 400 });
    }
    if (competitors.length === 0) {
      return NextResponse.json({ error: "Provide at least one competitor URL" }, { status: 400 });
    }

    // Fetch target + all competitors in parallel
    const [targetResult, ...competitorResults] = await Promise.all([
      fetchAndAnalyze(target, assetType),
      ...competitors.map((u) => fetchAndAnalyze(u, assetType)),
    ]);

    if (!targetResult.ok) {
      return NextResponse.json({ error: `Failed to fetch target: ${targetResult.error}` }, { status: 502 });
    }

    const comparison: CompetitorComparison = {
      target: {
        url: target,
        score: targetResult.score!,
        wordCount: targetResult.wordCount!,
        schemaTypes: targetResult.schemaTypes!,
        h1: targetResult.h1!,
        metaDescription: targetResult.metaDescription!,
      },
      competitors: competitorResults.map((r, i) => ({
        url: competitors[i],
        ok: r.ok,
        wordCount: r.wordCount,
        schemaTypes: r.schemaTypes,
        h1: r.h1,
        metaDescription: r.metaDescription,
        error: r.error,
      })),
      gaps: computeGaps(targetResult, competitorResults),
    };

    return NextResponse.json({ comparison });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Comparison failed" }, { status: 500 });
  }
}

async function fetchAndAnalyze(url: string, assetType: AssetType) {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 15000);
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*;q=0.9" },
      redirect: "follow",
      signal: ctl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return { ok: false as const, error: `HTTP ${res.status}` };
    const html = await res.text();
    const parsed = parseHTML(html, url);
    const { issues } = runAllAnalyzers({ content: parsed, assetType, isStructured: true });
    const { score } = computeScore(issues);
    return {
      ok: true as const,
      score,
      wordCount: parsed.bodyText.split(/\s+/).filter(Boolean).length,
      schemaTypes: parsed.schemaTypes,
      h1: parsed.h1[0] || "(no H1)",
      metaDescription: parsed.metaDescription,
    };
  } catch (err: any) {
    return { ok: false as const, error: (err?.message || String(err)).slice(0, 200) };
  }
}

function computeGaps(target: any, competitors: any[]): CompetitorComparison["gaps"] {
  const gaps: CompetitorComparison["gaps"] = [];
  const okCompetitors = competitors.filter((c) => c.ok);
  if (okCompetitors.length === 0) return gaps;

  // Word count gap
  const avgCompWords = okCompetitors.reduce((a, c) => a + (c.wordCount || 0), 0) / okCompetitors.length;
  if (target.wordCount < avgCompWords * 0.7) {
    gaps.push({
      dimension: "Content depth",
      finding: `Target is ${target.wordCount} words vs competitor average of ${Math.round(avgCompWords)}.`,
      recommendation: `Expand by ~${Math.round(avgCompWords - target.wordCount)} words. Competitors on the same topic are ${Math.round((avgCompWords / target.wordCount - 1) * 100)}% longer — depth correlates with ranking.`,
    });
  } else if (target.wordCount > avgCompWords * 1.5) {
    gaps.push({
      dimension: "Content depth",
      finding: `Target is ${target.wordCount} words — significantly longer than competitor average of ${Math.round(avgCompWords)}.`,
      recommendation: "Length isn't winning you anything. Trim fluff or split into multiple focused pages.",
    });
  }

  // Schema coverage gap
  const targetSchemaSet = new Set(target.schemaTypes || []);
  const competitorSchemaUnion = new Set<string>();
  okCompetitors.forEach((c) => (c.schemaTypes || []).forEach((s: string) => competitorSchemaUnion.add(s)));
  const schemaGap = [...competitorSchemaUnion].filter((s) => !targetSchemaSet.has(s));
  if (schemaGap.length > 0) {
    gaps.push({
      dimension: "Structured data",
      finding: `Competitors use schema types you don't: ${schemaGap.join(", ")}.`,
      recommendation: `Add the missing schema types. ${schemaGap.includes("FAQPage") ? "FAQPage is the highest-leverage one for SERP rich results." : "Match competitor schema coverage to stay visible in rich results."}`,
    });
  }

  // Meta description gap
  if (!target.metaDescription || target.metaDescription.length < 50) {
    gaps.push({
      dimension: "Meta description",
      finding: "Target has missing or very short meta description.",
      recommendation: "Competitors show fuller meta descriptions. Write a 140–160 char description with keyword + proof point + CTA.",
    });
  }

  // H1 quality — just surface the comparison
  if (target.h1 && okCompetitors.some((c) => c.h1)) {
    const compH1s = okCompetitors.filter((c) => c.h1 && c.h1 !== "(no H1)").map((c) => c.h1!);
    if (compH1s.length > 0) {
      gaps.push({
        dimension: "H1 comparison",
        finding: `Your H1: "${target.h1}". Competitors: ${compH1s.map((h: string) => `"${h.slice(0, 60)}"`).join(", ")}.`,
        recommendation: "Study how competitors frame the same topic. Is your H1 more outcome-led or more generic? Rewrite if theirs is sharper.",
      });
    }
  }

  // Score gap
  const avgCompScore = okCompetitors.reduce((a, c) => a + (c.score || 0), 0) / okCompetitors.length;
  if (target.score < avgCompScore - 10) {
    gaps.push({
      dimension: "Overall quality",
      finding: `Target scores ${target.score} vs competitor average ${Math.round(avgCompScore)}.`,
      recommendation: "Competitors are meaningfully ahead. Prioritize fixing critical and blocker issues on your page first — the rest matters less until the basics are sound.",
    });
  } else if (target.score > avgCompScore + 10) {
    gaps.push({
      dimension: "Overall quality",
      finding: `Target scores ${target.score} vs competitor average ${Math.round(avgCompScore)} — you're ahead.`,
      recommendation: "You're in a strong position. Focus on nice-to-haves and original content moats (GEO, proof points, named customers) to widen the gap.",
    });
  }

  return gaps;
}
