"use client";

export default function HowItWorks() {
  const steps = [
    {
      num: "01",
      icon: "📄",
      title: "Paste Your Resume",
      desc: "Drop in your resume text — work experience, skills, education. The more detail, the better the match.",
    },
    {
      num: "02",
      icon: "💼",
      title: "Add the Job Listing",
      desc: "Paste the job description you're applying to. We analyze every requirement and qualification.",
    },
    {
      num: "03",
      icon: "✨",
      title: "Get Your Letter",
      desc: "In under 30 seconds, get a professionally crafted cover letter that maps your experience to the role.",
    },
  ];

  return (
    <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold mb-3">How It Works</h2>
          <p className="text-gray-400 max-w-lg mx-auto">
            Three steps. Thirty seconds. One perfect cover letter.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <div
              key={step.num}
              className="relative p-6 bg-[var(--surface)] border border-[var(--border)] rounded-2xl hover:border-indigo-500/30 transition group"
            >
              <div className="text-xs font-bold text-indigo-400 mb-4">
                STEP {step.num}
              </div>
              <div className="text-3xl mb-3">{step.icon}</div>
              <h3 className="text-lg font-semibold mb-2 group-hover:text-indigo-300 transition">
                {step.title}
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                {step.desc}
              </p>

              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-1/2 -right-4 text-gray-600 text-2xl">
                  →
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Trust signals */}
        <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          {[
            { val: "30s", label: "Average generation time" },
            { val: "0", label: "Generic templates used" },
            { val: "100%", label: "Tailored to each job" },
            { val: "Free", label: "First letter, no strings" },
          ].map((stat) => (
            <div key={stat.label} className="p-4">
              <div className="text-2xl font-bold gradient-text">{stat.val}</div>
              <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
