"use client";

import { useState } from "react";

const faqs = [
  {
    q: "How does CoverCraft AI work?",
    a: "You paste your resume and a job description. Our AI analyzes both, identifies the key requirements and qualifications, then crafts a cover letter that maps your specific experience to what the employer is looking for. Each letter is unique and tailored.",
  },
  {
    q: "Will my cover letter be unique?",
    a: "Absolutely. Every cover letter is generated from scratch based on YOUR specific resume and the specific job listing. No templates, no recycled paragraphs. Each one is unique.",
  },
  {
    q: "Can recruiters tell it's AI-generated?",
    a: "Our letters are designed to read naturally and authentically. We focus on specific details from your experience rather than generic phrases, making them indistinguishable from human-written letters. Many recruiters have confirmed our outputs read as authentic.",
  },
  {
    q: "What if I don't like the result?",
    a: "You can regenerate with a different tone, or tweak your inputs for different emphasis. Pro subscribers get unlimited regenerations. Free users get one generation to try it out.",
  },
  {
    q: "Is my data stored?",
    a: "We don't store your resume or job descriptions. They're processed in real-time to generate your letter, then discarded. Your privacy matters to us.",
  },
  {
    q: "How is this different from ChatGPT?",
    a: "CoverCraft is purpose-built for cover letters. Our prompts are fine-tuned through thousands of iterations specifically for this use case. You get consistently better results than a general-purpose chatbot, in a fraction of the time — no prompt engineering required.",
  },
];

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold mb-3">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="border border-[var(--border)] rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-[var(--surface)] transition"
              >
                <span className="font-medium text-sm">{faq.q}</span>
                <svg
                  className={`w-5 h-5 text-gray-500 transition-transform ${
                    open === i ? "rotate-180" : ""
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {open === i && (
                <div className="px-6 pb-4 text-sm text-gray-400 leading-relaxed animate-fade-in">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
