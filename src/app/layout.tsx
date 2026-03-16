import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ApplyFaster — Cover Letters That Don't Sound Like ChatGPT",
  description:
    "Hiring managers are drowning in AI-generated slop. Stand out with cover letters that sound like you — connecting your story to their opportunity. Free to try.",
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
    title: "ApplyFaster — Cover Letters That Don't Sound Like ChatGPT",
    description:
      "Hiring managers are drowning in AI slop. Stand out with cover letters that sound like you, not a robot.",
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
