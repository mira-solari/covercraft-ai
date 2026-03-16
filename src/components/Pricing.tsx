"use client";

export default function Pricing() {
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
      highlight: false,
    },
    {
      name: "Pro",
      price: "$12",
      period: "/month",
      desc: "For active job seekers",
      features: [
        "Unlimited cover letters",
        "All tones + custom instructions",
        "Priority generation speed",
        "Email support",
        "Resume optimization tips",
      ],
      cta: "Go Pro",
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
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative p-6 rounded-2xl border transition flex flex-col ${
                plan.highlight
                  ? "bg-indigo-600/10 border-indigo-500/40 scale-[1.02]"
                  : "bg-[var(--surface)] border-[var(--border)] hover:border-indigo-500/20"
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-indigo-600 text-white text-xs font-semibold rounded-full">
                  {plan.badge}
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <p className="text-sm text-gray-300">{plan.desc}</p>
              </div>

              <div className="mb-6">
                <span className="text-4xl font-bold">{plan.price}</span>
                {plan.period && (
                  <span className="text-gray-400 text-sm ml-1">
                    {plan.period}
                  </span>
                )}
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((f) => (
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
                className={`w-full py-2.5 rounded-xl font-medium transition mt-auto ${
                  plan.highlight
                    ? "bg-indigo-600 hover:bg-indigo-500 text-white"
                    : "bg-[var(--surface-hover)] hover:bg-indigo-600/20 text-white border border-gray-600 hover:border-indigo-500/30"
                }`}
              >
                {plan.cta}
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
