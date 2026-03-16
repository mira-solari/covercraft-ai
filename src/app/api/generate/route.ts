import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Simple in-memory rate limiting (per IP, resets on deploy)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour
  const maxRequests = 5; // 5 per hour for free tier

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

const SYSTEM_PROMPT = `You are CoverCraft AI, an expert cover letter writer with 20 years of experience in HR and recruiting.

Your job is to write a compelling, tailored cover letter based on the candidate's resume and the job description provided.

RULES:
1. The cover letter MUST specifically reference details from both the resume AND the job description
2. Map the candidate's specific experiences and skills to the job requirements
3. Use concrete examples and achievements from the resume — never invent or fabricate details
4. Keep it to 3-4 paragraphs, approximately 250-350 words
5. Start with a compelling hook — NOT "I am writing to apply for..."
6. End with a confident call to action
7. Match the requested tone while remaining professional
8. Do NOT include placeholder brackets like [Company Name] — use the actual company/role name from the job description
9. Do NOT include a header with addresses/dates — just the letter body
10. Write as the candidate (first person), not about them

FORMAT:
- Opening paragraph: Hook + why you're excited about this specific role
- Middle paragraph(s): Your most relevant experience mapped to their requirements
- Closing paragraph: Summary of value + call to action

The output should be ONLY the cover letter text. No explanations, no meta-commentary.`;

export async function POST(request: NextRequest) {
  try {
    const { resume, jobDescription, tone } = await request.json();

    // Validation
    if (!resume || !jobDescription) {
      return NextResponse.json(
        { error: "Resume and job description are required" },
        { status: 400 }
      );
    }

    if (resume.length > 10000 || jobDescription.length > 10000) {
      return NextResponse.json(
        { error: "Input too long. Please keep each field under 10,000 characters." },
        { status: 400 }
      );
    }

    // Rate limiting
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      "unknown";

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        {
          error:
            "Rate limit exceeded. Upgrade to Pro for unlimited cover letters!",
        },
        { status: 429 }
      );
    }

    const toneInstructions: Record<string, string> = {
      professional:
        "Write in a polished, formal professional tone. Confident but not arrogant.",
      enthusiastic:
        "Write with genuine energy and passion. Show excitement about the role and company while remaining professional.",
      conversational:
        "Write in a friendly, approachable tone. Professional but warm, like talking to a respected colleague.",
    };

    const userPrompt = `TONE: ${toneInstructions[tone] || toneInstructions.professional}

CANDIDATE'S RESUME:
${resume}

JOB DESCRIPTION:
${jobDescription}

Write the cover letter now.`;

    // Stream the response
    const stream = await groq.chat.completions.create({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_tokens: 1024,
      stream: true,
    });

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

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error: any) {
    console.error("Generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate cover letter. Please try again." },
      { status: 500 }
    );
  }
}
