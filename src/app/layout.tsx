import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ApplyFaster — Land More Interviews with AI Cover Letters",
  description:
    "Stop spending 45 minutes per application. Paste your resume and a job description, get a perfectly tailored cover letter in 30 seconds. Land more interviews, faster.",
  keywords: [
    "cover letter generator",
    "AI cover letter",
    "job application",
    "apply faster",
    "resume",
    "cover letter writer",
    "interview",
    "job search",
    "land more interviews",
  ],
  openGraph: {
    title: "ApplyFaster — Land More Interviews with AI Cover Letters",
    description:
      "Stop spending 45 minutes per application. Get a tailored cover letter in 30 seconds. Land more interviews, faster.",
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
