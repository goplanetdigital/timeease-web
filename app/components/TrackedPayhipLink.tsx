"use client";

import { track } from "@vercel/analytics";

type Props = {
  href: string;
  slug: string;
  label: string;
  className?: string;
};

export default function TrackedPayhipLink({
  href,
  slug,
  label,
  className,
}: Props) {
  return (
    <a
      className={className}
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={() =>
        track("Payhip CTA Click", {
          source: "seo_solution",
          slug,
          label,
        })
      }
    >
      {label}
    </a>
  );
}
