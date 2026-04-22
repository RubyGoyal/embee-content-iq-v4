import { NextRequest, NextResponse } from "next/server";
import { parseHTML } from "@/lib/parser";

export const runtime = "nodejs";
export const maxDuration = 30;

const USER_AGENT =
  "Mozilla/5.0 (compatible; EmbeeContentIQ/1.0; +https://embee.co.in)";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL required" }, { status: 400 });
    }
    if (!/^https?:\/\//i.test(url)) {
      return NextResponse.json(
        { error: "URL must start with http:// or https://" },
        { status: 400 }
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        redirect: "follow",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: `Page returned HTTP ${res.status}` },
        { status: 502 }
      );
    }

    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("html") && !ct.includes("text")) {
      return NextResponse.json(
        { error: `Unsupported content-type: ${ct}` },
        { status: 415 }
      );
    }

    const html = await res.text();
    if (html.length > 5_000_000) {
      return NextResponse.json({ error: "Page too large (>5MB)" }, { status: 413 });
    }

    const parsed = parseHTML(html, url);
    return NextResponse.json({ parsed, finalUrl: res.url });
  } catch (err: any) {
    const msg = err?.name === "AbortError" ? "Request timed out after 20s" : err?.message || "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
