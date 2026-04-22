"use client";

import { useState, useCallback } from "react";
import type { CompetitorComparison, AssetType } from "@/lib/types";
import { ArrowRight } from "lucide-react";

export default function CompareClient() {
  const [targetUrl, setTargetUrl] = useState("");
  const [compA, setCompA] = useState("");
  const [compB, setCompB] = useState("");
  const [compC, setCompC] = useState("");
  const [assetType, setAssetType] = useState<AssetType>("solution-page");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompetitorComparison | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const competitorUrls = [compA, compB, compC].filter((u) => u.trim());
      if (competitorUrls.length === 0) throw new Error("Add at least one competitor URL");
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUrl, competitorUrls, assetType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data.comparison);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [targetUrl, compA, compB, compC, assetType]);

  return (
    <div>
      <div className="bg-white border border-rule rounded-xl p-5 mb-4">
        <label className="text-[11px] uppercase tracking-wider text-ink-40 font-medium block mb-2">Your page (target)</label>
        <input type="url" value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)}
          placeholder="https://embee.co.in/solutions/azure-cloud-services/"
          className="w-full px-3 py-[10px] text-[13px] border border-rule rounded-md bg-white focus:outline-none focus:border-ink-60 mb-3" />

        <label className="text-[11px] uppercase tracking-wider text-ink-40 font-medium block mb-2">Competitor URLs (1–3)</label>
        <div className="space-y-2">
          <input type="url" value={compA} onChange={(e) => setCompA(e.target.value)}
            placeholder="https://wipro.com/cloud/"
            className="w-full px-3 py-[10px] text-[13px] border border-rule rounded-md bg-white focus:outline-none focus:border-ink-60" />
          <input type="url" value={compB} onChange={(e) => setCompB(e.target.value)}
            placeholder="https://www.tcs.com/azure-services (optional)"
            className="w-full px-3 py-[10px] text-[13px] border border-rule rounded-md bg-white focus:outline-none focus:border-ink-60" />
          <input type="url" value={compC} onChange={(e) => setCompC(e.target.value)}
            placeholder="https://www.hcltech.com/cloud (optional)"
            className="w-full px-3 py-[10px] text-[13px] border border-rule rounded-md bg-white focus:outline-none focus:border-ink-60" />
        </div>

        <div className="flex items-center gap-2 flex-wrap pt-4 mt-4 border-t border-rule">
          <button onClick={run} disabled={loading}
            className="bg-ink text-paper px-4 py-[10px] rounded-md text-[13px] font-medium flex items-center gap-1.5 disabled:opacity-50 hover:opacity-90">
            {loading ? (<><span className="eciq-spinner" /> Comparing…</>) : (<>Compare <ArrowRight size={13} /></>)}
          </button>
          <div className="flex items-center gap-2 text-[12px] text-ink-60">
            <span>Asset type</span>
            <select value={assetType} onChange={(e) => setAssetType(e.target.value as AssetType)}
              className="text-[12px] px-2.5 py-[7px] border border-rule rounded-md bg-white">
              <option value="solution-page">Solution page</option>
              <option value="landing-page">Landing page</option>
              <option value="blog">Blog post</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="fade-in bg-red-50 text-red-900 border border-red-200 rounded-md px-4 py-3 text-[13px] mb-4">
          {error}
        </div>
      )}

      {result && (
        <div className="fade-in">
          {/* Side-by-side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div className="bg-white border-2 border-ink rounded-xl p-4">
              <div className="text-[10px] uppercase tracking-wider text-ink-60 font-medium mb-1">Your page</div>
              <div className="font-mono text-[11px] text-ink-60 mb-2 truncate">{shortUrl(result.target.url)}</div>
              <div className="text-[36px] font-serif font-medium leading-none mb-2">{result.target.score}<span className="text-[16px] text-ink-40 font-sans font-normal ml-1">/100</span></div>
              <div className="text-[11px] text-ink-60 space-y-0.5">
                <div>Words: <strong className="text-ink">{result.target.wordCount}</strong></div>
                <div>Schemas: <strong className="text-ink">{result.target.schemaTypes.length || "none"}</strong> {result.target.schemaTypes.slice(0, 3).join(", ")}</div>
                <div className="truncate">H1: <strong className="text-ink">{result.target.h1}</strong></div>
              </div>
            </div>
            <div className="space-y-2">
              {result.competitors.map((c, idx) => (
                <div key={idx} className="bg-white border border-rule rounded-xl p-3">
                  <div className="text-[10px] uppercase tracking-wider text-ink-60 font-medium mb-1">Competitor {idx + 1}</div>
                  <div className="font-mono text-[11px] text-ink-60 mb-1 truncate">{shortUrl(c.url)}</div>
                  {c.ok ? (
                    <div className="text-[11px] text-ink-60 space-y-0.5">
                      <div>Words: <strong className="text-ink">{c.wordCount}</strong></div>
                      <div>Schemas: <strong className="text-ink">{c.schemaTypes?.length || "none"}</strong> {c.schemaTypes?.slice(0, 3).join(", ")}</div>
                      <div className="truncate">H1: <strong className="text-ink">{c.h1}</strong></div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-red-800">Couldn't fetch: {c.error}</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Gaps */}
          {result.gaps.length > 0 && (
            <div className="bg-white border border-rule rounded-xl p-5 mb-4">
              <h2 className="text-[14px] font-medium mb-3">Gap analysis</h2>
              {result.gaps.map((g, idx) => (
                <div key={idx} className="py-3 border-b border-rule last:border-b-0 last:pb-0">
                  <div className="text-[10px] uppercase tracking-wider text-ink-40 font-mono font-medium mb-1">{g.dimension}</div>
                  <div className="text-[13px] font-medium mb-1">{g.finding}</div>
                  <div className="bg-blue-50 border-l-2 border-blue-400 px-3 py-2 rounded-r-md text-blue-900 text-[12px]">
                    <strong className="font-medium block mb-0.5">Recommendation</strong>
                    {g.recommendation}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function shortUrl(u: string): string {
  try {
    const url = new URL(u);
    return url.hostname + url.pathname;
  } catch {
    return u;
  }
}
