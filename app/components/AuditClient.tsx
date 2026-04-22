"use client";

import { useState, useCallback, useMemo } from "react";
import type { AssetType, AuditReport, Severity } from "@/lib/types";
import {
  Globe, FileText, Upload, ArrowRight, Check, Copy, Download,
  AlertOctagon, AlertTriangle, Circle, Ban,
} from "lucide-react";

type Tab = "url" | "text" | "file";

const SAMPLE_URLS = [
  { label: "Azure Cloud", url: "https://embee.co.in/solutions/azure-cloud-services/" },
  { label: "M365 Copilot", url: "https://embee.co.in/solutions/microsoft-365-copilot/" },
  { label: "SAP Business One", url: "https://embee.co.in/erp/sap-business-one/" },
  { label: "Octane HRMS", url: "https://embee.co.in/octane-hrms/" },
  { label: "Cloud Security", url: "https://embee.co.in/solutions/cloud-security-services/" },
];

const SAMPLE_BAD_COPY = `Unlock the power of cloud with Office 365 and Azure

In today's fast-paced world, businesses need best-in-class solutions that leverage cutting-edge technology to deliver seamless, mission-critical outcomes. Our Office 365 services, combined with MS Azure, provide a one-stop shop for all your cloud needs.

We offer synergistic, world-class solutions for enterprises looking to transform. Whether you need SAP BusinessOne for your ERP, or are migrating SAP workloads using our turnkey approach, we've got you covered.

Embee Software Pvt Ltd is a top Microsoft partner in India. We provide end-to-end services including deployment, support, and managed services.

Contact us today to learn more about our turnkey solutions.

Learn More`;

const SAMPLE_EMAIL = `Subject: Your Office 365 migration journey starts here

Hi there,

We wanted to reach out about our best-in-class cloud solutions. Embee Software Pvt Ltd leverages cutting-edge MS Azure technology to empower your digital transformation.

Our Office 365 and MS Teams deployments are seamless, turnkey, and state-of-the-art. We also do WVD for remote work.

Click here to book a call.

Thanks,
The Embee team`;

const SCAN_STEPS_URL = [
  "Fetching page",
  "Parsing HTML & extracting structure",
  "On-page SEO analyzer",
  "Technical SEO analyzer",
  "Content quality + E-E-A-T",
  "Copywriting + keyword strategy",
  "Internal linking graph",
  "Conversion depth",
  "Brand voice + readability",
  "LLM enrichment",
  "Scoring",
];
const SCAN_STEPS_LOCAL = [
  "Reading content",
  "Content quality analyzer",
  "Copywriting analyzer",
  "Brand voice + readability",
  "Conversion depth",
  "LLM enrichment",
  "Scoring",
];

const severityMeta: Record<Severity, { label: string; Icon: any; bg: string; fg: string; order: number }> = {
  blocker:   { label: "BLOCKER",      Icon: Ban,            bg: "bg-red-100",    fg: "text-red-900", order: 0 },
  critical:  { label: "CRITICAL",     Icon: AlertOctagon,   bg: "bg-red-50",     fg: "text-red-900", order: 1 },
  important: { label: "IMPORTANT",    Icon: AlertTriangle,  bg: "bg-amber-50",   fg: "text-amber-900", order: 2 },
  nice:      { label: "NICE",         Icon: Circle,         bg: "bg-paper-2",    fg: "text-ink-80",  order: 3 },
};

const verdictColor = (score: number) => {
  if (score >= 85) return "text-green";
  if (score >= 70) return "text-amber";
  return "text-red-800";
};

