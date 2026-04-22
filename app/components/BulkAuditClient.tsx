"use client";

import { useState, useCallback } from "react";
import type { BulkAuditReport, AssetType } from "@/lib/types";
import { ArrowRight, Globe, FileText, Download } from "lucide-react";

export default function BulkAuditClient() {
  const [inputMode, setInputMode] = useState<"sitemap" | "list">("sitemap");
  const [sitemapUrl, setSitemapUrl] = useState("https://embee.co.in/sitemap.xml");
  const [rawList, setRawList] = useState("");
  const [assetType, setAssetType] = useState<AssetType>("solution-page");
  const [discoveredUrls, setDiscoveredUrls] = useState<string[]>([]);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [discovering, setDiscovering] = useState(false);
  const [auditing, setAuditing] = useState(false);
  const [report, setReport] = useState<BulkAuditReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const discover = useCallback(async () => {
    setError(null);
    setReport(null);
    setDiscovering(true);
    try {
      const body = inputMode === "sitemap" ? { sitemapUrl } : { rawList };
      const res = await fetch("/api/sitemap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDiscoveredUrls(data.urls);
      setSelectedUrls(new Set(data.urls.slice(0, 10)));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDiscovering(false);
    }
  }, [inputMode, sitemapUrl, rawList]);

  const runBulk = useCallback(async () => {
    if (selectedUrls.size === 0) {
      setError("Select at least one URL");
      return;
    }
    setError(null);
    setAuditing(true);
    setReport(null);
    try {
      const res = await fetch("/api/bulk-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: [...selectedUrls], assetType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setReport(data.report);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAuditing(false);
    }
  }, [selectedUrls, assetType]);

  const toggleUrl = (u: string) => {
    setSelectedUrls((prev) => {
      const next = new Set(prev);
      if (next.has(u)) next.delete(u);
      else next.add(u);
      return next;
    });
  };

  const selectAll = () => setSelectedUrls(new Set(discoveredUrls));
  const selectNone = () => setSelectedUrls(new Set());

  const downloadReport = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `embee-bulk-audit-${Date.now()}.json`;
    a.click();
  };

  const downloadCsv = () => {
    if (!report) return;
    const rows = [
      ["URL", "Status", "Score", "Verdict", "Blockers", "Critical", "Important", "Nice", "Duration (ms)", "Error"],
      ...report.items.map((i) => [
        i.url,
        i.status,
        i.score ?? "",
        i.verdict ?? "",
        i.issueCounts?.blocker ?? "",
        i.issueCounts?.critical ?? "",
        i.issueCounts?.important ?? "",
        i.issueCounts?.nice ?? "",
        i.durationMs ?? "",
        i.error ?? "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `embee-bulk-audit-${Date.now()}.csv`;
    a.click();
  };

  return (
    <div>
      <div className="bg-white border border-rule rounded-xl p-5 mb-4">
        <div className="flex gap-1 p-[3px] bg-paper-2 rounded-md w-fit mb-4">
          <button
            onClick={() => setInputMode("sitemap")}
            className={`px-3 py-[7px] text-[12px] font-medium rounded-[6px] flex items-center gap-1.5 ${
              inputMode === "sitemap" ? "bg-white text-ink shadow-sm" : "text-ink-60"
            }`}
          >
            <Globe size={12} /> Sitemap URL
          </button>
          <button
            onClick={() => setInputMode("list")}
            className={`px-3 py-[7px] text-[12px] font-medium rounded-[6px] flex items-center gap-1.5 ${
              inputMode === "list" ? "bg-white text-ink shadow-sm" : "text-ink-60"
            }`}
          >
            <FileText size={12} /> Paste URL list
          </button>
        </div>

        {inputMode === "sitemap" ? (
          <div>
            <label className="text-[11px] uppercase tracking-wider text-ink-40 font-medium block mb-2">Sitemap URL</label>
            <input
              type="url"
              value={sitemapUrl}
              onChange={(e) => setSitemapUrl(e.target.value)}
              placeholder="https://embee.co.in/sitemap.xml"
              className="w-full px-3 py-[10px] text-[13px] border border-rule rounded-md bg-white focus:outline-none focus:border-ink-60"
            />
            <p className="text-[11px] text-ink-40 mt-2">Handles sitemap indexes too. First 50 URLs are discovered.</p>
          </div>
        ) : (
          <div>
            <label className="text-[11px] uppercase tracking-wider text-ink-40 font-medium block mb-2">URL list — one per line</label>
            <textarea
              value={rawList}
              onChange={(e) => setRawList(e.target.value)}
              rows={6}
              placeholder={"https://embee.co.in/solutions/azure-cloud-services/\nhttps://embee.co.in/solutions/microsoft-365-copilot/\nhttps://embee.co.in/erp/sap-business-one/"}
              className="w-full px-3 py-[10px] text-[13px] border border-rule rounded-md bg-white focus:outline-none focus:border-ink-60 resize-y font-mono"
            />
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap pt-4 mt-4 border-t border-rule">
          <button
            onClick={discover}
            disabled={discovering}
            className="bg-ink text-paper px-4 py-[10px] rounded-md text-[13px] font-medium flex items-center gap-1.5 disabled:opacity-50 hover:opacity-90"
          >
            {discovering ? (
              <>
                <span className="eciq-spinner" /> Discovering…
              </>
            ) : (
              <>
                Discover URLs <ArrowRight size={13} />
              </>
            )}
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

      {discoveredUrls.length > 0 && !report && (
        <div className="fade-in bg-white border border-rule rounded-xl p-5 mb-4">
          <div className="flex justify-between items-center mb-3">
            <div>
              <div className="text-[14px] font-medium">{discoveredUrls.length} URLs discovered</div>
              <div className="text-[11px] text-ink-60">{selectedUrls.size} selected · max 25 per batch</div>
            </div>
            <div className="flex gap-1.5">
              <button onClick={selectAll} className="text-[11px] px-2.5 py-1 rounded-md border border-rule text-ink-60 hover:border-ink-60">Select all</button>
              <button onClick={selectNone} className="text-[11px] px-2.5 py-1 rounded-md border border-rule text-ink-60 hover:border-ink-60">None</button>
            </div>
          </div>
          <div className="max-h-[300px] overflow-y-auto border border-rule rounded-md">
            {discoveredUrls.map((u) => (
              <label key={u} className="flex items-center gap-2 px-3 py-1.5 text-[12px] font-mono border-b border-rule last:border-b-0 hover:bg-paper-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedUrls.has(u)}
                  onChange={() => toggleUrl(u)}
                />
                <span className="truncate">{u}</span>
              </label>
            ))}
          </div>
          <button
            onClick={runBulk}
            disabled={auditing || selectedUrls.size === 0}
            className="mt-4 bg-ink text-paper px-4 py-[10px] rounded-md text-[13px] font-medium flex items-center gap-1.5 disabled:opacity-50 hover:opacity-90"
          >
            {auditing ? (
              <>
                <span className="eciq-spinner" /> Auditing {selectedUrls.size} URLs…
              </>
            ) : (
              <>
                Run bulk audit ({selectedUrls.size}) <ArrowRight size={13} />
              </>
            )}
          </button>
        </div>
      )}

      {report && (
        <div className="fade-in">
          {report.summary && (
            <div className="bg-white border border-rule rounded-xl p-5 mb-4">
              <h2 className="text-[14px] font-medium mb-3">Summary</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Average score" value={`${report.summary.avgScore}/100`} />
                <Stat label="Completed" value={`${report.completed} / ${report.totalUrls}`} />
                <Stat label="Failed" value={String(report.failed)} />
                <Stat label="Publish-ready" value={String(report.summary.distribution.publishReady)} />
              </div>
              <div className="mt-4">
                <div className="text-[11px] uppercase tracking-wider text-ink-40 font-medium mb-2">Score distribution</div>
                <div className="flex h-[24px] rounded overflow-hidden">
                  {(() => {
                    const d = report.summary!.distribution;
                    const total = d.publishReady + d.minorFixes + d.significantRework + d.doNotPublish;
                    if (total === 0) return null;
                    return (
                      <>
                        <div className="bg-green flex items-center justify-center text-white text-[10px] font-medium" style={{ width: `${(d.publishReady / total) * 100}%` }}>
                          {d.publishReady > 0 ? d.publishReady : ""}
                        </div>
                        <div className="bg-amber flex items-center justify-center text-white text-[10px] font-medium" style={{ width: `${(d.minorFixes / total) * 100}%` }}>
                          {d.minorFixes > 0 ? d.minorFixes : ""}
                        </div>
                        <div className="bg-red-600 flex items-center justify-center text-white text-[10px] font-medium" style={{ width: `${(d.significantRework / total) * 100}%` }}>
                          {d.significantRework > 0 ? d.significantRework : ""}
                        </div>
                        <div className="bg-red-900 flex items-center justify-center text-white text-[10px] font-medium" style={{ width: `${(d.doNotPublish / total) * 100}%` }}>
                          {d.doNotPublish > 0 ? d.doNotPublish : ""}
                        </div>
                      </>
                    );
                  })()}
                </div>
                <div className="flex gap-4 mt-2 text-[10px] text-ink-60">
                  <span>▪ Publish-ready</span><span>▪ Minor fixes</span><span>▪ Significant rework</span><span>▪ Do not publish</span>
                </div>
              </div>
              {report.summary.topRecurringIssues.length > 0 && (
                <div className="mt-4">
                  <div className="text-[11px] uppercase tracking-wider text-ink-40 font-medium mb-2">Top recurring issues</div>
                  {report.summary.topRecurringIssues.slice(0, 5).map((i, idx) => (
                    <div key={idx} className="flex justify-between text-[12px] py-1.5 border-b border-rule last:border-b-0">
                      <span>{i.title}</span>
                      <span className="font-mono text-ink-60">{i.count} pages</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid md:grid-cols-2 gap-4 mt-4">
                {report.summary.worstPages.length > 0 && (
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-ink-40 font-medium mb-2">Worst-performing pages</div>
                    {report.summary.worstPages.map((p, idx) => (
                      <div key={idx} className="flex justify-between items-center py-1 text-[12px] font-mono truncate">
                        <span className="truncate mr-2">{shortUrl(p.url)}</span>
                        <span className="text-red-800 font-medium">{p.score}</span>
                      </div>
                    ))}
                  </div>
                )}
                {report.summary.bestPages.length > 0 && (
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-ink-40 font-medium mb-2">Best-performing pages</div>
                    {report.summary.bestPages.map((p, idx) => (
                      <div key={idx} className="flex justify-between items-center py-1 text-[12px] font-mono truncate">
                        <span className="truncate mr-2">{shortUrl(p.url)}</span>
                        <span className="text-green font-medium">{p.score}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Full table */}
          <div className="bg-white border border-rule rounded-xl overflow-hidden">
            <div className="grid grid-cols-[1fr_70px_90px_50px_50px_50px] gap-2 px-3 py-2 bg-paper-2 text-[10px] uppercase tracking-wider font-medium text-ink-60">
              <div>URL</div>
              <div className="text-center">Score</div>
              <div>Verdict</div>
              <div className="text-center">Block</div>
              <div className="text-center">Crit</div>
              <div className="text-center">Imp</div>
            </div>
            {report.items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_70px_90px_50px_50px_50px] gap-2 px-3 py-2 border-t border-rule text-[12px] items-center">
                <div className="font-mono text-[11px] truncate">{shortUrl(item.url)}</div>
                <div className="text-center font-mono font-medium">
                  {item.status === "done" ? item.score : item.status === "failed" ? "—" : "…"}
                </div>
                <div className="text-[11px] truncate">
                  {item.status === "done" ? item.verdict : item.status === "failed" ? <span className="text-red-800">failed</span> : item.status}
                </div>
                <div className="text-center font-mono text-[11px] text-red-800">{item.issueCounts?.blocker ?? ""}</div>
                <div className="text-center font-mono text-[11px] text-red-700">{item.issueCounts?.critical ?? ""}</div>
                <div className="text-center font-mono text-[11px] text-amber">{item.issueCounts?.important ?? ""}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <button onClick={downloadCsv} className="border border-rule px-3 py-2 rounded-md text-[12px] font-medium flex items-center gap-1.5 hover:border-ink-60">
              <Download size={12} /> Download CSV
            </button>
            <button onClick={downloadReport} className="border border-rule px-3 py-2 rounded-md text-[12px] font-medium flex items-center gap-1.5 hover:border-ink-60">
              <Download size={12} /> Download JSON
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-paper-2 rounded-md p-3">
      <div className="text-[11px] text-ink-60 mb-1">{label}</div>
      <div className="text-[20px] font-medium font-mono">{value}</div>
    </div>
  );
}

function shortUrl(u: string): string {
  try {
    const url = new URL(u);
    return url.pathname + (url.search || "");
  } catch {
    return u;
  }
}
