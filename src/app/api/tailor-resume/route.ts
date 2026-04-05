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

const TAILOR_SYSTEM_PROMPT = `You are an expert resume consultant who tailors resumes to specific job descriptions. Your job is to reorganize and rephrase the candidate's EXISTING resume content to emphasize the most relevant experience for the target role.

HONESTY OVER OPTIMIZATION:
If the candidate lacks a key skill or experience the job requires, DO NOT rephrase existing experience to imply they have it. DO NOT convert a skill listing into fabricated experience bullets. A resume that honestly represents a candidate serves them better than one that gets them into an interview they can't pass. Acknowledge gaps in the GAPS section with specific recommendations for how to build that skill.

ABSOLUTE RULES — VIOLATIONS MAKE THE OUTPUT WORTHLESS:

1. ZERO FABRICATION. Every bullet point, skill, metric, certification, and achievement in the tailored resume MUST trace back to something explicitly stated in the original resume. If you cannot point to the source line, delete it.

2. SKILLS INTEGRITY. NEVER add, upgrade, or rename skills. If the resume says "Microsoft Excel", the tailored version says "Microsoft Excel" — not "Advanced Microsoft Excel", not "Expert Microsoft Excel". If a skill is not listed in the original resume, it does not appear in the tailored version. Skills can be REORDERED by relevance to the job, but never invented, inflated, or renamed.

3. NO ARGUMENTATIVE FILLER. NEVER append explanatory phrases to bullet points. Banned patterns include:
   - "demonstrating ability to..."
   - "showcasing ability to..." / "showcasing my ability to..."
   - "highlighting expertise in..."
   - "demonstrating proficiency in..."
   - "showcasing their/my..."
   Resume bullets state what was DONE and what RESULTED. They do not argue for their own relevance. Let the hiring manager draw the connection.

4. NO EXPERIENCE ALCHEMY. Do not convert a skill listing (e.g., "Skills: data analysis") into a fabricated experience bullet (e.g., "Conducted data-driven analysis to inform strategic decisions"). If it was listed as a skill, it stays a skill. If it was a bullet point, it stays a bullet point (rephrased for relevance is fine).

5. You MAY rephrase existing bullet points to use keywords from the job description — but ONLY when the candidate genuinely performed that work. Rephrasing means changing words, not changing meaning.

6. You MAY reorder sections and bullet points so the most relevant ones come first.

7. Keep the tailored resume under 600 words.

YOUR TASK:
Analyze the resume against the job description, then output EXACTLY this format with all three sections:

---TAILORED_RESUME---
[The reorganized, tailored resume text. Maintain clear section headers like EXPERIENCE, SKILLS, EDUCATION. Lead each section with the most relevant items for this specific job. Rephrase bullet points to emphasize job-relevant impact. NEVER add content that is not in the original resume.]

---GAPS---
[Honest assessment of what the job requires that the candidate currently lacks. Format as a numbered list. For each gap:
- Name the specific requirement from the job description
- Acknowledge that the candidate's resume does not show this
- Recommend a SPECIFIC action to address it (a course, a project, a certification — with concrete names when possible)
Example:
1. The job requires SQL and data querying experience. Your resume does not list this. Consider completing the "SQL for Data Science" course on Coursera or building a portfolio project that demonstrates basic querying skills.
2. The job asks for experience with A/B testing. This is not reflected in your resume. Consider running a small A/B test on a personal project and documenting the methodology and results.
If there are no meaningful gaps, write "No significant gaps identified — your background covers the core requirements."]

---SUGGESTIONS---
[Provide 3-5 specific, actionable suggestions for improving the resume. Each suggestion MUST be concrete and reference specific parts of the resume or job description.

SUGGESTION ETHICS: NEVER suggest the candidate list skills they do not have. Suggestions should recommend ACQUIRING new skills (courses, projects, certifications), REORDERING existing content, EXPANDING on existing bullets, or REMOVING irrelevant content. Never recommend pretending.

Good examples:
- "Move your Python/Django experience to the top of your Skills section — the job lists it as a primary requirement"
- "Your bullet about reducing API latency by 40% maps directly to their 'performance optimization' requirement — consider expanding it with more detail"
- "The job emphasizes cross-functional collaboration — your project lead experience at Company X should be more prominent"
- "You mention using Jenkins and Terraform in your experience bullets but don't list them in Skills — add them since you demonstrably have that experience"
- "Consider removing the retail experience section to make room for more detail on your engineering roles"

Bad examples (DO NOT do these):
- "Add SQL to your Technical Skills section, even if it's just a basic understanding" — NO, this advises listing a skill they don't have
- "Include experience with Agile methodologies" — NO, if they don't mention Agile, don't suggest adding it]

Do NOT include any other text, preamble, or commentary outside this format.`;

