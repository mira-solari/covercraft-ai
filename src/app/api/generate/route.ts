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

// ---------------------------------------------------------------------------
// Banned phrases — post-processing to catch what the model ignores
// ---------------------------------------------------------------------------

const BANNED_PHRASES: readonly string[] = [
  "i'm excited",
  "i am excited",
  "i'm confident",
  "i am confident",
  "i'm eager",
  "i am eager",
  "i'm thrilled",
  "i am thrilled",
  "i'm impressed",
  "i am impressed",
  "i'm passionate",
  "i am passionate",
  "i believe my skills",
  "leverage my expertise",
  "unique blend",
  "proven track record",
  "push the boundaries",
  "pushing the boundaries",
  "meaningful impact",
  "significant impact",
  "looking forward to the opportunity to discuss",
  "looking forward to discussing",
  "i'm looking forward to",
  "i am looking forward to",
  "i'd love the opportunity",
  "resonate with me",
  "resonates with me",
  "align well with",
  "aligns well with",
  "great fit for this role",
  "strong fit for this role",
  "strong candidate for this role",
  "will serve me well",
  "can be applied to",
  "could be applied to",
  "will also be an asset",
  "would be an asset",
  "could be an asset",
  "this experience taught me",
  "this taught me",
  "given my experience",
  "showcasing my ability",
  "signals a significant shift",
  "has given me a unique understanding",
  "understand the intricacies of",
  "aligns with the requirements",
  "will be crucial",
  "data-driven decision-making",
  "strategic growth initiatives",
  "navigating the complexities",
  "actionable recommendations",
  "can inform",
  "will enable me to",
  "will be valuable in",
] as const;

/**
 * Rewrites banned AI-slop phrases with natural alternatives.
 * Falls back to removal when no clean rewrite is possible.
 */
