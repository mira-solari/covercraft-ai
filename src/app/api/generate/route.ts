import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import {
  getPurchaseFromRequest,
  getFreeCountFromRequest,
  isPurchaseValid,
  purchaseCookieHeader,
  freeCountCookieHeader,
  type PurchasePayload,
} from "@/lib/purchase";

function getGroqClient() {
  return new Groq({
    apiKey: process.env.GROQ_API_KEY || "",
  });
}

// Simple in-memory rate limiting (per IP, resets on deploy)
// Kept as a safety net against abuse even for paid users
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

const SYSTEM_PROMPT = `You are an expert cover letter writer. Your letters get people interviews because they sound genuinely human and answer the two questions every hiring manager asks:

1. "Why is this person right for US?" — What specific value will they bring?
2. "Why are WE right for this person?" — Why is this a genuine match, not just any job?

CRITICAL RULES — SOUND HUMAN, NOT LIKE AI:

NEVER use these AI-slop phrases (instant rejection by hiring managers):
- "I am writing to express my interest in..."
- "I am excited to apply for..."
- "I believe my skills align well with..."
- "I am passionate about..."
- "leverage my expertise"
- "I am confident that..."
- "thrilled at the opportunity"
- "unique blend of skills"
- "proven track record"
- Any phrase that parrots corporate jargon from the job description verbatim

DO NOT match the company's corporate voice. Real humans don't talk like job descriptions. Write like a smart, articulate person having a conversation — not like a corporate press release.

DO NOT just list keywords from the job description. Instead, tell SPECIFIC STORIES from the resume that demonstrate relevant capability. "I led the migration from monolith to microservices, cutting deploy time from 2 hours to 8 minutes" beats "I have extensive experience in system architecture" every time.

WHAT TO DO:
- Open with something specific that shows genuine knowledge of the company (a recent product launch, blog post, mission detail — NOT just quoting their job posting)
- Tell 1-2 concrete stories from the resume that directly answer "what will you do for us?"
- Show why this company specifically is a real match — why this role is the natural next step for this person
- Use first-person conversational language. Short sentences are fine. Fragments too, occasionally.
- Sound like someone who is genuinely good at their job and knows it — confident without being arrogant
- End with a specific, forward-looking statement about what you'd want to work on

FORMAT:
- 3-4 paragraphs, 250-350 words
- No header/addresses/dates — just the letter body
- No placeholder brackets — use actual names from the job description

The output should be ONLY the cover letter text. No explanations, no meta-commentary.`;

export async function POST(request: NextRequest) {
  try {
    const { resume, jobDescription, tone, whyCompany, whyYou } =
      await request.json();

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
    // Usage gating: check purchase cookie
    // -----------------------------------------------------------------------
    const cookieHeader = request.headers.get("cookie");
    const purchase = getPurchaseFromRequest(cookieHeader);
    const freeCount = getFreeCountFromRequest(cookieHeader);

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      "unknown";

    // Determine what tier the user is on and whether they can generate
    let updatedPurchase: PurchasePayload | null = null;
    let setCookieHeaders: string[] = [];

    if (purchase && isPurchaseValid(purchase)) {
      // Paid user — check their specific limits
      if (purchase.plan === "single") {
        const used = purchase.generationsUsed ?? 0;
        const allowed = purchase.generationsAllowed ?? 4;
        if (used >= allowed) {
          return NextResponse.json(
            {
              error: `You've used all ${allowed} generations on your Single plan. Upgrade to Pro for unlimited letters!`,
              limitReached: true,
              plan: "single",
            },
            { status: 403 }
          );
        }
        // Increment usage — will be set in cookie after generation
        updatedPurchase = {
          ...purchase,
          generationsUsed: used + 1,
        };
      } else if (purchase.plan === "pro") {
        // Pro has no generation limit, but apply a high rate limit as abuse protection
        if (!checkRateLimit(ip, 60)) {
          return NextResponse.json(
            { error: "Too many requests. Please wait a moment and try again." },
            { status: 429 }
          );
        }
        updatedPurchase = purchase; // No changes needed
      }
    } else {
      // Free tier — allow 1 generation total (tracked via cookie)
      if (freeCount >= 1) {
        return NextResponse.json(
          {
            error:
              "You've used your free cover letter. Upgrade to continue generating!",
            limitReached: true,
            plan: "free",
          },
          { status: 403 }
        );
      }

      // Also apply IP-based rate limiting as a safety net
      if (!checkRateLimit(ip, 5)) {
        return NextResponse.json(
          {
            error:
              "Rate limit exceeded. Upgrade to Pro for unlimited cover letters!",
          },
          { status: 429 }
        );
      }

      // Will increment free count after generation
      setCookieHeaders.push(freeCountCookieHeader(freeCount + 1));
    }

    // -----------------------------------------------------------------------
    // Generate the cover letter
    // -----------------------------------------------------------------------

    const toneInstructions: Record<string, string> = {
      professional:
        "Write in a polished, formal professional tone. Confident but not arrogant.",
      enthusiastic:
        "Write with genuine energy and passion. Show excitement about the role and company while remaining professional.",
      conversational:
        "Write in a friendly, approachable tone. Professional but warm, like talking to a respected colleague.",
    };

    let userPrompt = `TONE: ${toneInstructions[tone] || toneInstructions.professional}

CANDIDATE'S RESUME:
${resume}

JOB DESCRIPTION:
${jobDescription}`;

    if (whyCompany?.trim()) {
      userPrompt += `\n\nWHY THIS COMPANY (in the candidate's own words):
${whyCompany.trim()}`;
    }

    if (whyYou?.trim()) {
      userPrompt += `\n\nWHAT MAKES THIS CANDIDATE DIFFERENT (in their own words):
${whyYou.trim()}`;
    }

    userPrompt += `\n\nWrite the cover letter now. Remember: sound human, tell specific stories, answer "why them for us" and "why us for them."`;

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { error: "Service temporarily unavailable. Please try again later." },
        { status: 503 }
      );
    }

    const groq = getGroqClient();

    // Stream the response
    const stream = await groq.chat.completions.create({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_tokens: 2048,
      stream: true,
    });

    // If we need to update the purchase cookie (e.g., increment single usage),
    // add it to the response headers
    if (updatedPurchase) {
      const maxAge = updatedPurchase.plan === "pro" ? 35 : 365;
      setCookieHeaders.push(purchaseCookieHeader(updatedPurchase, maxAge));
    }

    // Create a readable stream
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    const headers = new Headers({
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "Transfer-Encoding": "chunked",
    });

    // Set all cookies
    for (const cookie of setCookieHeaders) {
      headers.append("Set-Cookie", cookie);
    }

    return new Response(readable, { headers });
  } catch (error: any) {
    console.error("Generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate cover letter. Please try again." },
      { status: 500 }
    );
  }
}
