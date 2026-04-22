# EmbeeContentIQ

AI-powered content audit platform for Embee Software. Scans marketing assets (URLs, pasted text, or uploaded files) against Embee's canonical solution dictionary, brand voice, SEO standards, link hygiene, and CTA effectiveness. Returns a weighted score, prioritized issue list, keyword coverage table, and AI-generated headline / meta rewrites.

Built as a Next.js 14 app so the whole thing runs as a real deployable product — not a notebook or artifact. URL fetches happen on the server (no CORS issues), PDFs and DOCX files are parsed server-side, and AI enrichment runs through the Anthropic API.

## What it audits

- **Solution naming** — 22 rules covering Microsoft, SAP, Cybersecurity, and Embee-proprietary products. Flags variants like "Office 365" → Microsoft 365, "SAP BusinessOne" → SAP Business One, "WVD" → Azure Virtual Desktop.
- **Brand voice** — jargon detection, CXO-audience language, legal-name creep in body copy.
- **SEO** — title length, meta description length, H1 hygiene, schema markup, keyword placement.
- **Readability** — sentence length average, passive voice percentage.
- **Links** — internal linking density (for URL mode).
- **Conversion** — weak CTAs, missing proof points (2500+ orgs, 34+ years, Microsoft Partner of the Year, #1 APAC for SAP Business One).

## Tech stack

- **Framework** — Next.js 14 (App Router) + TypeScript
- **Styling** — Tailwind CSS with a custom editorial palette (warm paper, deep ink, amber signal)
- **AI** — Anthropic Claude Sonnet 4.5 via the official SDK
- **HTML parsing** — cheerio (server-side, no browser / Puppeteer needed)
- **File parsing** — pdf-parse for PDFs, mammoth for DOCX, native for text/markdown/HTML
- **Icons** — lucide-react
- **Fonts** — Fraunces (serif display), Inter Tight (sans body), IBM Plex Mono (numerics)

## Project layout

```
embee-app/
├── app/
│   ├── api/
│   │   ├── fetch-url/route.ts     # Server-side URL fetcher (solves CORS)
│   │   ├── parse-file/route.ts    # PDF / DOCX / HTML parser
│   │   └── audit/route.ts         # Main audit orchestrator
│   ├── components/
│   │   └── AuditClient.tsx        # All frontend UI
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   ├── dictionary.ts              # Canonical Embee solution dictionary
│   ├── engine.ts                  # Rule engine, keyword coverage, scoring
│   ├── parser.ts                  # HTML → ParsedContent
│   ├── anthropic.ts               # AI enrichment wrapper
│   └── types.ts
├── package.json
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
├── .env.example
└── README.md
```

## Run it locally

```bash
# Install
npm install

# Add your Anthropic key (optional — app runs without it, but no AI rewrites)
cp .env.example .env.local
# then edit .env.local and paste your key

# Start
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The URL tab will work against any public page — try the sample chips or paste any embee.co.in URL.

## Deploy

### Option 1 — Vercel (fastest)

```bash
npm install -g vercel
vercel
```

Follow the prompts. Add `ANTHROPIC_API_KEY` in the Vercel dashboard under Project Settings → Environment Variables. Redeploy.

### Option 2 — Azure App Service

Ships cleanly to Azure App Service on Node 20. Use the GitHub Actions deploy flow Azure generates when you create the App Service. Set `ANTHROPIC_API_KEY` in App Service → Configuration → Application settings. This path also aligns with Embee's own Azure practice — runs on the same infrastructure Embee deploys for customers.

### Option 3 — Docker / any Node host

```bash
npm run build
npm start
```

Runs on port 3000. Standard `next build` output. No external services required beyond the Anthropic API.

## Maintaining the solution dictionary

Edit `lib/dictionary.ts`. Three arrays:

- `SOLUTION_DICT` — approved names + variant spellings to flag. Add new Embee solutions here as they launch.
- `JARGON_PHRASES` — buzzwords that trigger the brand-voice warning.
- `PROOF_POINTS` — Embee-specific claims the rule engine expects to see on long-form content.

No rebuild needed in dev — Next.js hot-reloads. In production, redeploy to pick up changes.

## What's next

Everything here is MVP — single-asset audit with a polished surface. Phase 2 work maps directly onto the blueprint document:

- **Bulk audit** — sitemap crawler that runs the same pipeline across every URL in embee.co.in/sitemap.xml, produces a site-wide dashboard with worst-offending pages and score distribution.
- **WordPress integration** — read/write drafts through the WP REST API so the audit can push approved rewrites back to the CMS as draft revisions.
- **Brand Resource Center sync** — pull the canonical dictionary from the SharePoint Brand Resource Center via Microsoft Graph API on a schedule, so marketing stays the source of truth without touching code.
- **Historical tracking** — persist audits (Azure Cosmos DB) and show score trends per URL over time.
- **Approval workflow** — Author → Reviewer → Brand Lead → Publish gate.

## License

Internal use — Embee Software.