function rewriteBannedPhrases(text: string): {
  cleaned: string;
  rewriteCount: number;
} {
  let cleaned = text;
  let rewriteCount = 0;

  // Map of patterns to their replacements.
  // null means remove the entire sentence containing the phrase.
  const rewrites: Array<{ pattern: RegExp; replacement: string | null }> = [
    // "I'm excited to [verb]" -> "I [verb]" (preserve the action) — must run BEFORE the broader pattern
    {
      pattern: /I(?:'m|'m| am) excited to /gi,
      replacement: "I ",
    },
    // "I'm excited about/by/for the prospect/opportunity of X" -> strip preamble
    {
      pattern:
        /I(?:'m|'m| am) excited (?:about |by |for )?(?:the (?:prospect|opportunity) (?:of |to ))?/gi,
      replacement: "",
    },
    // "I'm confident that X" -> just "X"
    {
      pattern: /I(?:'m|'m| am) confident (?:that |in )?/gi,
      replacement: "",
    },
    // "I'm eager to X" -> "I want to X"
    {
      pattern: /I(?:'m|'m| am) eager to/gi,
      replacement: "I want to",
    },
    // "I'm thrilled at/by the opportunity" -> remove
    {
      pattern: /I(?:'m|'m| am) thrilled (?:at|by|about) (?:the opportunity )?/gi,
      replacement: "",
    },
    // "I'm impressed by X" -> "X stands out" or remove
    {
      pattern: /I(?:'m|'m| am) impressed (?:by|with) /gi,
      replacement: "",
    },
    // "I'm passionate about" -> remove
    {
      pattern: /I(?:'m|'m| am) passionate about /gi,
      replacement: "",
    },
    // "I believe my skills" -> "My skills"
    {
      pattern: /I believe (?:that )?my/gi,
      replacement: "My",
    },
    // "leverage my expertise" -> "apply what I know"
    {
      pattern: /leverage my expertise/gi,
      replacement: "apply what I know",
    },
    // "unique blend" -> "combination"
    { pattern: /unique blend/gi, replacement: "combination" },
    // "proven track record" -> "track record"
    { pattern: /proven track record/gi, replacement: "track record" },
    // "push(ing) the boundaries (of what's possible in X)" -> remove whole clause
    // Also catch "that is pushing..." and "is pushing..."
    {
      pattern:
        /(?:that is |is )?push(?:ing)? the boundaries(?: of (?:what(?:'s|'s| is) possible(?: in)?)?[^,.]*)?\.?\s?/gi,
      replacement: "",
    },
    // "meaningful/significant impact" -> "a difference"
    {
      pattern: /(?:meaningful|significant) impact/gi,
      replacement: "a difference",
    },
    // Full filler closings — remove the whole sentence including leading context
    // Use [^.\n]* instead of [^.]* to avoid crossing paragraph boundaries
    {
      pattern:
        /[^.\n]*I(?:'m|'m| am) looking forward to [^.\n]*\.\s?/gi,
      replacement: "",
    },
    // "resonate(s) with me" -> "matters to me"
    {
      pattern: /resonates? with me/gi,
      replacement: "matters to me",
    },
    // "align(s) well with" -> "match(es)"
    { pattern: /aligns? well with/gi, replacement: "matches" },
    // "... make(s) me a great/strong fit/candidate for [role/company]" -> remove whole sentence
    // Use [^.\n]* instead of [^.]* to avoid crossing paragraph boundaries
    {
      pattern:
        /[^.\n]*(?:make(?:s)? me a |(?:a |am a ))(?:great|strong) (?:fit|candidate) for [^.\n]*\.\s?/gi,
      replacement: "",
    },
    // "I'd love the opportunity" -> "I'd like"
    {
      pattern: /I(?:'d|'d| would) love the opportunity to/gi,
      replacement: "I'd like to",
    },
    // "will serve me well" -> "applies here"
    {
      pattern: /will serve me well/gi,
      replacement: "applies here",
    },
    // "can/could/would be applied to" -> "maps to"
    {
      pattern: /(?:can|could|would|should) be applied to/gi,
      replacement: "maps to",
    },
    // "will also be an asset" / "would be an asset" / "could be an asset" -> "matters here"
    {
      pattern: /(?:will also be|would be|could be|will be) an asset/gi,
      replacement: "matters here",
    },
    // "this experience taught me" / "this taught me" -> remove preamble
    {
      pattern: /this (?:experience )?taught me (?:the (?:value|importance) of )?/gi,
      replacement: "",
    },
    // "given my experience" -> "from"
    {
      pattern: /given my experience (?:in |with )?/gi,
      replacement: "from my work in ",
    },
    // "showcasing my ability to" -> "I can"
    {
      pattern: /showcasing my ability to/gi,
      replacement: "showing I can",
    },
    // "signals a significant shift" -> "marks a shift"
    {
      pattern: /signals a significant shift/gi,
      replacement: "marks a shift",
    },
    // "has given me a unique understanding" -> "means I understand"
    {
      pattern: /has given me a unique understanding/gi,
      replacement: "means I understand",
    },
    // "understand the intricacies of" -> "understand"
    {
      pattern: /understand the intricacies of/gi,
      replacement: "understand",
    },
    // "aligns with the requirements for this role" -> "fits what you need"
    {
      pattern: /aligns with the requirements (?:for|of) this role/gi,
      replacement: "fits what you need",
    },
    // "will be crucial" -> "matters"
    {
      pattern: /will be crucial/gi,
      replacement: "matters",
    },
    // "data-driven decision-making" -> "using data to decide"
    {
      pattern: /data-driven decision[- ]making/gi,
      replacement: "using data to decide",
    },
    // "strategic growth initiatives" -> "growth work"
    {
      pattern: /strategic growth initiatives/gi,
      replacement: "growth work",
    },
    // "navigating the complexities (of)" -> "working through"
    {
      pattern: /navigating the complexities(?: of)?/gi,
      replacement: "working through",
    },
    // "actionable recommendations" -> "clear recommendations"
    {
      pattern: /actionable recommendations/gi,
      replacement: "clear recommendations",
    },
    // "can inform [Company]'s" -> "can shape [Company]'s"
    {
      pattern: /can inform\b/gi,
      replacement: "can shape",
    },
    // "will enable me to" -> "lets me"
    {
      pattern: /will enable me to/gi,
      replacement: "lets me",
    },
    // "will be valuable in" -> "helps with"
    {
      pattern: /will be valuable in/gi,
      replacement: "helps with",
    },
  ];

  for (const { pattern, replacement } of rewrites) {
    const before = cleaned;
    if (replacement === null) {
      // Remove entire sentences containing the pattern
      cleaned = cleaned.replace(
        new RegExp(`[^.]*${pattern.source}[^.]*\\.\\s*`, pattern.flags),
        ""
      );
    } else {
      cleaned = cleaned.replace(pattern, replacement);
    }
    if (cleaned !== before) rewriteCount++;
  }

  // Clean up artifacts from phrase removal — process per-paragraph to
  // preserve intentional paragraph breaks (double newlines).
  cleaned = cleaned
    .split(/\n\n+/)
    .map((para) =>
      para
        // Ensure space after period (sentence removals can leave ".NextSentence")
        .replace(/\.([A-Z])/g, ". $1")
        // Remove sentences that became empty or near-empty after rewriting
        // (e.g., "my skills ." after both rewrites strip the sentence)
        .replace(/(?:^|\.\s+)[A-Za-z]{0,3}\s*\./g, ".")
        // Remove orphaned sentence fragments (just punctuation or 1-2 words)
        .replace(/\.\s*\./g, ".")
        // "to make a a difference" -> "to make a difference"
        .replace(/\ba a\b/g, "a")
        // Double spaces
        .replace(/ {2,}/g, " ")
        // Remove orphaned "And" at start of sentence after phrase removal
        // NOTE: "To" intentionally excluded — "To [verb]" is a legitimate purpose clause
        .replace(/\.\s+And\s+/g, ". ")
        // Capitalize after period if removal left lowercase start
        // (MUST run AFTER And/To removal which can create new lowercase-after-period)
        .replace(/\.\s+([a-z])/g, (_match, letter: string) =>
          `. ${letter.toUpperCase()}`
        )
        // Leading spaces on lines
        .replace(/^\s+/gm, "")
        .trim()
    )
    // Drop paragraphs that became empty after cleanup
    .filter((para) => para.length > 0)
    .join("\n\n")
    .trim();

  return { cleaned, rewriteCount };
}

