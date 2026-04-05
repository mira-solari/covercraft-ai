"use client";

import { useState, useCallback } from "react";

type Tone = "professional" | "enthusiastic" | "conversational";
type ActiveTab = "cover-letter" | "resume-tailoring";

interface TailorResult {
  tailoredResume: string;
  gaps: string;
  suggestions: string;
}

interface PlanStatus {
  plan: "free" | "single" | "pro";
  generationsUsed: number;
  generationsAllowed: number;
  active: boolean;
  expired?: boolean;
}

interface GeneratorProps {
  planStatus: PlanStatus | null;
  onPlanStatusChange: () => void;
}

export default function Generator({
  planStatus,
  onPlanStatusChange,
}: GeneratorProps) {
  // Shared state
  const [activeTab, setActiveTab] = useState<ActiveTab>("cover-letter");
  const [resume, setResume] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [error, setError] = useState("");

  // Cover letter state
  const [tone, setTone] = useState<Tone>("professional");
  const [whyCompany, setWhyCompany] = useState("");
  const [whyYou, setWhyYou] = useState("");
  const [showExtras, setShowExtras] = useState(false);
  const [coverLetter, setCoverLetter] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [generationCount, setGenerationCount] = useState(0);
  const [limitReached, setLimitReached] = useState(false);

  // Resume tailoring state
  const [tailorResult, setTailorResult] = useState<TailorResult | null>(null);
  const [isTailoring, setIsTailoring] = useState(false);
  const [tailorCopied, setTailorCopied] = useState(false);

  const handleFileUpload = useCallback(async (file: File) => {
    setIsUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/parse-resume", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to parse resume");
      setResume(data.text);
      setUploadedFileName(file.name);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to parse resume";
      setError(message);
    } finally {
      setIsUploading(false);
    }
  }, []);

  // -------------------------------------------------------------------------
  // Cover letter generation (unchanged logic)
  // -------------------------------------------------------------------------
  const handleGenerate = useCallback(async () => {
    if (!resume.trim() || !jobDescription.trim()) {
      setError("Please paste both your resume and the job description.");
      return;
    }

    if (resume.trim().length < 50) {
      setError("Your resume seems too short. Please paste your full resume.");
      return;
    }

    if (jobDescription.trim().length < 50) {
      setError(
        "The job description seems too short. Please paste the full listing."
      );
      return;
    }

    setError("");
    setLimitReached(false);
    setIsGenerating(true);
    setCoverLetter("");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume,
          jobDescription,
          tone,
          whyCompany,
          whyYou,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        if (data.limitReached) {
          setLimitReached(true);
        }
        throw new Error(data.error || "Failed to generate cover letter");
      }

      // Stream the response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          fullText += chunk;
          setCoverLetter(fullText);
        }
      }

      setGenerationCount((prev) => prev + 1);

      // Refresh plan status after successful generation (usage count changed)
      onPlanStatusChange();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  }, [resume, jobDescription, tone, whyCompany, whyYou, onPlanStatusChange]);

  // -------------------------------------------------------------------------
  // Resume tailoring
  // -------------------------------------------------------------------------
  const handleTailor = useCallback(async () => {
    if (!resume.trim() || !jobDescription.trim()) {
      setError("Please paste both your resume and the job description.");
      return;
    }

    if (resume.trim().length < 50) {
      setError("Your resume seems too short. Please paste your full resume.");
      return;
    }

    if (jobDescription.trim().length < 50) {
      setError(
        "The job description seems too short. Please paste the full listing."
      );
      return;
    }

    setError("");
    setIsTailoring(true);
    setTailorResult(null);

    try {
      const response = await fetch("/api/tailor-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume, jobDescription }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to tailor resume");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullText += decoder.decode(value);
        }
      }

      const result: TailorResult = JSON.parse(fullText);
      setTailorResult(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(message);
    } finally {
      setIsTailoring(false);
    }
  }, [resume, jobDescription]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(coverLetter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [coverLetter]);

  const handleCopyTailored = useCallback(() => {
    if (!tailorResult) return;
    navigator.clipboard.writeText(tailorResult.tailoredResume);
    setTailorCopied(true);
    setTimeout(() => setTailorCopied(false), 2000);
  }, [tailorResult]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([coverLetter], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cover-letter.txt";
    a.click();
    URL.revokeObjectURL(url);
  }, [coverLetter]);

  const handleDownloadTailored = useCallback(() => {
    if (!tailorResult) return;
    const blob = new Blob([tailorResult.tailoredResume], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tailored-resume.txt";
    a.click();
    URL.revokeObjectURL(url);
  }, [tailorResult]);

  const tones: { value: Tone; label: string; desc: string }[] = [
    {
      value: "professional",
      label: "Professional",
      desc: "Formal and polished — best for corporate roles",
    },
    {
      value: "enthusiastic",
      label: "Enthusiastic",
      desc: "Energetic and passionate — great for startups",
    },
    {
      value: "conversational",
      label: "Conversational",
      desc: "Friendly and natural — ideal for creative roles",
    },
  ];

  // Compute display info from plan status
  const plan = planStatus?.plan ?? "free";
  const isActive = planStatus?.active ?? true;
  const isPro = plan === "pro" && isActive;
  const remaining =
    plan === "pro"
      ? Infinity
      : (planStatus?.generationsAllowed ?? 1) -
        (planStatus?.generationsUsed ?? 0);

  // Button label logic (cover letter)
  const getButtonLabel = () => {
    if (isGenerating) return null; // Handled separately with spinner
    if (limitReached || (!isActive && generationCount > 0)) {
      return "Upgrade to Continue";
    }
    if (generationCount > 0) {
      return "Regenerate Cover Letter";
    }
    if (plan === "free") return "Generate Cover Letter — Free";
    if (plan === "single") return "Generate Cover Letter";
    if (plan === "pro") return "Generate Cover Letter";
    return "Generate Cover Letter";
  };

  const scrollToPricing = () => {
    document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
  };

  // Parse suggestions into array
  const parseSuggestions = (text: string): string[] => {
    if (!text) return [];
    return text
      .split(/\n/)
      .map((line) => line.replace(/^\d+\.\s*/, "").trim())
      .filter((line) => line.length > 0);
  };

  return (
    <section id="generator" className="py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold mb-3">
            {activeTab === "cover-letter"
              ? "Generate Your Cover Letter"
              : "Tailor Your Resume"}
          </h2>
          <p className="text-gray-400">
            {activeTab === "cover-letter"
              ? "Two inputs. One perfect cover letter. It\u2019s that simple."
              : "Optimize your resume for a specific job description."}
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex rounded-xl bg-[var(--surface)] border border-[var(--border)] p-1">
            <button
              onClick={() => { setActiveTab("cover-letter"); setError(""); }}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === "cover-letter"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Cover Letter
            </button>
            <button
              onClick={() => { setActiveTab("resume-tailoring"); setError(""); }}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
                activeTab === "resume-tailoring"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Resume Tailoring
              {!isPro && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold">
                  PRO
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Plan status badge */}
        {planStatus && plan !== "free" && isActive && (
          <div className="flex justify-center mb-6">
            <div
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
                plan === "pro"
                  ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                  : "bg-emerald-600/20 text-emerald-300 border border-emerald-500/30"
              }`}
            >
              {plan === "pro" ? (
                <>
                  <span>Pro Plan Active</span>
                  <span className="text-xs opacity-75">
                    — Unlimited letters + resume tailoring
                  </span>
                </>
              ) : (
                <>
                  <span>Single Plan</span>
                  <span className="text-xs opacity-75">
                    — {remaining} generation{remaining !== 1 ? "s" : ""}{" "}
                    remaining
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Column */}
          <div className="space-y-4">
            {/* Resume Input */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-300">
                  Your Resume / Experience
                </label>
                <label className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg transition text-gray-400 hover:text-white cursor-pointer">
                  <input
                    type="file"
                    accept=".pdf,.txt,.docx"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                      e.target.value = "";
                    }}
                  />
                  {isUploading ? "Parsing..." : "Upload PDF"}
                </label>
              </div>
              {uploadedFileName && (
                <div className="text-xs text-green-400 mb-1 flex items-center gap-1">
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Loaded from {uploadedFileName}
                </div>
              )}
              <textarea
                value={resume}
                onChange={(e) => {
                  setResume(e.target.value);
                  setUploadedFileName("");
                }}
                placeholder="Paste your resume text here, or upload a PDF above. Include your work experience, skills, education, and achievements."
                className="w-full h-48 px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition resize-none text-sm"
              />
              <div className="text-xs text-gray-600 mt-1">
                {resume.length > 0 && `${resume.length} characters`}
              </div>
            </div>

            {/* Job Description Input */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Job Description
              </label>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the job listing here... Include the role title, requirements, responsibilities, and company info."
                className="w-full h-48 px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition resize-none text-sm"
              />
              <div className="text-xs text-gray-600 mt-1">
                {jobDescription.length > 0 &&
                  `${jobDescription.length} characters`}
              </div>
            </div>

            {/* Cover Letter specific inputs */}
            {activeTab === "cover-letter" && (
              <>
                {/* Tone Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Tone
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {tones.map((t) => (
                      <button
                        key={t.value}
                        onClick={() => setTone(t.value)}
                        className={`px-3 py-2.5 rounded-lg text-sm font-medium transition flex flex-col items-center gap-0.5 ${
                          tone === t.value
                            ? "bg-indigo-600 text-white"
                            : "bg-[var(--surface)] text-gray-400 hover:text-white border border-[var(--border)] hover:border-indigo-500/50"
                        }`}
                      >
                        <span>{t.label}</span>
                        <span
                          className={`text-[10px] font-normal leading-tight ${
                            tone === t.value
                              ? "text-indigo-200"
                              : "text-gray-500"
                          }`}
                        >
                          {t.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Stand out section */}
                <div>
                  <button
                    onClick={() => setShowExtras(!showExtras)}
                    className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition"
                  >
                    <svg
                      className={`w-4 h-4 transition-transform ${showExtras ? "rotate-90" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                    Stand out from the AI pile (optional — but recommended)
                  </button>

                  {showExtras && (
                    <div className="mt-3 space-y-3 animate-fade-in">
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">
                          Why this company specifically? What genuinely interests
                          you?
                        </label>
                        <textarea
                          value={whyCompany}
                          onChange={(e) => setWhyCompany(e.target.value)}
                          placeholder='e.g. "I&#39;ve used their API for 2 years and love how they prioritize developer experience. Their recent Series B shows they&#39;re scaling fast — I want to be part of that growth."'
                          className="w-full h-20 px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition resize-none text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">
                          What makes you different from other candidates for this
                          role?
                        </label>
                        <textarea
                          value={whyYou}
                          onChange={(e) => setWhyYou(e.target.value)}
                          placeholder='e.g. "Most backend engineers haven&#39;t run their own SaaS. I built and scaled a side project to 5K users, so I understand the full picture — not just the code, but the product decisions behind it."'
                          className="w-full h-20 px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition resize-none text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Error */}
            {error && (
              <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm animate-fade-in">
                {error}
                {limitReached && (
                  <button
                    onClick={scrollToPricing}
                    className="block mt-2 text-indigo-400 hover:text-indigo-300 underline text-sm font-medium"
                  >
                    View pricing plans
                  </button>
                )}
              </div>
            )}

            {/* Cover Letter: Paywall explanation */}
            {activeTab === "cover-letter" &&
              (limitReached || (!isActive && generationCount > 0)) && (
                <div className="px-4 py-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-center text-sm text-indigo-300 animate-fade-in">
                  You&apos;ve used your free cover letter! Upgrade for unlimited
                  access.
                </div>
              )}

            {/* Resume Tailoring: Pro upsell for non-Pro users */}
            {activeTab === "resume-tailoring" && !isPro && (
              <div className="px-4 py-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl animate-fade-in">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg
                      className="w-4 h-4 text-indigo-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-indigo-200">
                      Resume tailoring is a Pro feature
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Upgrade for $12/mo to get unlimited cover letters + resume
                      tailoring.
                    </p>
                    <button
                      onClick={scrollToPricing}
                      className="mt-3 px-4 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition"
                    >
                      View Pro Plan
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Generate / Tailor Button */}
            {activeTab === "cover-letter" ? (
              <button
                onClick={
                  limitReached || (!isActive && generationCount > 0)
                    ? scrollToPricing
                    : handleGenerate
                }
                disabled={isGenerating}
                className={`w-full py-3.5 rounded-xl font-semibold text-white transition text-lg ${
                  isGenerating
                    ? "bg-indigo-700 cursor-wait"
                    : limitReached || (!isActive && generationCount > 0)
                      ? "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 active:scale-[0.98]"
                      : "bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98]"
                }`}
              >
                {isGenerating ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      className="animate-spin h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Generating...
                  </span>
                ) : (
                  getButtonLabel()
                )}
              </button>
            ) : (
              <button
                onClick={isPro ? handleTailor : scrollToPricing}
                disabled={isTailoring || !isPro}
                className={`w-full py-3.5 rounded-xl font-semibold text-white transition text-lg ${
                  !isPro
                    ? "bg-gray-700 cursor-not-allowed opacity-50"
                    : isTailoring
                      ? "bg-indigo-700 cursor-wait"
                      : "bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98]"
                }`}
              >
                {isTailoring ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      className="animate-spin h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Tailoring Resume...
                  </span>
                ) : isPro ? (
                  tailorResult
                    ? "Re-Tailor Resume"
                    : "Generate Tailored Resume"
                ) : (
                  "Upgrade to Pro"
                )}
              </button>
            )}

            {/* Remaining generations hint (cover letter only) */}
            {activeTab === "cover-letter" &&
              plan === "single" &&
              isActive &&
              remaining < 4 &&
              remaining > 0 && (
                <p className="text-center text-xs text-gray-500">
                  {remaining} regeneration{remaining !== 1 ? "s" : ""} remaining
                  on your Single plan
                </p>
              )}
          </div>

          {/* Output Column */}
          <div>
            {activeTab === "cover-letter" ? (
              <>
                {/* Cover Letter Output */}
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-300">
                    Your Cover Letter
                  </label>
                  {coverLetter && (
                    <div className="flex gap-2">
                      <button
                        onClick={handleCopy}
                        className="px-3 py-1.5 text-xs font-medium bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg transition text-gray-400 hover:text-white"
                      >
                        {copied ? "Copied!" : "Copy"}
                      </button>
                      <button
                        onClick={handleDownload}
                        className="px-3 py-1.5 text-xs font-medium bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg transition text-gray-400 hover:text-white"
                      >
                        Download
                      </button>
                    </div>
                  )}
                </div>

                <div
                  className={`w-full h-[470px] px-5 py-4 bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-y-auto text-sm leading-relaxed ${
                    coverLetter ? "text-gray-200" : "text-gray-600"
                  }`}
                >
                  {isGenerating && !coverLetter ? (
                    <div className="space-y-3 animate-fade-in">
                      <div className="h-4 shimmer rounded w-3/4"></div>
                      <div className="h-4 shimmer rounded w-full"></div>
                      <div className="h-4 shimmer rounded w-5/6"></div>
                      <div className="h-4 shimmer rounded w-full"></div>
                      <div className="h-4 shimmer rounded w-2/3"></div>
                    </div>
                  ) : coverLetter ? (
                    <div className="whitespace-pre-wrap animate-fade-in">
                      {coverLetter}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <div className="text-4xl mb-3">&#9993;&#65039;</div>
                      <p className="text-gray-500">
                        Your tailored cover letter will appear here
                      </p>
                      <p className="text-gray-600 text-xs mt-1">
                        Typically generated in under 30 seconds
                      </p>
                    </div>
                  )}
                </div>

                {coverLetter && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 animate-fade-in">
                    <svg
                      className="w-4 h-4 text-green-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>
                      Tailored to match the job requirements &bull;{" "}
                      {coverLetter.split(/\s+/).length} words
                    </span>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Resume Tailoring Output */}
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-300">
                    Tailored Resume
                  </label>
                  {tailorResult && (
                    <div className="flex gap-2">
                      <button
                        onClick={handleCopyTailored}
                        className="px-3 py-1.5 text-xs font-medium bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg transition text-gray-400 hover:text-white"
                      >
                        {tailorCopied ? "Copied!" : "Copy"}
                      </button>
                      <button
                        onClick={handleDownloadTailored}
                        className="px-3 py-1.5 text-xs font-medium bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg transition text-gray-400 hover:text-white"
                      >
                        Download
                      </button>
                    </div>
                  )}
                </div>

                <div
                  className={`w-full px-5 py-4 bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-y-auto text-sm leading-relaxed ${
                    tailorResult ? "text-gray-200" : "text-gray-600"
                  } ${tailorResult ? "h-[300px]" : "h-[470px]"}`}
                >
                  {isTailoring ? (
                    <div className="space-y-3 animate-fade-in">
                      <div className="h-4 shimmer rounded w-1/2"></div>
                      <div className="h-4 shimmer rounded w-3/4"></div>
                      <div className="h-4 shimmer rounded w-full"></div>
                      <div className="h-4 shimmer rounded w-5/6"></div>
                      <div className="h-4 shimmer rounded w-full"></div>
                      <div className="h-4 shimmer rounded w-2/3"></div>
                      <div className="h-4 shimmer rounded w-3/4"></div>
                    </div>
                  ) : tailorResult ? (
                    <div className="whitespace-pre-wrap animate-fade-in">
                      {tailorResult.tailoredResume}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <div className="text-4xl mb-3">&#128196;</div>
                      <p className="text-gray-500">
                        Your tailored resume will appear here
                      </p>
                      <p className="text-gray-600 text-xs mt-1">
                        Reorganized to highlight what matters most for the role
                      </p>
                    </div>
                  )}
                </div>

                {/* Skill Gaps */}
                {tailorResult && tailorResult.gaps && (
                  <div className="mt-4 animate-fade-in">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Skill Gaps
                    </label>
                    <div className="space-y-2">
                      {parseSuggestions(tailorResult.gaps).map(
                        (gap, i) => (
                          <div
                            key={i}
                            className="flex gap-2.5 px-3 py-2.5 bg-amber-500/5 border border-amber-500/20 rounded-lg text-sm"
                          >
                            <div className="w-5 h-5 rounded-full bg-amber-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-[10px] font-bold text-amber-400">
                                {i + 1}
                              </span>
                            </div>
                            <span className="text-gray-300">{gap}</span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}

                {/* Suggestions */}
                {tailorResult && tailorResult.suggestions && (
                  <div className="mt-4 animate-fade-in">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Suggestions
                    </label>
                    <div className="space-y-2">
                      {parseSuggestions(tailorResult.suggestions).map(
                        (suggestion, i) => (
                          <div
                            key={i}
                            className="flex gap-2.5 px-3 py-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-sm"
                          >
                            <div className="w-5 h-5 rounded-full bg-indigo-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-[10px] font-bold text-indigo-400">
                                {i + 1}
                              </span>
                            </div>
                            <span className="text-gray-300">{suggestion}</span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}

                {tailorResult && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 animate-fade-in">
                    <svg
                      className="w-4 h-4 text-green-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>
                      Optimized for the target role &bull;{" "}
                      {tailorResult.tailoredResume.split(/\s+/).length} words
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
