import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — ApplyFaster",
};

export default function Privacy() {
  return (
    <main className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/"
          className="text-sm text-indigo-400 hover:text-indigo-300 transition mb-8 inline-block"
        >
          ← Back to ApplyFaster
        </Link>
        <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>
        <div className="prose prose-invert prose-sm max-w-none space-y-6 text-gray-300">
          <p>
            <strong>Last updated:</strong> March 16, 2026
          </p>

          <h2 className="text-xl font-semibold text-white mt-8">
            What we collect
          </h2>
          <p>
            When you use ApplyFaster, you paste your resume text and a job
            description into our tool. This data is sent to our AI service to
            generate your cover letter.
          </p>

          <h2 className="text-xl font-semibold text-white mt-8">
            What we don&apos;t store
          </h2>
          <p>
            <strong>We do not store your resume, job descriptions, or generated
            cover letters.</strong> Your inputs are processed in real-time to
            generate the letter, then discarded. We don&apos;t build profiles,
            sell data, or keep copies of your information.
          </p>

          <h2 className="text-xl font-semibold text-white mt-8">
            Analytics
          </h2>
          <p>
            We use Vercel Analytics to understand how people use the site
            (page views, general usage patterns). This data is anonymous and
            does not include any personal information or the content you
            enter.
          </p>

          <h2 className="text-xl font-semibold text-white mt-8">
            Payments
          </h2>
          <p>
            Payments are processed by Stripe. We never see or store your
            credit card information. Stripe&apos;s privacy policy applies to
            payment processing.
          </p>

          <h2 className="text-xl font-semibold text-white mt-8">
            Cookies
          </h2>
          <p>
            We use minimal cookies for basic site functionality and analytics.
            No tracking cookies, no ad networks, no third-party data sharing.
          </p>

          <h2 className="text-xl font-semibold text-white mt-8">
            Contact
          </h2>
          <p>
            Questions about privacy? Email us at{" "}
            <a
              href="mailto:support@applyfaster.ai"
              className="text-indigo-400 hover:text-indigo-300"
            >
              support@applyfaster.ai
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
