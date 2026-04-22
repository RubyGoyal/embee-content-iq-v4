import { NextRequest, NextResponse } from "next/server";
import { parseHTML } from "@/lib/parser";
import { runAllAnalyzers, computeScore, verdictFor } from "@/lib/engine";
import type { AssetType, BulkAuditItem, BulkAuditReport } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const USER_AGENT =
  "Mozilla/5.0 (compatible; EmbeeContentIQ/3.0; +https://embee.co.in)";

const CONCURRENCY = 4;

interface BulkRequest {
  urls: string[];
  assetType?: AssetType;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as BulkRequest;
    const urls = (body.urls || []).filter((u) => /^https?:\/\//i.test(u)).slice(0, 25);
    if (urls.length === 0) {
      return NextResponse.json({ error: "No valid URLs" }, { status: 400 });
    }
    const assetType: AssetType = body.assetType || "solution-page";

    const startedAt = new Date().toISOString();
    const items: BulkAuditItem[] = urls.map((url) => ({ url, status: "pending" }));

    // Process in batches of CONCURRENCY
    for (let i = 0; i < urls.length; i += CONCURRENCY) {
      const batch = urls.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map(async (url, idx) => {
          const globalIdx = i + idx;
          const item = items[globalIdx];
          item.status = "running";
          const start = Date.now();
          try {
            const html = await fetchWithTimeout(url, 15000);
            const parsed = parseHTML(html, url);
            const { issues } = runAllAnalyzers({ content: parsed, assetType, isStructured: true });
            const { score, subScores } = computeScore(issues);
            item.status = "done";
            item.score = score;
            item.verdict = verdictFor(score);
            item.issueCounts = {
              blocker: issues.filter((x) => x.severity === "blocker").length,
              critical: issues.filter((x) => x.severity === "critical").length,
              important: issues.filter((x) => x.severity === "important").length,
              nice: issues.filter((x) => x.severity === "nice").length,
            };
            item.topIssues = issues
              .filter((x) => x.severity === "blocker" || x.severity === "critical")
              .slice(0, 5)
              .map((x) => x.title);
            item.durationMs = Date.now() - start;
          } catch (err: any) {
            item.status = "failed";
            item.error = (err?.message || String(err)).slice(0, 200);
            item.durationMs = Date.now() - start;
          }
        })
      );
    }

    const completed = items.filter((i) => i.status === "done").length;
    const failed = items.filter((i) => i.status === "failed").length;
    const doneItems = items.filter((i) => i.status === "done");

    const summary: BulkAuditReport["summary"] = doneItems.length > 0 ? {
      avgScore: Math.round(doneItems.reduce((a, i) => a + (i.score || 0), 0) / doneItems.length),
      distribution: {
        publishReady: doneItems.filter((i) => (i.score || 0) >= 85).length,
        minorFixes: doneItems.filter((i) => (i.score || 0) >= 70 && (i.score || 0) < 85).length,
        significantRework: doneItems.filter((i) => (i.score || 0) >= 50 && (i.score || 0) < 70).length,
        doNotPublish: doneItems.filter((i) => (i.score || 0) < 50).length,
      },
      topRecurringIssues: computeTopRecurring(doneItems),
      worstPages: [...doneItems].sort((a, b) => (a.score || 0) - (b.score || 0)).slice(0, 5).map((i) => ({ url: i.url, score: i.score || 0 })),
      bestPages: [...doneItems].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 5).map((i) => ({ url: i.url, score: i.score || 0 })),
    } : undefined;

    const report: BulkAuditReport = {
      startedAt,
      totalUrls: urls.length,
      completed,
      failed,
      items,
      summary,
    };

    return NextResponse.json({ report });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Bulk audit failed" }, { status: 500 });
  }
}

async function fetchWithTimeout(url: string, ms: number): Promise<string> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,*/*;q=0.9",
      },
      redirect: "follow",
      signal: ctl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

function computeTopRecurring(items: BulkAuditItem[]): Array<{ title: string; count: number; category: string }> {
  const counts = new Map<string, { count: number }>();
  for (const item of items) {
    for (const title of item.topIssues || []) {
      const existing = counts.get(title) || { count: 0 };
      existing.count++;
      counts.set(title, existing);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([title, { count }]) => ({ title, count, category: "" }));
}
