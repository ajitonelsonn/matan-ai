import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DOCS } from "@/lib/docs/generated";
import { DocsShell } from "@/components/docs/DocsShell";

export function generateStaticParams() {
  return DOCS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const doc = DOCS.find((d) => d.slug === slug);
  return doc ? { title: `${doc.title} · MATAN AI docs`, description: doc.summary || undefined } : { title: "Documentation · MATAN AI" };
}

/** One documentation page, rendered from the repository markdown. */
export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = DOCS.find((d) => d.slug === slug);
  if (!doc) notFound();
  return <DocsShell doc={doc} />;
}
