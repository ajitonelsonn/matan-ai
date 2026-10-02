"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import { ArrowLeft, BookOpen, Code2, Menu, Search, X } from "lucide-react";
import { DOCS, DOC_GROUPS, type DocEntry } from "@/lib/docs/generated";
import { Mermaid } from "./Mermaid";
import { ThemeToggle } from "@/components/experience/theme-toggle";
import { cn } from "@/lib/utils/cn";

const REPO = "https://github.com/ajitonelsonn/matan-ai";

/** Documentation browser for /docs — public (no sign-in), so anyone can read the project. */
export function DocsShell({ children, doc }: { children?: React.ReactNode; doc?: DocEntry }) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  React.useEffect(() => setOpen(false), [pathname]);

  const query = q.trim().toLowerCase();
  const match = (d: DocEntry) => !query || d.title.toLowerCase().includes(query) || d.summary.toLowerCase().includes(query) || d.markdown.toLowerCase().includes(query);

  return (
    <div className="min-h-dvh bg-bg text-text">
      {/* top bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-[1500px] items-center gap-3 px-4 sm:px-6">
          <button type="button" onClick={() => setOpen((o) => !o)} aria-label="Documentation menu" className="inline-flex size-9 items-center justify-center rounded-lg border border-border text-text-2 lg:hidden">
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
          <Link href="/docs" className="flex min-w-0 items-center gap-2.5">
            <Image src="/brand/matan-ai-logo.png" alt="" width={30} height={30} className="shrink-0" />
            <span className="truncate text-[15px] font-bold tracking-tight">
              MATAN AI <span className="font-semibold text-text-3">docs</span>
            </span>
          </Link>
          <div className="relative ml-auto hidden max-w-[300px] flex-1 items-center md:flex">
            <Search className="pointer-events-none absolute left-3 size-4 text-text-3" aria-hidden />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search the documentation…"
              aria-label="Search the documentation"
              className="h-9 w-full rounded-lg border border-border bg-surface-2/60 pl-9 pr-3 text-[13.5px] text-text placeholder:text-text-3 focus:border-border-strong focus:outline-none"
            />
          </div>
          <ThemeToggle size="sm" className="hidden sm:inline-flex" />
          <a href={REPO} target="_blank" rel="noreferrer noopener" className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-[13px] font-semibold text-text-2 transition-colors hover:border-border-strong hover:text-text">
            <Code2 className="size-4" /> <span className="hidden sm:inline">GitHub</span>
          </a>
          <Link href="/" className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-[13px] font-semibold text-[#02101f] transition-opacity hover:opacity-90">
            <ArrowLeft className="size-4" /> <span className="hidden sm:inline">Open the app</span>
          </Link>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1500px] gap-8 px-4 py-7 sm:px-6">
        {/* sidebar */}
        <nav className={cn("w-[264px] shrink-0 lg:block", open ? "fixed inset-x-0 top-14 bottom-0 z-30 block overflow-y-auto border-r border-border bg-bg p-4 lg:static lg:inset-auto lg:p-0" : "hidden")} aria-label="Documentation">
          <div className="lg:sticky lg:top-[76px] lg:max-h-[calc(100dvh-100px)] lg:overflow-y-auto lg:pr-2">
            <div className="relative mb-4 flex items-center md:hidden">
              <Search className="pointer-events-none absolute left-3 size-4 text-text-3" aria-hidden />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" aria-label="Search the documentation" className="h-9 w-full rounded-lg border border-border bg-surface-2/60 pl-9 pr-3 text-[13.5px] text-text placeholder:text-text-3 focus:border-border-strong focus:outline-none" />
            </div>
            {DOC_GROUPS.map((group) => {
              const items = DOCS.filter((d) => d.group === group.id && match(d));
              if (!items.length) return null;
              return (
                <div key={group.id} className="mb-5">
                  <p className="mb-2 px-2 text-[11px] font-bold uppercase tracking-[0.12em] text-text-3">{group.label}</p>
                  <ul className="space-y-0.5">
                    {items.map((d) => {
                      const active = pathname === `/docs/${d.slug}`;
                      return (
                        <li key={d.slug}>
                          <Link
                            href={`/docs/${d.slug}`}
                            className={cn(
                              "block rounded-lg px-2.5 py-1.5 text-[13.5px] leading-snug transition-colors",
                              active ? "bg-primary/14 font-semibold text-primary" : "text-text-2 hover:bg-surface-2/70 hover:text-text",
                            )}
                          >
                            {d.title}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
            {query && !DOCS.some(match) && (
              <div className="px-2 pt-2 text-center">
                <Image src="/brand/mascot/search.png" alt="" width={92} height={92} className="mx-auto size-[92px] opacity-90" />
                <p className="mt-1 text-[13px] text-text-3">Nothing matches “{q}”.</p>
              </div>
            )}
          </div>
        </nav>

        <main id="main" className="min-w-0 flex-1 pb-16">
          {children}
          {doc && <DocView doc={doc} />}
        </main>
      </div>
    </div>
  );
}

/** Rendered markdown + the footer links between documents. */
function DocView({ doc }: { doc: DocEntry }) {
  const index = DOCS.findIndex((d) => d.slug === doc.slug);
  const prev = DOCS[index - 1];
  const next = DOCS[index + 1];

  return (
    <article>
      <div className="mb-5 flex flex-wrap items-center gap-2 text-[12px] text-text-3">
        <Link href="/docs" className="inline-flex items-center gap-1.5 font-semibold text-primary hover:text-primary-2">
          <BookOpen className="size-3.5" /> Documentation
        </Link>
        <span>/</span>
        <span>{doc.title}</span>
        <a href={`${REPO}/blob/main/${doc.repoPath}`} target="_blank" rel="noreferrer noopener" className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 font-medium text-text-3 transition-colors hover:border-border-strong hover:text-text-2">
          <Code2 className="size-3.5" /> {doc.repoPath}
        </a>
      </div>

      <Markdown markdown={doc.markdown} />

      {(prev || next) && (
        <nav className="mt-12 grid gap-3 border-t border-border pt-6 sm:grid-cols-2" aria-label="More documentation">
          {prev ? (
            <Link href={`/docs/${prev.slug}`} className="card p-4 transition-[border-color] hover:border-border-strong">
              <span className="text-[11.5px] font-semibold uppercase tracking-wide text-text-3">Previous</span>
              <span className="mt-1 block text-[14.5px] font-semibold text-text">{prev.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link href={`/docs/${next.slug}`} className="card p-4 text-right transition-[border-color] hover:border-border-strong">
              <span className="text-[11.5px] font-semibold uppercase tracking-wide text-text-3">Next</span>
              <span className="mt-1 block text-[14.5px] font-semibold text-text">{next.title}</span>
            </Link>
          )}
        </nav>
      )}
    </article>
  );
}

/** Markdown → the app's own typography. Mermaid blocks are shown as source with a link out. */
export function Markdown({ markdown }: { markdown: string }) {
  return (
    <div className="max-w-[860px]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeSlug]}
        components={{
          h1: ({ children }) => <h1 className="mt-2 text-[30px] font-extrabold leading-tight tracking-tight text-text sm:text-[34px]">{children}</h1>,
          h2: ({ children, id }) => <h2 id={id} className="mt-9 scroll-mt-20 border-t border-border pt-7 text-[21px] font-bold tracking-tight text-text">{children}</h2>,
          h3: ({ children, id }) => <h3 id={id} className="mt-7 scroll-mt-20 text-[17px] font-bold text-text">{children}</h3>,
          h4: ({ children }) => <h4 className="mt-5 text-[15px] font-bold text-text-2">{children}</h4>,
          p: ({ children }) => <p className="mt-3.5 text-[14.5px] leading-relaxed text-text-2">{children}</p>,
          a: ({ href, children }) => {
            const external = href?.startsWith("http");
            return (
              <a
                href={href}
                {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
                className="font-medium text-primary underline decoration-primary/35 underline-offset-2 hover:text-primary-2 hover:decoration-primary"
              >
                {children}
              </a>
            );
          },
          ul: ({ children }) => <ul className="mt-3.5 space-y-1.5 pl-1">{children}</ul>,
          ol: ({ children }) => <ol className="mt-3.5 list-decimal space-y-1.5 pl-5 marker:text-text-3">{children}</ol>,
          li: ({ children }) => <li className="relative pl-4 text-[14.5px] leading-relaxed text-text-2 marker:text-text-3 [ol>&]:pl-0">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-text">{children}</strong>,
          blockquote: ({ children }) => <blockquote className="mt-4 rounded-r-lg border-l-[3px] border-primary/60 bg-primary/[0.06] py-2 pl-4 pr-3 text-[14px] text-text-2 [&>p]:mt-0">{children}</blockquote>,
          hr: () => <hr className="my-8 border-border" />,
          img: ({ src, alt, width }) => {
            const url = typeof src === "string" ? src : "";
            const w = Number(width) || undefined;
            /* eslint-disable @next/next/no-img-element */
            // badges sit inline in a sentence; small images keep their own width; the rest are figures
            if (/shields\.io|badge/i.test(url)) return <img src={url} alt={alt ?? ""} className="mr-1.5 inline-block h-[22px] w-auto align-middle" loading="lazy" />;
            if (w && w <= 260) return <img src={url} alt={alt ?? ""} width={w} className="mx-auto block h-auto" loading="lazy" />;
            return (
              <span className="mt-5 block overflow-hidden rounded-xl border border-border bg-surface-2/50">
                <img src={url} alt={alt ?? ""} className="block h-auto w-full" loading="lazy" />
              </span>
            );
            /* eslint-enable @next/next/no-img-element */
          },
          table: ({ children }) => (
            <div className="mt-5 overflow-x-auto rounded-xl border border-border">
              <table className="w-full border-collapse text-left text-[13.5px]">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-surface-2/70">{children}</thead>,
          th: ({ children }) => <th className="border-b border-border px-3.5 py-2.5 font-semibold text-text">{children}</th>,
          td: ({ children }) => <td className="border-b border-border/60 px-3.5 py-2.5 align-top text-text-2">{children}</td>,
          code: ({ className, children }) => {
            const lang = /language-(\w+)/.exec(className ?? "")?.[1];
            if (!lang) return <code className="rounded-[5px] border border-border bg-surface-2/80 px-1.5 py-0.5 font-mono text-[12.5px] text-text">{children}</code>;
            if (lang === "mermaid") return <Mermaid chart={String(children).replace(/\n$/, "")} />;
            return (
              <span className="mt-5 block overflow-hidden rounded-xl border border-border bg-[#02101f]">
                <span className="flex items-center justify-between border-b border-border px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-3">
                  {lang}
                </span>
                <span className="block overflow-x-auto px-3.5 py-3">
                  <code className="whitespace-pre font-mono text-[12.5px] leading-relaxed text-text-2">{children}</code>
                </span>
              </span>
            );
          },
          pre: ({ children }) => <>{children}</>,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