/**
 * Counts remaining banned phrases after rewriting (for logging).
 */
function countRemainingBanned(text: string): string[] {
  const lower = text.toLowerCase();
  return BANNED_PHRASES.filter((phrase) => lower.includes(phrase));
}

// ---------------------------------------------------------------------------
// Seniority detection — adjusts prompt voice based on career level
// ---------------------------------------------------------------------------

type SeniorityLevel = "junior" | "mid" | "senior" | "executive";

function detectSeniority(resume: string): {
  level: SeniorityLevel;
  yearsEstimate: number;
} {
  const lower = resume.toLowerCase();

  // Check for executive-level signals
  const executiveTitles =
    /\b(cto|cfo|ceo|coo|cio|cmo|vp |vice president|svp |evp |chief |head of engineering|head of product|head of design|managing director|partner at|general manager)\b/i;
  const isExecutive = executiveTitles.test(resume);

  // Check for senior-level signals
  const seniorTitles =
    /\b(senior|sr\.|staff|principal|lead|architect|director|manager|team lead)\b/i;
  const isSeniorTitle = seniorTitles.test(resume);

  // Estimate years of experience from date ranges
  const yearMatches = resume.match(/20\d{2}|19\d{2}/g);
  let yearsEstimate = 0;
  if (yearMatches && yearMatches.length >= 2) {
    const years = yearMatches.map(Number).sort((a, b) => a - b);
    const currentYear = new Date().getFullYear();
    const earliest = years[0];
    yearsEstimate = currentYear - earliest;
  }

  // Count distinct company/role entries as a proxy
  const roleIndicators = (
    lower.match(/\b(at|@)\s+\w+/g) || []
  ).length;

  // Count management signals
  const managementSignals = (
    lower.match(
      /\b(led|managed|directed|oversaw|grew|scaled|built a team|hired|mentored|org of|reports)\b/g
    ) || []
  ).length;

  if (isExecutive || (yearsEstimate >= 12 && managementSignals >= 3)) {
    return { level: "executive", yearsEstimate };
  }

  if (
    isSeniorTitle ||
    yearsEstimate >= 7 ||
    (roleIndicators >= 3 && managementSignals >= 2)
  ) {
    return { level: "senior", yearsEstimate };
  }

  if (yearsEstimate >= 3 || roleIndicators >= 2) {
    return { level: "mid", yearsEstimate };
  }

  return { level: "junior", yearsEstimate };
}