// ---------------------------------------------------------------------------
// Banned argumentative phrases — post-processing to catch what the model
// ignores in the system prompt. These patterns are resume-specific slop that
// pads bullet points with self-advocacy instead of stating results.
// ---------------------------------------------------------------------------

const RESUME_BANNED_PHRASES: readonly string[] = [
  "demonstrating ability to",
  "demonstrating my ability to",
  "demonstrating the ability to",
  "showcasing ability to",
  "showcasing my ability to",
  "showcasing their ability to",
  "highlighting expertise in",
  "highlighting my expertise in",
  "demonstrating proficiency in",
  "demonstrating my proficiency in",
  "showcasing my",
  "showcasing their",
  "demonstrating strong",
  "demonstrating expertise in",
  "demonstrating my expertise in",
  "illustrating ability to",
  "reflecting ability to",
  "underscoring ability to",
] as const;

/**
 * Strips banned argumentative phrases from resume tailoring output.
 * These phrases pad bullet points with self-advocacy filler.
 * Unlike the cover letter filter which rewrites, resume bullets are better
 * served by clean removal — the bullet should end at the result, not argue
 * for its relevance.
 */
function stripResumeBannedPhrases(text: string): {
  cleaned: string;
  stripCount: number;
} {
  let cleaned = text;
  let stripCount = 0;

  for (const phrase of RESUME_BANNED_PHRASES) {
    const regex = new RegExp(
      // Match ", <phrase> ..." or " — <phrase> ..." trailing a bullet point
      `(?:\\s*[,;]\\s*|\\s+—\\s+|\\s*-\\s+)${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^\\n]*`,
      "gi"
    );
    const before = cleaned;
    cleaned = cleaned.replace(regex, "");
    if (cleaned !== before) stripCount++;
  }

  // Also catch the pattern at the start of a continuation line:
  // "  demonstrating ability to manage..." as a standalone trailing line
  for (const phrase of RESUME_BANNED_PHRASES) {
    const regex = new RegExp(
      `^\\s*${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^\\n]*$`,
      "gim"
    );
    const before = cleaned;
    cleaned = cleaned.replace(regex, "");
    if (cleaned !== before) stripCount++;
  }

  // Clean up artifacts: double spaces, trailing commas before newlines,
  // empty lines left by removals
  cleaned = cleaned
    .replace(/ {2,}/g, " ")
    .replace(/,\s*\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { cleaned, stripCount };
}

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

Analyze the resume against this job description. Produce ALL THREE sections:
1. TAILORED_RESUME — reorganized and rephrased (from existing content ONLY — zero fabrication)
2. GAPS — honest list of what the job requires that the candidate lacks, with specific recommendations to build those skills
3. SUGGESTIONS — actionable improvements to the resume itself

Remember: If a skill, experience, or metric is not in the original resume, it MUST NOT appear in the tailored version. Put gaps in the GAPS section, not fabricated into the resume.`;

    const stream = await groq.chat.completions.create({
      messages: [
        { role: "system", content: TAILOR_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
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

          // Parse the response into tailored resume, gaps, and suggestions
          const resumeMatch = fullText.match(
            /---TAILORED_RESUME---\s*([\s\S]*?)(?=---GAPS---|---SUGGESTIONS---|$)/
          );
          const gapsMatch = fullText.match(
            /---GAPS---\s*([\s\S]*?)(?=---SUGGESTIONS---|$)/
          );
          const suggestionsMatch = fullText.match(
            /---SUGGESTIONS---\s*([\s\S]*?)$/
          );

          // Post-process: strip banned argumentative phrases from the
          // tailored resume section
          let tailoredResume = resumeMatch?.[1]?.trim() || fullText.trim();
          const { cleaned, stripCount } =
            stripResumeBannedPhrases(tailoredResume);
          tailoredResume = cleaned;

          if (stripCount > 0) {
            console.warn(
              `[ApplyFaster] Resume tailoring: stripped ${stripCount} banned argumentative phrase patterns from output.`
            );
          }

          const result = JSON.stringify({
            tailoredResume,
            gaps: gapsMatch?.[1]?.trim() || "",
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
