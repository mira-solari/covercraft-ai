import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import {
  getPurchaseFromRequest,
  isPurchaseValid,
} from "@/lib/purchase";

function getGroqClient() {
  return new Groq({
    apiKey: process.env.GROQ_API_KEY || "",
  });
}

// Simple in-memory rate limiting (per IP, resets on deploy)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, maxRequests: number): boolean {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour

  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) {
    return false;
  }

  entry.count++;
  return true;
}

// ---------------------------------------------------------------------------
// System prompt for resume tailoring
// ---------------------------------------------------------------------------

const TAILOR_SYSTEM_PROMPT = `You are an expert resume consultant who tailors resumes to specific job descriptions. Your job is to reorganize and rephrase the candidate's existing resume to emphasize the most relevant experience for the target role.

ABSOLUTE RULES:
1. NEVER fabricate experience, skills, certifications, or achievements. Only reorganize and rephrase what the candidate actually has.
2. NEVER invent new bullet points, job titles, companies, or metrics that don't exist in the original resume.
3. You MAY rephrase existing bullet points to better highlight relevance to the job.
4. You MAY reorder sections and bullet points so the most relevant ones come first.
5. You MAY incorporate keywords from the job description into existing bullet points — but only when the candidate genuinely has that experience.
6. Keep the tailored resume under 600 words.

YOUR TASK:
Analyze the resume against the job description, then output EXACTLY this format:

---TAILORED_RESUME---
[The reorganized, tailored resume text. Maintain clear section headers like EXPERIENCE, SKILLS, EDUCATION. Lead each section with the most relevant items for this specific job. Rephrase bullet points to emphasize job-relevant impact.]

---SUGGESTIONS---
[Provide 3-5 specific, actionable suggestions as a numbered list. Each suggestion should be concrete and reference specific parts of the resume or job description. Examples of good suggestions:
- "Move your Python/Django experience to the top of your Skills section — the job lists it as a primary requirement"
- "Your bullet about reducing API latency by 40% maps directly to their 'performance optimization' requirement — consider expanding it"
- "The job emphasizes cross-functional collaboration — your project lead experience at Company X should be more prominent"
- "Add 'CI/CD' and 'infrastructure as code' to your skills — you mention using Jenkins and Terraform in your experience but don't list them as skills"
- "Consider removing the retail experience section to make room for more detail on your engineering roles"]

Do NOT include any other text, preamble, or commentary outside this format.`;

export async function POST(request: NextRequest) {
  try {
    const { resume, jobDescription } = await request.json();

    // Validation
    if (!resume || !jobDescription) {
      return NextResponse.json(
        { error: "Resume and job description are required" },
        { status: 400 }
      );
    }

    if (resume.length > 10000 || jobDescription.length > 10000) {
      return NextResponse.json(
        {
          error:
            "Input too long. Please keep each field under 10,000 characters.",
        },
        { status: 400 }
      );
    }

    // -----------------------------------------------------------------------
    // Pro-only gating: resume tailoring requires a Pro subscription
    // -----------------------------------------------------------------------
    const cookieHeader = request.headers.get("cookie");
    const purchase = getPurchaseFromRequest(cookieHeader);

    if (!purchase || !isPurchaseValid(purchase) || purchase.plan !== "pro") {
      return NextResponse.json(
        {
          error:
            "Resume tailoring is a Pro feature. Upgrade for $12/mo to get unlimited cover letters + resume tailoring.",
          requiresPro: true,
        },
        { status: 403 }
      );
    }

    // Rate limiting for Pro users (abuse protection)
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      "unknown";

    if (!checkRateLimit(ip, 30)) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment and try again." },
        { status: 429 }
      );
    }

    // -----------------------------------------------------------------------
    // Generate the tailored resume
    // -----------------------------------------------------------------------
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { error: "Service temporarily unavailable. Please try again later." },
        { status: 503 }
      );
    }

    const groq = getGroqClient();

    const userPrompt = `CANDIDATE'S CURRENT RESUME:
${resume}

TARGET JOB DESCRIPTION:
${jobDescription}

Analyze the resume against this job description. Produce a tailored version of the resume that emphasizes the most relevant experience, and provide 3-5 specific suggestions for improvement.`;

    const stream = await groq.chat.completions.create({
      messages: [
        { role: "system", content: TAILOR_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.5,
      max_tokens: 2048,
      stream: true,
    });

    // Buffer the full response then parse into sections
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          let fullText = "";
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              fullText += content;
            }
          }

          // Parse the response into tailored resume and suggestions
          const resumeMatch = fullText.match(
            /---TAILORED_RESUME---\s*([\s\S]*?)(?=---SUGGESTIONS---|$)/
          );
          const suggestionsMatch = fullText.match(
            /---SUGGESTIONS---\s*([\s\S]*?)$/
          );

          const result = JSON.stringify({
            tailoredResume: resumeMatch?.[1]?.trim() || fullText.trim(),
            suggestions: suggestionsMatch?.[1]?.trim() || "",
          });

          controller.enqueue(encoder.encode(result));
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error: unknown) {
    console.error("Resume tailoring error:", error);
    return NextResponse.json(
      { error: "Failed to tailor resume. Please try again." },
      { status: 500 }
    );
  }
}
