"use client";

import { useState } from "react";
import AuditClient from "./AuditClient";
import BulkAuditClient from "./BulkAuditClient";
import CompareClient from "./CompareClient";
import { Search, ListChecks, GitCompare } from "lucide-react";

type Mode = "single" | "bulk" | "compare";

export default function AppShell() {
  const [mode, setMode] = useState<Mode>("single");

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-8 pb-16">
      {/* Brand header */}
      <header className="flex items-start justify-between flex-wrap gap-4 pb-6 border-b border-rule mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-ink text-paper grid place-items-center font-mono font-medium">E</div>
          <div>
            <div className="text-[15px] font-medium">EmbeeContentIQ</div>
            <div className="text-[11px] text-ink-60 font-mono">v4.0 · Full audit · Bulk · Compare · GEO-ready</div>
          </div>
        </div>
        <div className="flex gap-6 text-[12px] text-ink-60">
          <div><strong className="text-ink">200+</strong> checks</div>
          <div><strong className="text-ink">9</strong> sub-scores</div>
          <div><strong className="text-ink">3</strong> modes</div>
        </div>
      </header>

      {/* Headline */}
      <div className="mb-6">
        <h1 className="font-serif text-[32px] leading-[1.1] font-medium tracking-[-0.02em] max-w-[720px] mb-2">
          Deep content audit with competitor intelligence and bulk sitemap scanning.
        </h1>
        <p className="text-[13px] text-ink-60 max-w-[640px] leading-[1.55]">
          Audit one asset, benchmark against competitors, or scan the entire embee.co.in sitemap in a single run. Checks SEO, technical, content, E-E-A-T, copywriting, linking, conversion, brand, and GEO (AI-search optimization).
        </p>
      </div>

      {/* Mode switcher — segmented tabs */}
      <div className="flex gap-1 p-[3px] bg-paper-2 rounded-lg w-fit mb-6 border border-rule">
        <ModeButton active={mode === "single"} onClick={() => setMode("single")} Icon={Search} label="Single audit" />
        <ModeButton active={mode === "bulk"} onClick={() => setMode("bulk")} Icon={ListChecks} label="Bulk / sitemap" />
        <ModeButton active={mode === "compare"} onClick={() => setMode("compare")} Icon={GitCompare} label="Competitor compare" />
      </div>

      {/* Body */}
      {mode === "single" && <AuditClient embedded />}
      {mode === "bulk" && <BulkAuditClient />}
      {mode === "compare" && <CompareClient />}

      <footer className="mt-12 pt-4 border-t border-rule text-[11px] font-mono text-ink-60 flex justify-between flex-wrap gap-2">
        <div>EmbeeContentIQ · Next.js 14 · Anthropic Claude · Embee Software Internal</div>
        <div>v4.0 — All stages (A + B + C)</div>
      </footer>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  Icon: any;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-[8px] text-[13px] font-medium rounded-md flex items-center gap-2 transition ${
        active ? "bg-white text-ink shadow-sm" : "text-ink-60 hover:text-ink"
      }`}
    >
      <Icon size={14} /> {label}
    </button>
  );
}