// ---------------------------------------------------------------------------
// System prompt — rewritten with few-shot examples and structural variety
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT_BASE = `You write cover letters that get interviews. Every letter must answer two questions:

1. "Why is this person right for US?" — specific value they will bring.
2. "Why are WE right for this person?" — why this is a genuine match, not just any job.

ABSOLUTE RULES — VIOLATIONS MAKE THE LETTER WORTHLESS:

FORBIDDEN PHRASES — using any of these means instant rejection. Do NOT write them. Do NOT rephrase them. Simply avoid the sentiment entirely:
- "I'm excited" / "I am excited" (in ANY form — "excited about," "excited to," "excited for")
- "I'm confident" / "I am confident"
- "I'm eager" / "I am eager"
- "I'm thrilled" / "thrilled at the opportunity"
- "I'm passionate about" / "I am passionate"
- "I'm impressed by" / "I am impressed"
- "I believe my skills align"
- "leverage my expertise"
- "unique blend of skills"
- "proven track record"
- "push(ing) the boundaries"
- "meaningful impact" / "significant impact"
- "I'm looking forward to discussing" / "looking forward to the opportunity"
- "resonate(s) with me"
- "align(s) well with"
- "strong/great fit for this role"
- "will serve me well"
- "can be applied to"
- "will be crucial"
- "data-driven decision-making"
- "strategic growth initiatives"
- "navigating the complexities"
- "actionable recommendations"
- "can inform [Company]'s"
- "will enable me to"
- "will be valuable in"

Instead of saying you're excited/confident/eager, SHOW it through specific knowledge and concrete plans. "Your recent move into enterprise AI data with the DoD contract tells me Scale needs someone who's built FedRAMP-compliant pipelines — I did exactly that at Cloudflare" conveys excitement through specificity.

FORBIDDEN STRUCTURE — do NOT write a 4-paragraph letter that follows this template:
1. Company praise + funding mention
2. One resume story
3. "What draws me to [Company]..."
4. "I'm looking forward to discussing..."

Paragraph 4 as described above is PURE FILLER. Never write it. End with substance — a specific idea, a question, a concrete next step.

WHAT TO DO:
- Open with a HOOK that shows real knowledge: a technical insight, a product observation, a trend the company is riding. NOT "I've been following [Company]'s impressive growth."
- Mine 2-3 stories from the resume, including ones that aren't the most obvious. Look for strategic differentiators — unusual projects, cross-functional wins, unique credentials.
- Connect resume stories DIRECTLY to job requirements with specifics. Name the tech stack, the scale, the business outcome.
- Write in first person. Short sentences. Fragments occasionally. No corporate jargon.
- End with something specific you'd want to build, fix, or explore at the company. Not a generic "let's chat."

STRUCTURAL VARIETY — use one of these structures (pick the best fit, don't always use the same one):

Structure A (Hook + Two Stories):
- Hook showing company knowledge → Story 1 mapped to their need → Story 2 mapped to another need → Specific thing you'd want to work on there

Structure B (Problem-Solution):
- Identify a challenge the company faces (from job description or public info) → Show how your experience solves it with 2 examples → Why you specifically want to solve this problem at this company

Structure C (Narrative Thread):
- One connecting theme that links your background to their mission → Weave 2-3 resume details into that narrative → Close with how that theme plays out in this role

FORMAT:
- 2-3 paragraphs, 200-250 words. HARD MAXIMUM: 250 words. Shorter is better. Every sentence must earn its place.
- PARAGRAPH SEPARATION: Each paragraph MUST be separated by exactly one blank line (two newline characters). Never run paragraphs together. Every paragraph must start on its own line after a blank line.
- No header/addresses/dates — just the letter body.
- No placeholder brackets — use actual names from the job description.

Output ONLY the cover letter text. No explanations, no meta-commentary, no "Here is your cover letter."`;

