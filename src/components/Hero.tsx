"use client";

interface HeroProps {
  onGetStarted: () => void;
}

export default function Hero({ onGetStarted }: HeroProps) {
  return (
    <section className="pt-28 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-8">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
          <span className="text-sm text-indigo-300">
            Sounds human — because hiring managers can tell when it doesn&apos;t
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight mb-6">
          Cover letters that don&apos;t
          <br />
          <span className="gradient-text">sound like ChatGPT.</span>
        </h1>

        <p className="text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto mb-10">
          Hiring managers are drowning in AI-generated slop. Stand out with cover
          letters that sound like you — connecting the dots between your story and
          their opportunity.
        </p>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
          <button
            onClick={onGetStarted}
            className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition text-lg animate-pulse-glow"
          >
            Generate Your First Cover Letter — Free
          </button>
        </div>

        {/* Trust signals */}
        <div className="flex items-center justify-center gap-8 text-sm text-gray-400">
          <div className="flex items-center gap-2">
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
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            <span>Ready in 30 seconds</span>
          </div>
          <div className="hidden sm:block w-px h-4 bg-gray-700"></div>
          <span className="hidden sm:inline">No signup required</span>
          <div className="hidden sm:block w-px h-4 bg-gray-700"></div>
          <span className="hidden sm:inline">First letter free</span>
        </div>
      </div>
    </section>
  );
}
