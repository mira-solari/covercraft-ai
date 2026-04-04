import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://applyfaster.ai"),
  title: {
    default:
      "ApplyFaster — AI Cover Letter Generator That Sounds Human, Not Like ChatGPT",
    template: "%s — ApplyFaster",
  },
  description:
    "AI cover letter generator that actually sounds like you. Paste your resume and a job description — get a tailored cover letter in 30 seconds. Free to try, no signup required.",
  keywords: [
    "AI cover letter generator",
    "cover letter generator",
    "AI cover letter",
    "cover letter writer",
    "job application",
    "apply faster",
    "resume cover letter",
    "cover letter AI tool",
    "job search",
    "land more interviews",
  ],
  openGraph: {
    title: "ApplyFaster — AI Cover Letter Generator That Sounds Human",
    description:
      "Hiring managers are drowning in AI slop. Stand out with cover letters that sound like you, not a robot. Free first letter, no signup.",
    type: "website",
    url: "https://applyfaster.ai",
    siteName: "ApplyFaster",
  },
  twitter: {
    card: "summary_large_image",
    title: "ApplyFaster — AI Cover Letter Generator",
    description:
      "Cover letters that don't sound like ChatGPT. Paste your resume + job description, get a tailored letter in 30 seconds.",
  },
  alternates: {
    canonical: "https://applyfaster.ai",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
