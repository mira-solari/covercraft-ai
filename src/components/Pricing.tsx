"use client";

import { useState } from "react";

export default function Pricing() {
  const [loading, setLoading] = useState<string | null>(null);

  const handleCheckout = async (plan: string) => {
    if (plan === "free") {
      // Scroll to generator
      document.getElementById("generator")?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    setLoading(plan);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  const plans = [
    {
      name: "Free",
      price: "$0",
      period: "",
      desc: "Try it out — no strings attached",
      features: [
        "1 cover letter",
        "All tones available",
        "Copy & download",
        "No signup required",
      ],
      cta: "Start Free",
      plan: "free",
      highlight: false,
    },
    {
      name: "Pro",
      price: "$12",
      period: "/month",
      desc: "For active job seekers",
      features: [
        "Unlimited cover letters",
        "Resume tailoring (NEW)",
        "All tones + custom instructions",
        "Priority generation speed",
        "Email support",
      ],
      cta: "Go Pro",
      plan: "pro",
      highlight: true,
      badge: "Most Popular",
    },
    {
      name: "Single",
      price: "$3",
      period: "one-time",
      desc: "Just need one great letter",
      features: [
        "1 premium cover letter",
        "All tones available",
        "Copy & download",
        "Regenerate up to 3x",
      ],
      cta: "Buy Now",
      plan: "single",
      highlight: false,
    },
  ];

  return (
    <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold mb-3">
            Simple, Transparent Pricing
          </h2>
          <p className="text-gray-400 max-w-lg mx-auto">
            Start free. Upgrade when you&apos;re ready. Cancel anytime.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`relative p-6 rounded-2xl border transition flex flex-col ${
                p.highlight
                  ? "bg-indigo-600/10 border-indigo-500/40 scale-[1.02]"
                  : "bg-[var(--surface)] border-[var(--border)] hover:border-indigo-500/20"
              }`}
            >
              {p.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-indigo-600 text-white text-xs font-semibold rounded-full">
                  {p.badge}
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-lg font-semibold">{p.name}</h3>
                <p className="text-sm text-gray-300">{p.desc}</p>
              </div>

              <div className="mb-6">
                <span className="text-4xl font-bold">{p.price}</span>
                {p.period && (
                  <span className="text-gray-400 text-sm ml-1">
                    {p.period}
                  </span>
                )}
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {p.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-center gap-2 text-sm text-gray-300"
                  >
                    <svg
                      className="w-4 h-4 text-indigo-400 flex-shrink-0"
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
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleCheckout(p.plan)}
                disabled={loading === p.plan}
                className={`w-full py-2.5 rounded-xl font-medium transition mt-auto ${
                  p.highlight
                    ? "bg-indigo-600 hover:bg-indigo-500 text-white"
                    : "bg-[var(--surface-hover)] hover:bg-indigo-600/20 text-white border border-gray-600 hover:border-indigo-500/30"
                } ${loading === p.plan ? "opacity-50 cursor-wait" : ""}`}
              >
                {loading === p.plan ? "Redirecting..." : p.cta}
              </button>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-gray-500 mt-8">
          💳 Payments powered by Stripe · Secure checkout · Cancel anytime
        </p>
      </div>
    </section>
  );
}