const SUB_ROWS: Array<{ k: keyof AuditReport["subScores"]; label: string; w: string }> = [
  { k: "onPageSeo",       label: "On-page SEO",      w: "15" },
  { k: "technical",       label: "Technical SEO",    w: "10" },
  { k: "contentQuality",  label: "Content quality",  w: "14" },
  { k: "eeat",            label: "E-E-A-T",          w: "10" },
  { k: "copywriting",     label: "Copywriting",      w: "12" },
  { k: "internalLinking", label: "Internal linking", w: "8"  },
  { k: "geo",             label: "GEO (AI search)",  w: "9"  },
  { k: "brand",           label: "Brand & voice",    w: "11" },
  { k: "conversion",      label: "Conversion",       w: "11" },
];

export default function AuditClient({ embedded }: { embedded?: boolean } = {}) {
  const [tab, setTab] = useState<Tab>("url");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<{ name: string; size: number; text: string } | null>(null);
  const [assetType, setAssetType] = useState<AssetType>("solution-page");
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [scanning, setScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState<"all" | Severity>("all");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const handleFile = useCallback(async (f: File) => {
    if (f.size > 5 * 1024 * 1024) {
      setError("File exceeds 5 MB limit");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", f);
      const res = await fetch("/api/parse-file", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not parse file");
      setFile({ name: data.filename, size: data.size, text: data.text });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const runAudit = useCallback(async () => {
    if (scanning) return;
    setError(null);
    setReport(null);
    setScanning(true);
    setScanStep(0);
    setExpandedIds(new Set());

    try {
      if (tab === "url") {
        if (!url.trim()) throw new Error("Enter a URL first");
        if (!/^https?:\/\//i.test(url)) throw new Error("URL must start with http:// or https://");

        const fetchRes = await fetch("/api/fetch-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: url.trim() }),
        });
        const fetchData = await fetchRes.json();
        if (!fetchRes.ok) throw new Error(fetchData.error || "Could not fetch URL");
        setScanStep(2);

        const auditRes = await fetch("/api/audit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "url",
            parsed: fetchData.parsed,
            source: url.trim(),
            assetType,
          }),
        });
        setScanStep(6);
        const auditData = await auditRes.json();
        if (!auditRes.ok) throw new Error(auditData.error || "Audit failed");
        setScanStep(SCAN_STEPS_URL.length);
        setReport(auditData.report);
      } else {
        const content = tab === "text" ? text : file?.text;
        const source = tab === "text" ? `Pasted text (${(text || "").length} chars)` : file?.name || "Upload";
        if (!content) throw new Error(tab === "text" ? "Paste some content first" : "Upload a file first");
        if (content.length < 50) throw new Error("Content too short — paste at least 50 characters");

        setScanStep(1);
        const auditRes = await fetch("/api/audit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: tab, text: content, source, assetType }),
        });
        setScanStep(3);
        const data = await auditRes.json();
        if (!auditRes.ok) throw new Error(data.error || "Audit failed");
        setScanStep(SCAN_STEPS_LOCAL.length);
        setReport(data.report);
      }
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setScanning(false);
    }
  }, [tab, url, text, file, assetType, scanning]);

  const filteredIssues = useMemo(() => {
    if (!report) return [];
    if (filter === "all") return report.issues;
    return report.issues.filter((i) => i.severity === filter);
  }, [report, filter]);

  const counts = useMemo(() => {
    if (!report) return { blocker: 0, critical: 0, important: 0, nice: 0 };
    return {
      blocker: report.issues.filter((i) => i.severity === "blocker").length,
      critical: report.issues.filter((i) => i.severity === "critical").length,
      important: report.issues.filter((i) => i.severity === "important").length,
      nice: report.issues.filter((i) => i.severity === "nice").length,
    };
  }, [report]);

  const scanSteps = tab === "url" ? SCAN_STEPS_URL : SCAN_STEPS_LOCAL;

  const toggleIssue = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyReport = () => {
    if (!report) return;
    navigator.clipboard?.writeText(formatReportText(report));
  };

  const downloadJson = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `embee-audit-${Date.now()}.json`;
    a.click();
  };

  return (
    <div className={embedded ? "" : "max-w-[1100px] mx-auto px-6 py-8 pb-16"}>
      {!embedded && (
        <>
          <header className="flex items-start justify-between flex-wrap gap-4 pb-6 border-b border-rule mb-8">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded bg-ink text-paper grid place-items-center font-mono font-medium">E</div>
              <div>
                <div className="text-[15px] font-medium">EmbeeContentIQ</div>
                <div className="text-[11px] text-ink-60 font-mono">v3.0 · Stage A+B full audit · Claude-powered</div>
              </div>
            </div>
            <div className="flex gap-6 text-[12px] text-ink-60">
              <div><strong className="text-ink">170</strong> checks</div>
              <div><strong className="text-ink">8</strong> sub-scores</div>
              <div><strong className="text-ink">4</strong> severity tiers</div>
            </div>
          </header>

          <div className="mb-8">
            <h1 className="font-serif text-[32px] leading-[1.1] font-medium tracking-[-0.02em] max-w-[680px] mb-2">
              Deep audit of any Embee marketing asset — SEO, technical, content, copywriting, linking, conversion, brand, E-E-A-T.
            </h1>
            <p className="text-[13px] text-ink-60 max-w-[620px] leading-[1.55]">
              Paste a URL, drop a document, or paste text. Runs 170 checks across 8 dimensions — flags missing schema, weak openings, outdated partner marks, keyword stuffing, generic CTAs, intent mismatches, and more. Suggests rewrites.
            </p>
          </div>
        </>
      )}

      <div className="bg-white border border-rule rounded-xl p-5 mb-4">
        <div className="flex gap-1 p-[3px] bg-paper-2 rounded-md w-fit mb-4">
          {([
            { id: "url", label: "URL", Icon: Globe },
            { id: "text", label: "Paste text", Icon: FileText },
            { id: "file", label: "Upload file", Icon: Upload },
          ] as const).map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-3 py-[7px] text-[12px] font-medium rounded-[6px] flex items-center gap-1.5 transition ${
                tab === id ? "bg-white text-ink shadow-sm" : "text-ink-60 hover:text-ink"
              }`}
            >
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>

        {tab === "url" && (
          <div>
            <label className="text-[11px] uppercase tracking-wider text-ink-40 font-medium block mb-2">Public URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runAudit()}
              placeholder="https://embee.co.in/solutions/azure-cloud-services/"
              className="w-full px-3 py-[10px] text-[13px] border border-rule rounded-md bg-white focus:outline-none focus:border-ink-60"
            />
            <p className="text-[11px] text-ink-40 mt-2">Fetches server-side — no CORS issues, follows redirects.</p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {SAMPLE_URLS.map((s) => (
                <button key={s.url} onClick={() => setUrl(s.url)}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-paper-2 text-ink-60 font-medium hover:bg-paper-3 hover:text-ink">
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === "text" && (
          <div>
            <label className="text-[11px] uppercase tracking-wider text-ink-40 font-medium block mb-2">Content to audit</label>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={7}
              placeholder="Paste content. Any format: blogs, emails, landing pages, social posts, PDF excerpts."
              className="w-full px-3 py-[10px] text-[13px] border border-rule rounded-md bg-white focus:outline-none focus:border-ink-60 resize-y font-sans leading-[1.55]" />
            <div className="flex gap-1.5 mt-3">
              <button onClick={() => { setText(SAMPLE_BAD_COPY); setAssetType("blog"); }}
                className="text-[11px] px-2.5 py-1 rounded-full bg-paper-2 text-ink-60 font-medium hover:bg-paper-3 hover:text-ink">
                Load sample (bad copy)
              </button>
              <button onClick={() => { setText(SAMPLE_EMAIL); setAssetType("email"); }}
                className="text-[11px] px-2.5 py-1 rounded-full bg-paper-2 text-ink-60 font-medium hover:bg-paper-3 hover:text-ink">
                Load sample email
              </button>
            </div>
          </div>
        )}

        {tab === "file" && (
          <div>
            <label className="text-[11px] uppercase tracking-wider text-ink-40 font-medium block mb-2">Upload document</label>
            <div onClick={() => document.getElementById("eciq-file-in")?.click()}
              onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              className={`border border-dashed rounded-xl p-6 text-center cursor-pointer transition ${
                isDragging ? "border-amber bg-amber/5" : "border-ink-20 bg-paper-2"
              }`}>
              {uploading ? (
                <div className="text-[13px] text-ink-60"><span className="eciq-spinner inline-block align-middle mr-2" /> Parsing file…</div>
              ) : (
                <>
                  <div className="text-[13px] font-medium mb-1">Drop a file here or click to browse</div>
                  <div className="text-[11px] text-ink-60">.txt, .md, .html, .pdf, .docx — up to 5 MB</div>
                </>
              )}
              <input id="eciq-file-in" type="file" accept=".txt,.md,.html,.htm,.pdf,.docx" className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
            </div>
            {file && (
              <div className="mt-3 px-3 py-2 bg-paper-2 rounded-md text-[12px]">
                <div className="font-medium mb-0.5">{file.name} · {(file.size / 1024).toFixed(1)} KB · {file.text.length} chars</div>
                <div className="text-ink-60 text-[11px] truncate">{file.text.slice(0, 120)}…</div>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap pt-4 mt-4 border-t border-rule">
          <button onClick={runAudit} disabled={scanning}
            className="bg-ink text-paper px-4 py-[10px] rounded-md text-[13px] font-medium flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90">
            Run deep audit <ArrowRight size={13} />
          </button>
          <div className="flex items-center gap-2 text-[12px] text-ink-60">
            <span>Asset type</span>
            <select value={assetType} onChange={(e) => setAssetType(e.target.value as AssetType)}
              className="text-[12px] px-2.5 py-[7px] border border-rule rounded-md bg-white">
              <option value="solution-page">Solution page</option>
              <option value="landing-page">Landing page</option>
              <option value="blog">Blog post</option>
              <option value="email">Email</option>
              <option value="social">Social post</option>
              <option value="pdf">PDF / collateral</option>
            </select>
          </div>
          <div className="ml-auto text-[11px] font-mono text-ink-40">
            {scanning ? "Auditing…" : report ? `Done · ${report.score}/100` : "Ready"}
          </div>
        </div>
      </div>

      {scanning && (
        <div className="fade-in bg-paper-2 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 text-[12px] text-ink-60 mb-2">
            <span className="w-2 h-2 rounded-full bg-amber eciq-pulse" /> Running deep audit
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
            {scanSteps.map((step, i) => (
              <div key={i}
                className={`flex items-center gap-2.5 py-1.5 text-[12px] ${
                  i < scanStep ? "text-ink-60" : i === scanStep ? "text-ink font-medium" : "text-ink-40"
                }`}>
                <span className="font-mono text-[10px] text-ink-40 w-6">{String(i + 1).padStart(2, "0")}</span>
                <span className="flex-1">{step}</span>
                {i < scanStep ? <Check size={12} className="text-green" /> : i === scanStep ? <span className="eciq-spinner" /> : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="fade-in bg-red-50 text-red-900 border border-red-200 rounded-md px-4 py-3 text-[13px] leading-[1.55] mb-4 whitespace-pre-line">
          {error}
        </div>
      )}

      {report && (
        <div className="fade-in">
          {/* Stats header */}
          <div className="bg-paper-2 rounded-md px-3 py-2 text-[11px] font-mono text-ink-60 mb-4 flex flex-wrap gap-x-4 gap-y-1">
            <span>Source: <strong className="text-ink">{report.source}</strong></span>
            <span>Type: <strong className="text-ink">{report.assetType}</strong></span>
            <span>Words: <strong className="text-ink">{report.stats.words}</strong></span>
            <span>Sentences: <strong className="text-ink">{report.stats.sentences}</strong></span>
            <span>Paragraphs: <strong className="text-ink">{report.stats.paragraphs}</strong></span>
            <span>Images: <strong className="text-ink">{report.stats.images}</strong></span>
            <span>Int. links: <strong className="text-ink">{report.stats.internalLinks}</strong></span>
            <span>Ext. links: <strong className="text-ink">{report.stats.externalLinks}</strong></span>
            {report.insights.flesch !== undefined && report.insights.flesch > 0 && (
              <span>Flesch: <strong className="text-ink">{report.insights.flesch}</strong></span>
            )}
            {report.insights.passiveVoicePct !== undefined && (
              <span>Passive: <strong className="text-ink">{report.insights.passiveVoicePct}%</strong></span>
            )}
            {report.insights.searchIntent && (
              <span>Intent: <strong className={report.insights.intentMatch === "mismatch" ? "text-red-800" : "text-ink"}>{report.insights.searchIntent}{report.insights.intentMatch === "mismatch" ? " ⚠" : ""}</strong></span>
            )}
          </div>

          {/* Score card */}
          <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6 items-center bg-white border border-rule rounded-xl p-5 mb-4">
            <div>
              <div className={`font-serif text-[64px] leading-none font-medium tabular-nums tracking-[-0.03em] ${verdictColor(report.score)}`}>
                {report.score}
                <span className="text-[18px] text-ink-40 font-sans font-normal tracking-normal ml-1">/100</span>
              </div>
              <div className={`text-[11px] uppercase tracking-[0.08em] font-medium mt-2 ${verdictColor(report.score)}`}>
                {report.verdict}
              </div>
            </div>
            <div>
              {SUB_ROWS.map(({ k, label, w }) => {
                const val = report.subScores[k];
                return (
                  <div key={k} className="grid grid-cols-[1fr_140px_32px] gap-3 items-center text-[12px] mb-2">
                    <span className="text-ink-60">
                      {label} <span className="text-ink-40 font-mono text-[10px]">w{w}</span>
                    </span>
                    <div className="h-[3px] bg-rule rounded overflow-hidden">
                      <div className="h-full bg-ink transition-[width] duration-700" style={{ width: `${val}%` }} />
                    </div>
                    <span className="text-right font-mono text-[12px] font-medium tabular-nums">{val}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Issue filters */}
          <div className="flex justify-between items-center py-2 border-b border-rule mb-3 mt-6">
            <h2 className="text-[14px] font-medium">
              Issues found <span className="font-normal text-[11px] font-mono text-ink-60 ml-2">{report.issues.length} total</span>
            </h2>
          </div>
          <div className="flex gap-1.5 flex-wrap mb-3">
            {([
              ["all",       `All ${report.issues.length}`],
              ["blocker",   `Blockers ${counts.blocker}`],
              ["critical",  `Critical ${counts.critical}`],
              ["important", `Important ${counts.important}`],
              ["nice",      `Nice ${counts.nice}`],
            ] as const).map(([f, label]) => (
              <button key={f} onClick={() => setFilter(f as any)}
                className={`text-[11px] px-2.5 py-1 rounded-md border font-medium transition ${
                  filter === f ? "bg-ink text-paper border-ink" : "bg-transparent text-ink-60 border-rule hover:border-ink-60"
                }`}>
                {label}
              </button>
            ))}
          </div>

          <div>
            {filteredIssues.length === 0 ? (
              <div className="bg-paper-2 rounded-md p-6 text-center text-[12px] text-ink-40">
                No issues in this category.
              </div>
            ) : (
              filteredIssues.map((it) => (
                <IssueCard key={it.id} issue={it}
                  isExpanded={expandedIds.has(it.id)}
                  onToggle={() => toggleIssue(it.id)} />
              ))
            )}
          </div>

          {/* Keywords */}
          {report.keywords.length > 0 && (
            <>
              <div className="flex justify-between items-center py-2 border-b border-rule mb-3 mt-6">
                <h2 className="text-[14px] font-medium">
                  Keyword coverage <span className="font-normal text-[11px] font-mono text-ink-60 ml-2">{report.keywords.length} detected terms</span>
                </h2>
              </div>
              <div className="border border-rule rounded-md overflow-hidden mb-6 text-[11px]">
                <div className="grid grid-cols-[2fr_45px_45px_45px_55px_55px_55px_70px] gap-1 px-3 py-2 bg-paper-2 uppercase tracking-wider font-medium text-ink-60">
                  <div>Term</div>
                  <div className="text-center">Title</div>
                  <div className="text-center">H1</div>
                  <div className="text-center">H2</div>
                  <div className="text-center">URL</div>
                  <div className="text-center">Meta</div>
                  <div className="text-center">Alt</div>
                  <div className="text-right">Density</div>
                </div>
                {report.keywords.map((k) => (
                  <div key={k.kw} className="grid grid-cols-[2fr_45px_45px_45px_55px_55px_55px_70px] gap-1 px-3 py-2 border-t border-rule items-center">
                    <div className="font-mono text-[11px]">{k.kw}</div>
                    <Tick v={k.inTitle} />
                    <Tick v={k.inH1} />
                    <Tick v={k.inH2} />
                    <Tick v={k.inUrl} />
                    <Tick v={k.inMeta} />
                    <Tick v={k.inAlt} />
                    <div className="text-right font-mono text-[11px]">{k.density}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Rewrites */}
          {report.aiRewrites?.headlines && report.aiRewrites.headlines.length > 0 && (
            <>
              <div className="flex justify-between items-center py-2 border-b border-rule mb-3 mt-6">
                <h2 className="text-[14px] font-medium">Headline rewrites <span className="font-normal text-[11px] font-mono text-ink-60 ml-2">{report.aiRewrites.headlines.length} variants · CXO audience</span></h2>
              </div>
              {report.aiRewrites.headlines.map((h, i) => (
                <div key={i} className="border border-rule rounded-md p-3.5 mb-1.5">
                  <div className="text-[10px] uppercase tracking-wider text-ink-40 font-mono font-medium mb-1.5">Variant 0{i + 1}</div>
                  <div className="font-serif text-[15px] leading-[1.35] tracking-[-0.01em]">{h}</div>
                </div>
              ))}
            </>
          )}

          {report.aiRewrites?.metaDescription && (
            <>
              <div className="flex justify-between items-center py-2 border-b border-rule mb-3 mt-6">
                <h2 className="text-[14px] font-medium">Meta description rewrite <span className="font-normal text-[11px] font-mono text-ink-60 ml-2">{report.aiRewrites.metaDescription.length} chars</span></h2>
              </div>
              <div className="border border-rule rounded-md p-3.5 mb-6">
                <div className="text-[10px] uppercase tracking-wider text-ink-40 font-mono font-medium mb-1.5">Suggested</div>
                <div className="font-serif text-[15px] leading-[1.35] tracking-[-0.01em]">{report.aiRewrites.metaDescription}</div>
              </div>
            </>
          )}

          <div className="mt-6 bg-ink text-paper rounded-xl px-5 py-3.5 flex justify-between items-center flex-wrap gap-3">
            <div className="text-[11px] uppercase tracking-[0.06em] opacity-80">
              Audit complete · {report.issues.length} issues across 8 categories
            </div>
            <div className="flex gap-1.5">
              <button onClick={copyReport}
                className="bg-transparent border border-white/30 text-paper px-3 py-[7px] rounded-md text-[11px] font-medium flex items-center gap-1.5 hover:border-white/60">
                <Copy size={11} /> Copy report
              </button>
              <button onClick={downloadJson}
                className="bg-transparent border border-white/30 text-paper px-3 py-[7px] rounded-md text-[11px] font-medium flex items-center gap-1.5 hover:border-white/60">
                <Download size={11} /> Download JSON
              </button>
            </div>
          </div>
        </div>
      )}

      {!embedded && (
        <footer className="mt-12 pt-4 border-t border-rule text-[11px] font-mono text-ink-60 flex justify-between flex-wrap gap-2">
          <div>EmbeeContentIQ · Next.js 14 · Anthropic Claude · Internal use</div>
          <div>v3.0 — Stage A+B</div>
        </footer>
      )}
    </div>
  );
}

function Tick({ v }: { v: boolean }) {
  return <div className={`text-center ${v ? "text-green" : "text-ink-40"}`}>{v ? "✓" : "—"}</div>;
}

function IssueCard({ issue, isExpanded, onToggle }: { issue: AuditReport["issues"][number]; isExpanded: boolean; onToggle: () => void }) {
  const meta = severityMeta[issue.severity];
  return (
    <div className="border border-rule rounded-md mb-1.5 bg-white hover:border-ink-40 transition overflow-hidden">
      <button onClick={onToggle} className="w-full text-left p-3.5">
        <div className="grid grid-cols-[90px_130px_1fr_20px] gap-3 items-center text-[13px]">
          <div className={`text-[10px] font-medium uppercase tracking-wider px-2 py-[3px] rounded-md text-center ${meta.bg} ${meta.fg}`}>
            {meta.label}
          </div>
          <div className="text-[10px] uppercase tracking-wider font-mono text-ink-40">{issue.category}</div>
          <div className="font-medium text-[13px]">{issue.title}</div>
          <div className="text-ink-40 text-[14px]">{isExpanded ? "−" : "+"}</div>
        </div>
      </button>
      {isExpanded && (
        <div className="px-3.5 pb-3.5 pt-0 text-[12px] text-ink-60 leading-[1.6] border-t border-rule">
          <div className="mt-3 mb-2.5">
            <strong className="text-ink font-medium block mb-0.5">Found</strong>
            {issue.found}
          </div>
          <div className="bg-blue-50 border-l-2 border-blue-400 px-3 py-2 rounded-r-md text-blue-900">
            <strong className="font-medium block mb-0.5">Fix</strong>
            {issue.fix}
          </div>
          <div className="font-mono text-[10px] text-ink-40 mt-2">Rule · {issue.rule}</div>
        </div>
      )}
    </div>
  );
}

function formatReportText(r: AuditReport): string {
  const lines = [
    "EMBEECONTENTIQ DEEP AUDIT REPORT",
    "=".repeat(50),
    `Source: ${r.source}`,
    `Type: ${r.assetType}`,
    `Generated: ${r.generatedAt}`,
    `Score: ${r.score}/100 (${r.verdict})`,
    "",
    "SUB-SCORES",
    ...Object.entries(r.subScores).map(([k, v]) => `  ${k}: ${v}`),
    "",
    "STATS",
    `  Words: ${r.stats.words}  Sentences: ${r.stats.sentences}  Paragraphs: ${r.stats.paragraphs}`,
    `  Images: ${r.stats.images}  Internal links: ${r.stats.internalLinks}  External: ${r.stats.externalLinks}`,
    r.insights.flesch ? `  Flesch: ${r.insights.flesch}  Passive voice: ${r.insights.passiveVoicePct}%` : "",
    "",
    `ISSUES (${r.issues.length})`,
  ];
  r.issues.forEach((it, i) => {
    lines.push(`${i + 1}. [${it.severity.toUpperCase()}] ${it.category}: ${it.title}`);
    lines.push(`   Found: ${it.found}`);
    lines.push(`   Fix: ${it.fix}`);
    lines.push("");
  });
  if (r.aiRewrites?.headlines.length) {
    lines.push("HEADLINE REWRITES");
    r.aiRewrites.headlines.forEach((h, i) => lines.push(`${i + 1}. ${h}`));
    lines.push("");
  }
  if (r.aiRewrites?.metaDescription) {
    lines.push("META DESCRIPTION REWRITE");
    lines.push(r.aiRewrites.metaDescription);
  }
  return lines.join("\n");
}