const FEW_SHOT_JUNIOR = `
EXAMPLE — Junior candidate (new grad applying for SWE role):

"Netflix processes 80% of user engagement through recommendations — and at Rakuten, I built something similar at smaller scale. Our transformer-based engine increased click-through rates by 28% and added $15M in quarterly GMV across Rakuten Ichiba. The core challenge was the same one Netflix faces: making sense of billions of signals to surface the right content.

What I'd bring is practical ML pipeline experience at real scale. At Sony AI, I optimized inference by combining quantization and model pruning to cut latency by 60% — the kind of unsexy-but-critical work that makes recommendation systems actually usable at Netflix's throughput. I've also published at RecSys and ACL, so I can contribute to research alongside shipping production models.

One thing I'd want to dig into: Netflix operates across 190+ countries, and my cross-lingual transfer learning research maps directly to multilingual recommendation challenges. I have specific ideas about how attention mechanisms could improve cold-start performance for non-English content catalogs."

Notice: No "I'm excited." No "I'm confident." No filler closing. Opens with a technical hook. Ends with a specific idea. 170 words.`;

const FEW_SHOT_SENIOR = `
EXAMPLE — Senior/executive candidate (VP Engineering applying for CTO):

"Scale AI's $1B round and the DoD data-labeling contract signal a shift from startup to platform company — a transition I've led before. At Datadog, I took the engineering org from 85 to 180 people while migrating from monolith to service-oriented architecture handling 40 trillion data points daily. Attrition stayed below 8% through that upheaval because I built a culture where senior ICs had real ownership, not just titles.

The CTO role here requires someone who can hold both the technical architecture and the org design in their head simultaneously. I've done this at three companies now. At Cloudflare, I launched the Workers platform from zero to 500K developers. At Google, I was an early engineer on DynamoDB. Each time, the hard part wasn't the technology — it was building the team and systems that let the technology compound. I also led M&A technical due diligence for two acquisitions at Datadog, which maps directly to Scale's growth-by-acquisition strategy.

The specific problem I'd want to own first: your platform reliability during the enterprise push. I cut infrastructure costs by $12M at Datadog during a similar scaling phase. The playbook is similar, but Scale's data pipeline complexity makes it a harder and more interesting problem."

Notice: No "I'm excited." No hedging. Authoritative, direct. Leads with strategic insight about the company's trajectory. Names specific scale numbers. Ends with a concrete plan, not a request for a meeting. 220 words.`;

