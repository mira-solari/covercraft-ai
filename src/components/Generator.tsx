"use client";

import { useState, useCallback } from "react";

type Tone = "professional" | "enthusiastic" | "conversational";

export default function Generator() {
  const [resume, setResume] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [tone, setTone] = useState<Tone>("professional");
  const [whyCompany, setWhyCompany] = useState("");
  const [whyYou, setWhyYou] = useState("");
  const [showExtras, setShowExtras] = useState(false);
  const [coverLetter, setCoverLetter] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [generationCount, setGenerationCount] = useState(0);

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
    setIsGenerating(true);
    setCoverLetter("");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume, jobDescription, tone, whyCompany, whyYou }),
      });

      if (!response.ok) {
        const data = await response.json();
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
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }, [resume, jobDescription, tone]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(coverLetter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [coverLetter]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([coverLetter], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cover-letter.txt";
    a.click();
    URL.revokeObjectURL(url);
  }, [coverLetter]);

  const tones: { value: Tone; label: string; desc: string }[] = [
    {
      value: "professional",
      label: "Professional",
      desc: "Formal and polished",
    },
    {
      value: "enthusiastic",
      label: "Enthusiastic",
      desc: "Energetic and passionate",
    },
    {
      value: "conversational",
      label: "Conversational",
      desc: "Friendly and approachable",
    },
  ];

  return (
    <section id="generator" className="py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold mb-3">
            Generate Your Cover Letter
          </h2>
          <p className="text-gray-400">
            Two inputs. One perfect cover letter. It&apos;s that simple.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Column */}
          <div className="space-y-4">
            {/* Resume Input */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                📄 Your Resume / Experience
              </label>
              <textarea
                value={resume}
                onChange={(e) => setResume(e.target.value)}
                placeholder="Paste your resume text here... Include your work experience, skills, education, and achievements."
                className="w-full h-48 px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition resize-none text-sm"
              />
              <div className="text-xs text-gray-600 mt-1">
                {resume.length > 0 && `${resume.length} characters`}
              </div>
            </div>

            {/* Job Description Input */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                💼 Job Description
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

            {/* Tone Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                🎨 Tone
              </label>
              <div className="grid grid-cols-3 gap-2">
                {tones.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setTone(t.value)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                      tone === t.value
                        ? "bg-indigo-600 text-white"
                        : "bg-[var(--surface)] text-gray-400 hover:text-white border border-[var(--border)] hover:border-indigo-500/50"
                    }`}
                  >
                    {t.label}
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                ⭐ Stand out from the AI pile (optional — but recommended)
              </button>

              {showExtras && (
                <div className="mt-3 space-y-3 animate-fade-in">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">
                      Why this company specifically? What genuinely interests you?
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
                      What makes you different from other candidates for this role?
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

            {/* Error */}
            {error && (
              <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm animate-fade-in">
                {error}
              </div>
            )}

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className={`w-full py-3.5 rounded-xl font-semibold text-white transition text-lg ${
                isGenerating
                  ? "bg-indigo-700 cursor-wait"
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
                  Crafting your letter...
                </span>
              ) : generationCount > 0 ? (
                "✨ Regenerate Cover Letter"
              ) : (
                "✨ Generate Cover Letter — Free"
              )}
            </button>
          </div>

          {/* Output Column */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-300">
                ✉️ Your Cover Letter
              </label>
              {coverLetter && (
                <div className="flex gap-2">
                  <button
                    onClick={handleCopy}
                    className="px-3 py-1.5 text-xs font-medium bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg transition text-gray-400 hover:text-white"
                  >
                    {copied ? "✓ Copied!" : "📋 Copy"}
                  </button>
                  <button
                    onClick={handleDownload}
                    className="px-3 py-1.5 text-xs font-medium bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg transition text-gray-400 hover:text-white"
                  >
                    ⬇ Download
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
                  <div className="text-4xl mb-3">✉️</div>
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
                  Tailored to match the job requirements •{" "}
                  {coverLetter.split(/\s+/).length} words
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
