import Link from "next/link";
import type { Metadata } from "next";
import { getAllPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Cover Letter Tips & Job Application Advice",
  description:
    "Expert cover letter tips, job application strategies, and advice for standing out in a world of AI-generated slop. Learn how to write cover letters that actually get read.",
  openGraph: {
    title: "Cover Letter Tips & Job Application Advice — ApplyFaster Blog",
    description:
      "Expert cover letter tips and job search strategies. Learn to write letters that hiring managers actually want to read.",
    type: "website",
    url: "https://applyfaster.ai/blog",
  },
  alternates: {
    canonical: "https://applyfaster.ai/blog",
  },
};

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BlogIndex() {
  const posts = getAllPosts();

  return (
    <main className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/"
          className="text-sm text-indigo-400 hover:text-indigo-300 transition mb-8 inline-block"
        >
          &larr; Back to ApplyFaster
        </Link>

        <h1 className="text-3xl sm:text-4xl font-extrabold mb-3">Blog</h1>
        <p className="text-gray-400 mb-12">
          Cover letter tips, job search strategies, and how to stand out when
          everyone else is using the same AI prompts.
        </p>

        {posts.length === 0 ? (
          <p className="text-gray-500">No posts yet. Check back soon.</p>
        ) : (
          <div className="space-y-8">
            {posts.map((post) => (
              <article
                key={post.slug}
                className="group border border-[var(--border)] rounded-xl p-6 hover:border-indigo-500/50 transition"
              >
                <Link href={`/blog/${post.slug}`} className="block">
                  <div className="flex items-center gap-3 text-sm text-gray-500 mb-3">
                    <time dateTime={post.date}>{formatDate(post.date)}</time>
                    <span className="text-gray-700">&middot;</span>
                    <span>{post.readTime}</span>
                  </div>

                  <h2 className="text-xl font-bold mb-2 group-hover:text-indigo-400 transition">
                    {post.title}
                  </h2>

                  <p className="text-gray-400 text-sm leading-relaxed">
                    {post.excerpt}
                  </p>

                  <span className="inline-block mt-4 text-sm text-indigo-400 group-hover:text-indigo-300 transition">
                    Read more &rarr;
                  </span>
                </Link>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
