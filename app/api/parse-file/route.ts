import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File exceeds 5 MB limit" }, { status: 413 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    let text = "";

    if (["txt", "md"].includes(ext)) {
      text = buf.toString("utf-8");
    } else if (["html", "htm"].includes(ext)) {
      const raw = buf.toString("utf-8");
      const cheerio = await import("cheerio");
      const $ = cheerio.load(raw);
      $("script, style, noscript").remove();
      text = $("body").text().replace(/\s+/g, " ").trim();
    } else if (ext === "pdf") {
      const pdfParse = (await import("pdf-parse")).default;
      const result = await pdfParse(buf);
      text = result.text;
    } else if (ext === "docx") {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer: buf });
      text = result.value;
    } else {
      return NextResponse.json(
        { error: `Unsupported file type: .${ext}. Use .txt, .md, .html, .pdf, or .docx` },
        { status: 415 }
      );
    }

    if (!text || text.trim().length < 10) {
      return NextResponse.json({ error: "File appears to be empty or unreadable" }, { status: 400 });
    }

    return NextResponse.json({
      text,
      filename: file.name,
      size: file.size,
      chars: text.length,
    });
  } catch (err: any) {
    console.error("Parse-file error:", err);
    return NextResponse.json(
      { error: err?.message || "Could not parse file" },
      { status: 500 }
    );
  }
}
