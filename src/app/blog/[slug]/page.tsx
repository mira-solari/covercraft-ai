import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { getPostBySlug, getAllSlugs, getAllPosts } from "@/lib/blog";
import { mdxComponents } from "@/components/MdxComponents";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    return { title: "Post Not Found — ApplyFaster" };
  }

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      publishedTime: post.date,
      url: `https://applyfaster.ai/blog/${slug}`,
      siteName: "ApplyFaster",
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
    },
    alternates: {
      canonical: `https://applyfaster.ai/blog/${slug}`,
    },
  };
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  return (
    <main className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/blog"
          className="text-sm text-indigo-400 hover:text-indigo-300 transition mb-8 inline-block"
        >
          &larr; Back to Blog
        </Link>

        <article>
          <header className="mb-10">
            <h1 className="text-3xl sm:text-4xl font-extrabold mb-4">
              {post.title}
            </h1>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <time dateTime={post.date}>{formatDate(post.date)}</time>
              <span className="text-gray-700">&middot;</span>
              <span>{post.readTime}</span>
            </div>
          </header>

          <div className="prose prose-invert prose-lg max-w-none">
            <MDXRemote
              source={post.content}
              components={mdxComponents}
            />
          </div>
        </article>

        {/* Related Posts */}
        {(() => {
          const allPosts = getAllPosts();
          const related = allPosts
            .filter((p) => p.slug !== slug)
            .slice(0, 3);
          if (related.length === 0) return null;
          return (
            <div className="mt-14">
              <h2 className="text-xl font-bold mb-6">Keep Reading</h2>
              <div className="space-y-4">
                {related.map((relPost) => (
                  <Link
                    key={relPost.slug}
                    href={`/blog/${relPost.slug}`}
                    className="block p-4 border border-[var(--border)] rounded-xl hover:border-indigo-500/50 transition"
                  >
                    <p className="font-medium text-sm hover:text-indigo-400 transition">
                      {relPost.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {relPost.excerpt.slice(0, 120)}
                      {relPost.excerpt.length > 120 ? "..." : ""}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          );
        })()}

        {/* CTA */}
        <div className="mt-14 p-6 bg-indigo-600/10 border border-indigo-500/30 rounded-xl">
          <p className="text-lg font-semibold mb-2">
            Try ApplyFaster free &mdash; no signup required
          </p>
          <p className="text-gray-400 text-sm mb-4">
            Paste your resume and a job description. Get a cover letter that
            actually sounds like you wrote it.
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition"
          >
            Generate Your First Letter &rarr;
          </Link>
        </div>
      </div>

      {/* Article structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: post.title,
            description: post.excerpt,
            datePublished: post.date,
            author: {
              "@type": "Organization",
              name: "ApplyFaster",
              url: "https://applyfaster.ai",
            },
            publisher: {
              "@type": "Organization",
              name: "ApplyFaster",
              url: "https://applyfaster.ai",
            },
            mainEntityOfPage: {
              "@type": "WebPage",
              "@id": `https://applyfaster.ai/blog/${slug}`,
            },
          }),
        }}
      />
    </main>
  );
}
