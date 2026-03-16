import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Check file type
    const allowedTypes = [
      "application/pdf",
      "text/plain",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!allowedTypes.includes(file.type) && !file.name.endsWith(".pdf") && !file.name.endsWith(".txt")) {
      return NextResponse.json(
        { error: "Please upload a PDF, TXT, or DOCX file." },
        { status: 400 }
      );
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large. Max 5MB." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    let text = "";

    if (file.type === "text/plain" || file.name.endsWith(".txt")) {
      text = buffer.toString("utf-8");
    } else if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
      // Dynamic import for pdf-parse
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require("pdf-parse");
      const data = await pdfParse(buffer);
      text = data.text;
    } else {
      // For DOCX, extract basic text (simplified)
      // Full DOCX parsing would need mammoth or similar
      text = buffer.toString("utf-8").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      if (text.length < 50) {
        return NextResponse.json(
          { error: "Could not extract text from this file. Please try PDF or paste your resume directly." },
          { status: 400 }
        );
      }
    }

    if (!text || text.trim().length < 20) {
      return NextResponse.json(
        { error: "Could not extract text from this file. Please try a different file or paste your resume directly." },
        { status: 400 }
      );
    }

    return NextResponse.json({ text: text.trim() });
  } catch (error: any) {
    console.error("Resume parse error:", error);
    return NextResponse.json(
      { error: "Failed to parse resume. Please try pasting your resume directly." },
      { status: 500 }
    );
  }
}
