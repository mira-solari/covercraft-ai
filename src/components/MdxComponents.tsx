import Link from "next/link";
import type { ComponentProps } from "react";

/* Custom MDX component overrides — styled for the ApplyFaster dark theme. */

function MdxLink(props: ComponentProps<"a">) {
  const href = props.href ?? "";
  if (href.startsWith("/") || href.startsWith("https://applyfaster")) {
    return (
      <Link
        href={href}
        className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition"
      >
        {props.children}
      </Link>
    );
  }
  return (
    <a
      {...props}
      target="_blank"
      rel="noopener noreferrer"
      className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition"
    />
  );
}

export const mdxComponents = {
  h1: (props: ComponentProps<"h1">) => (
    <h1
      className="text-3xl sm:text-4xl font-extrabold mt-10 mb-4"
      {...props}
    />
  ),
  h2: (props: ComponentProps<"h2">) => (
    <h2 className="text-2xl font-bold mt-10 mb-4" {...props} />
  ),
  h3: (props: ComponentProps<"h3">) => (
    <h3 className="text-xl font-semibold mt-8 mb-3" {...props} />
  ),
  p: (props: ComponentProps<"p">) => (
    <p className="text-gray-300 leading-relaxed mb-5" {...props} />
  ),
  a: MdxLink,
  ul: (props: ComponentProps<"ul">) => (
    <ul className="list-disc pl-6 space-y-2 my-6 text-gray-300" {...props} />
  ),
  ol: (props: ComponentProps<"ol">) => (
    <ol
      className="list-decimal pl-6 space-y-3 my-6 text-gray-300"
      {...props}
    />
  ),
  li: (props: ComponentProps<"li">) => (
    <li className="leading-relaxed" {...props} />
  ),
  blockquote: (props: ComponentProps<"blockquote">) => (
    <blockquote
      className="border-l-4 border-indigo-500 pl-4 italic text-gray-400 my-6"
      {...props}
    />
  ),
  strong: (props: ComponentProps<"strong">) => (
    <strong className="text-white font-semibold" {...props} />
  ),
  em: (props: ComponentProps<"em">) => (
    <em className="text-gray-200" {...props} />
  ),
  hr: () => <hr className="border-[var(--border)] my-10" />,
  code: (props: ComponentProps<"code">) => (
    <code
      className="bg-[var(--surface)] text-indigo-300 px-1.5 py-0.5 rounded text-sm"
      {...props}
    />
  ),
};
