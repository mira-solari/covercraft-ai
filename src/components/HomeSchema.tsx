export default function HomeSchema() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Can employers detect AI cover letters?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Generic AI cover letters from ChatGPT are easily spotted by hiring managers because they all use the same structure and phrases. ApplyFaster generates letters based on your specific resume and the job description, producing natural-sounding letters that read as authentically human. Many recruiters have confirmed our outputs are indistinguishable from human-written letters.",
        },
      },
      {
        "@type": "Question",
        name: "How long does it take to generate a cover letter?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "ApplyFaster generates a tailored, professional cover letter in under 30 seconds. Just paste your resume and the job description, choose a tone, and your letter is ready to copy or download.",
        },
      },
      {
        "@type": "Question",
        name: "Is ApplyFaster free?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes, your first cover letter is completely free with no signup required. After that, you can purchase a single premium letter for $3 or upgrade to the Pro plan at $12/month for unlimited cover letters.",
        },
      },
      {
        "@type": "Question",
        name: "How does ApplyFaster work?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Paste your resume and a job description. ApplyFaster analyzes both, identifies the key requirements and qualifications, then crafts a cover letter that maps your specific experience to what the employer is looking for. Each letter is unique and tailored — no templates.",
        },
      },
      {
        "@type": "Question",
        name: "How is ApplyFaster different from ChatGPT?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "ApplyFaster is purpose-built for cover letters. It analyzes your resume against the specific job description to find meaningful connections between your experience and the role's requirements. You get consistently better results than a general-purpose chatbot, in a fraction of the time, with no prompt engineering required.",
        },
      },
      {
        "@type": "Question",
        name: "Is my data stored?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. We don't store your resume or job descriptions. They're processed in real-time to generate your letter, then discarded. Your privacy matters to us.",
        },
      },
    ],
  };

  const orgSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "ApplyFaster",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: "https://applyfaster.ai",
    description:
      "AI cover letter generator that creates tailored, human-sounding cover letters from your resume and job description in under 30 seconds.",
    offers: [
      {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        description: "Free tier — 1 cover letter, no signup required",
      },
      {
        "@type": "Offer",
        price: "3",
        priceCurrency: "USD",
        description: "Single premium cover letter",
      },
      {
        "@type": "Offer",
        price: "12",
        priceCurrency: "USD",
        description: "Pro plan — unlimited cover letters per month",
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
      />
    </>
  );
}
