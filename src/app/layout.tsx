import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CoverCraft AI — Tailored Cover Letters in 30 Seconds",
  description:
    "Paste your resume and a job description. Get a perfectly tailored, professional cover letter instantly. Land more interviews with AI-powered cover letters.",
  keywords: [
    "cover letter generator",
    "AI cover letter",
    "job application",
    "resume",
    "cover letter writer",
    "interview",
    "job search",
  ],
  openGraph: {
    title: "CoverCraft AI — Tailored Cover Letters in 30 Seconds",
    description:
      "Stop wasting hours on cover letters. Paste your resume + job description → get a perfect cover letter instantly.",
    type: "website",
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
      </body>
    </html>
  );
}