// Seniority-specific voice instructions
const SENIORITY_INSTRUCTIONS: Record<SeniorityLevel, string> = {
  junior: `SENIORITY CONTEXT: This candidate is early-career (junior level). Write with:
- Competent confidence, not false modesty or puppy-dog eagerness
- Emphasis on specific technical skills, projects, and what they built
- Frame internships and projects as real work with real outcomes
- Show they can contribute immediately, not that they're "eager to learn"
- Do NOT use words like "eager," "opportunity to learn," or "grow" — those signal junior insecurity. Instead, show capability through specifics.`,

  mid: `SENIORITY CONTEXT: This candidate is mid-career (3-7 years experience). Write with:
- Matter-of-fact competence — they've shipped things, they know what works
- Emphasis on scope of impact: team-level wins, cross-functional projects
- Connect the dots between their trajectory and why this role is the logical next step
- Balance technical depth with emerging leadership signals`,

  senior: `SENIORITY CONTEXT: This candidate is senior (7+ years, senior/staff/lead titles). Write with:
- Authoritative voice — they are evaluating the company as much as the company evaluates them
- Emphasis on strategic impact: org-level decisions, architecture choices, business outcomes
- Show pattern recognition: "I've seen this problem before at [Company] and here's how I solved it"
- The letter should read like a peer conversation with the hiring manager, not an application`,

  executive: `SENIORITY CONTEXT: This candidate is executive-level (VP/C-suite, 12+ years). This is NOT a job application — it is a peer-to-peer letter to the CEO or board. Write accordingly:

TONE AND STANCE:
- This person is a peer of the CEO. The letter should read like one executive writing to another about a shared challenge — not a candidate trying to prove themselves.
- Gravitas, not eagerness. Calm authority, not enthusiasm. Think Warren Buffett's shareholder letters: measured, direct, certain.
- NEVER justify qualifications. NEVER list tools, frameworks, or tactical skills. An executive does not mention that they know Excel or Salesforce.
- No hedging ("I believe," "I feel," "I think I could"). Use declarative statements: "The path forward is..." / "What this role requires is..." / "I built..."

CONTENT — WHAT TO WRITE:
- Lead with a strategic perspective on the company's trajectory, market position, or an industry shift. Show board-level thinking.
- Convey a leadership PHILOSOPHY — how they build organizations, how they think about growth, culture, or transformation — not a list of achievements.
- Reference outcomes at the scale executives operate: revenue, org size, market entry, M&A, board governance, capital allocation.
- Connect their experience to the company's FUTURE, not its current job requirements. Executives shape the role; they don't fit into it.
- End with a point of view on where the company should go — a strategic thesis, not a request for a meeting.

WHAT TO AVOID:
- NEVER list specific tools, technologies, or tactical plans. Executives set direction; teams choose tools.
- NEVER use eager/excited/passionate/looking forward — these are catastrophically wrong for this level.
- NEVER frame the letter as "why I'm qualified." Frame it as "here is what I see and what I would do."
- NEVER write "I would bring" or "my skills include" — this is mid-level framing. Instead: "At [Company], I drove..." or "The playbook for this is..."
- Do not mention certifications, specific software, or technical stacks unless they are truly strategic (e.g., "led the AWS-to-GCP migration" is fine; "proficient in Python" is not).`,
};

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
    // Detect seniority and build dynamic system prompt
    // -----------------------------------------------------------------------
    const { level: seniorityLevel } = detectSeniority(resume);

    // Pick the right few-shot example based on seniority
    const fewShotExample =
      seniorityLevel === "executive" || seniorityLevel === "senior"
        ? FEW_SHOT_SENIOR
        : FEW_SHOT_JUNIOR;

    const systemPrompt = [
      SYSTEM_PROMPT_BASE,
      fewShotExample,
      SENIORITY_INSTRUCTIONS[seniorityLevel],
    ].join("\n\n");

    // -----------------------------------------------------------------------
    // Generate the cover letter
    // -----------------------------------------------------------------------

    const toneInstructions: Record<string, string> = {
      professional:
        `TONE: PROFESSIONAL — polished and authoritative.
SYNTAX RULES:
- Complete sentences only. No fragments.
- Minimal contractions (use "I have" not "I've", "I would" not "I'd").
- Average sentence length: 15-25 words.
- Let achievements speak without enthusiasm markers.
- Measured, confident voice. Think senior professional writing to a peer.`,
      enthusiastic:
        `TONE: ENTHUSIASTIC — energetic through specificity, not adjectives.
SYNTAX RULES:
- USE CONTRACTIONS: "I've", "I'd", "that's", "it's" — mandatory, at least 3 total.
- Mix short punchy sentences (5-10 words) with longer ones. Vary rhythm.
- Start at least one sentence with an action verb ("Built", "Led", "Shipped").
- Use dashes (—) for energetic asides at least once.
- Show excitement through DEPTH OF KNOWLEDGE about the company, not emotion words.
- NEVER use "excited", "thrilled", "passionate", "eager" — these are BANNED.
- End with a specific idea or plan, stated with forward momentum.`,
      conversational:
        `TONE: CONVERSATIONAL — like a smart person talking to a respected peer over coffee.
SYNTAX RULES:
- USE CONTRACTIONS EVERYWHERE: "I've", "I'd", "that's", "it's", "I'm", "don't" — mandatory.
- Allow sentence fragments. "Which is exactly the problem you're solving."
- Start at least 2 sentences with "And" or "But".
- Use "you" or "your" to address the reader directly at least twice.
- Keep most sentences under 15 words. If it sounds like a press release, rewrite it.
- Read-aloud test: every sentence must sound natural spoken aloud.
- Use contractions in EVERY paragraph — if a paragraph has zero contractions, rewrite it.`,
    };

    let userPrompt = `TONE: ${toneInstructions[tone] || toneInstructions.professional}

CANDIDATE'S RESUME:
${resume}

JOB DESCRIPTION:
${jobDescription}`;

    if (whyCompany?.trim()) {
      userPrompt += `\n\nWHY THIS COMPANY (in the candidate's own words — weave this in, it's their authentic voice):
${whyCompany.trim()}`;
    }

    if (whyYou?.trim()) {
      userPrompt += `\n\nWHAT MAKES THIS CANDIDATE DIFFERENT (in their own words — this is gold, use it prominently):
${whyYou.trim()}`;
    }

    userPrompt += `\n\nWrite the cover letter now. 200-250 words max. Remember:
- Zero banned phrases (no "excited," "confident," "looking forward to discussing")
- Open with a specific hook, not "I've been following [Company]"
- Mine 2-3 stories from the resume including non-obvious differentiators
- End with substance (a specific idea or plan), NOT "I'd love to discuss"`;

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { error: "Service temporarily unavailable. Please try again later." },
        { status: 503 }
      );
    }

    const groq = getGroqClient();

    // Stream the response, but buffer it for post-processing
    const stream = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_tokens: 1536,
      stream: true,
    });

    // If we need to update the purchase cookie (e.g., increment single usage),
    // add it to the response headers
    if (updatedPurchase) {
      const maxAge = updatedPurchase.plan === "pro" ? 35 : 365;
      setCookieHeaders.push(purchaseCookieHeader(updatedPurchase, maxAge));
    }

    // Buffer the full response, then post-process banned phrases before
    // streaming to the client. We collect all chunks first because regex
    // rewrites need the complete text.
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

          // Post-process: rewrite banned phrases
          const { cleaned, rewriteCount } = rewriteBannedPhrases(fullText);
          const remaining = countRemainingBanned(cleaned);

          if (rewriteCount > 0 || remaining.length > 0) {
            console.warn(
              `[ApplyFaster] Banned phrase post-processing: rewrote ${rewriteCount} patterns. ` +
                `Remaining after rewrite: ${remaining.length > 0 ? remaining.join(", ") : "none"}`
            );
          }

          controller.enqueue(encoder.encode(cleaned));
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
