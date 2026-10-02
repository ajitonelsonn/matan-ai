import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { DOCS, DOC_GROUPS } from "@/lib/docs/generated";
import { DocsShell } from "@/components/docs/DocsShell";

export const metadata: Metadata = {
  title: "Documentation · MATAN AI",
  description: "How MATAN AI is built: architecture, the Ring and AWS integrations, and every page in Real Mode.",
};

/** Public documentation index — no sign-in required. */
export default function DocsIndex() {
  return (
    <DocsShell>
      <header className="relative max-w-[980px] lg:pr-[180px] xl:pr-[220px]">
        <Image
          src="/brand/mascot/read.png"
          alt=""
          width={190}
          height={190}
          priority
          className="pointer-events-none absolute -top-6 right-0 hidden w-[150px] drop-shadow-[0_12px_30px_rgba(18,168,255,0.35)] lg:block xl:w-[190px]"
        />
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[12px] font-semibold text-primary">
          <BookOpen className="size-3.5" /> Documentation
        </span>
        <h1 className="mt-4 text-[32px] font-extrabold leading-tight tracking-tight sm:text-[38px]">
          Everything about how MATAN AI works
        </h1>
        <p className="mt-3 text-[15.5px] leading-relaxed text-text-2">
          Ring sees the event. Matan AI understands the situation, decides what deserves attention, and tells you. These pages are the
          project&apos;s own documentation — architecture diagrams, the Ring and AWS integrations, and an honest audit of every page in
          Real Mode, including what is still a future integration.
        </p>
        <div className="mt-5 flex flex-wrap gap-2.5">
          <Link href="/docs/overview" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-[14px] font-semibold text-[#02101f] transition-opacity hover:opacity-90">
            Start with the overview <ArrowRight className="size-4" />
          </Link>
          <Link href="/docs/architecture" className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-[14px] font-semibold text-text-2 transition-colors hover:border-border-strong hover:text-text">
            See the architecture
          </Link>
          <Link href="/docs/setup" className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-[14px] font-semibold text-text-2 transition-colors hover:border-border-strong hover:text-text">
            Run it yourself
          </Link>
        </div>
      </header>

      <section className="mt-9 grid gap-3 sm:grid-cols-3 [&>*]:min-w-0">
        {[
          { img: "secure", title: "Built on real services", text: "Ring Partner API, Cognito, Bedrock, DynamoDB, S3 and SES — no mock data in Real Mode." },
          { img: "search", title: "Audited page by page", text: "Each page documents what is live, what is a future integration, and how it was verified." },
          { img: "celebrate", title: "Yours to run", text: "MIT licensed, with provisioning scripts and a Demo Mode that needs no Ring account." },
        ].map((c) => (
          <div key={c.title} className="card flex min-w-0 items-start gap-3 p-4">
            <Image src={`/brand/mascot/${c.img}.png`} alt="" width={52} height={52} className="size-[52px] shrink-0" />
            <span className="min-w-0">
              <span className="block text-[14.5px] font-semibold text-text">{c.title}</span>
              <span className="mt-1 block text-[12.8px] leading-relaxed text-text-3">{c.text}</span>
            </span>
          </div>
        ))}
      </section>

      {DOC_GROUPS.map((group) => {
        const items = DOCS.filter((d) => d.group === group.id);
        if (!items.length) return null;
        return (
          <section key={group.id} className="mt-10">
            <h2 className="text-[13px] font-bold uppercase tracking-[0.12em] text-text-3">{group.label}</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 [&>*]:min-w-0">
              {items.map((d) => (
                <Link key={d.slug} href={`/docs/${d.slug}`} className="card flex min-w-0 flex-col p-4 transition-[border-color,transform] hover:border-border-strong">
                  <span className="text-[15px] font-semibold leading-snug text-text">{d.title}</span>
                  {d.summary && <span className="mt-1.5 line-clamp-3 text-[13px] leading-relaxed text-text-3">{d.summary}</span>}
                  <span className="mt-auto pt-3 text-[12px] font-medium text-primary">Read →</span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </DocsShell>
  );
}
