#!/usr/bin/env node
/**
 * Builds the in-app documentation (/docs) from the markdown that already lives in the repo.
 *
 * - reads README.md and docs/**\/*.md (the single source of truth - nothing is duplicated by hand)
 * - rewrites links between documents to /docs/<slug> and image paths to /docs-assets/…
 * - copies the images those documents reference into public/docs-assets/
 * - writes lib/docs/generated.ts, which the /docs pages import (no filesystem access at runtime,
 *   so it works the same locally and on Amplify's SSR compute)
 *
 * Run by `pnpm dev` and `pnpm build`; also available as `pnpm docs:build`.
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync, statSync, rmSync } from "node:fs";
import { dirname, join, relative, resolve, extname, posix } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_TS = join(ROOT, "lib/docs/generated.ts");
const ASSET_DIR = join(ROOT, "public/docs-assets");
/** Links to source files (../lib/ring/client.ts, ../LICENSE) point at GitHub in the app. */
const REPO_URL = "https://github.com/ajitonelsonn/matan-ai";

/** Order and grouping of the documentation in the sidebar. Anything not listed is appended. */
const GROUPS = [
  { id: "start", label: "Start here", match: (p) => p === "README.md" || p === "docs/SETUP.md" },
  { id: "architecture", label: "Architecture", match: (p) => p.startsWith("docs/architecture/") },
  { id: "pages", label: "The product, page by page", match: (p) => p.startsWith("docs/pages/") },
  { id: "implementation", label: "Implementation notes", match: () => true },
];

const SUMMARY_OVERRIDES = {
  "docs/architecture/README.md":
    "Four diagrams of how MATAN AI is put together: the system architecture, the event-to-alert lifecycle, the feature map and the deployment and security view - with the flows written out in full.",
};

/**
 * Private working notes: git-ignored, and never published to /docs even when the
 * files are present locally, so the site is the same here and on deployment.
 */
const EXCLUDED = new Set(["docs/HACKATHON.md", "docs/SUBMISSION.md"]);

const TITLE_OVERRIDES = {
  "README.md": "MATAN AI — overview",
  "docs/pages/README.md": "Real Mode page audit",
  "docs/architecture/README.md": "Architecture diagrams",
};

const ORDER_HINT = [
  "README.md",
  "docs/SETUP.md",
  "docs/architecture/README.md",
  "docs/pages/README.md",
  "docs/pages/auth.md",
  "docs/pages/home.md",
  "docs/pages/live-view.md",
  "docs/pages/events.md",
  "docs/pages/ai-insights.md",
  "docs/pages/ai-assistant.md",
  "docs/pages/automations.md",
  "docs/pages/security-modes.md",
  "docs/pages/devices.md",
  "docs/pages/care-family.md",
  "docs/pages/business.md",
  "docs/pages/settings.md",
];

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".svg", ".gif", ".webp"]);

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (extname(name).toLowerCase() === ".md") acc.push(full);
  }
  return acc;
}

/** docs/pages/home.md -> pages-home · README.md -> overview */
function slugFor(repoPath) {
  if (repoPath === "README.md") return "overview";
  return repoPath
    .replace(/^docs\//, "")
    .replace(/\.md$/, "")
    .replace(/\/README$/, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function titleFor(repoPath, markdown) {
  if (TITLE_OVERRIDES[repoPath]) return TITLE_OVERRIDES[repoPath];
  const h1 = markdown.match(/^#\s+(.+)$/m);
  return h1 ? h1[1].replace(/\s*\[.*?\]\(.*?\)\s*/g, "").trim() : slugFor(repoPath);
}

/** First meaningful paragraph, used as the card description on the index. */
function summaryFor(markdown) {
  const skip = /^(#|>|\||!\[|```|<|\s*[-*]\s|\s*\d+\.\s|\[!\[)/;
  const body = markdown.replace(/```[\s\S]*?```/g, "").split("\n").filter((l) => !skip.test(l)).join("\n");
  const para = body
    .split(/\n\s*\n/)
    .map((p) => p.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
    .find((p) => p.length > 60 && /[a-z]{4}/.test(p));
  return para ? para.replace(/\*\*|\*|`|_/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").slice(0, 190) : "";
}

const mdFiles = [join(ROOT, "README.md"), ...walk(join(ROOT, "docs"))]
  .filter(existsSync)
  .map((f) => relative(ROOT, f).split("\\").join("/"))
  .filter((p) => !EXCLUDED.has(p));

const bySlug = new Map(mdFiles.map((p) => [p, slugFor(p)]));

if (existsSync(ASSET_DIR)) rmSync(ASSET_DIR, { recursive: true, force: true });
mkdirSync(ASSET_DIR, { recursive: true });

let assetCount = 0;
const docs = [];

for (const repoPath of mdFiles) {
  const raw = readFileSync(join(ROOT, repoPath), "utf8");
  const docDir = dirname(repoPath);

  const markdown = raw.replace(/(!?)\[([^\]]*)\]\(([^)]+)\)/g, (match, bang, text, target) => {
    const [link, hash = ""] = target.split("#");
    if (/^(https?:|mailto:|#)/.test(target) || !link) return match;

    const resolved = posix.normalize(posix.join(docDir, link));
    const ext = extname(resolved).toLowerCase();

    if (bang === "!" || IMAGE_EXT.has(ext)) {
      const src = join(ROOT, resolved);
      if (!existsSync(src)) return match;
      const dest = join(ASSET_DIR, resolved);
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(src, dest);
      assetCount += 1;
      return `${bang}[${text}](/docs-assets/${resolved})`;
    }

    // a link to another document (…/x.md or a directory holding a README.md)
    const candidates = [resolved, `${resolved}/README.md`, resolved.replace(/\/$/, "/README.md")];
    const hit = candidates.find((c) => bySlug.has(c));
    if (hit) return `${bang}[${text}](/docs/${bySlug.get(hit)}${hash ? `#${hash}` : ""})`;

    // a link to a source file or folder in the repo → the same path on GitHub
    const abs = join(ROOT, resolved);
    if (existsSync(abs)) {
      const kind = statSync(abs).isDirectory() ? "tree" : "blob";
      return `${bang}[${text}](${REPO_URL}/${kind}/main/${resolved.replace(/\/$/, "")}${hash ? `#${hash}` : ""})`;
    }
    return match;
  });

  const withHtml = markdown.replace(/(src|href)="([^"]+)"/g, (match, attr, target) => {
    if (/^(https?:|mailto:|#|\/)/.test(target)) return match;
    const resolved = posix.normalize(posix.join(docDir, target));
    if (resolved.startsWith("public/")) return `${attr}="/${resolved.slice("public/".length)}"`;
    const src = join(ROOT, resolved);
    if (!existsSync(src)) return match;
    const dest = join(ASSET_DIR, resolved);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
    assetCount += 1;
    return `${attr}="/docs-assets/${resolved}"`;
  });

  docs.push({
    slug: bySlug.get(repoPath),
    repoPath,
    title: titleFor(repoPath, raw),
    summary: SUMMARY_OVERRIDES[repoPath] ?? summaryFor(raw),
    group: (GROUPS.find((g) => g.match(repoPath)) ?? GROUPS.at(-1)).id,
    markdown: withHtml,
  });
}

docs.sort((a, b) => {
  const ga = GROUPS.findIndex((g) => g.id === a.group);
  const gb = GROUPS.findIndex((g) => g.id === b.group);
  if (ga !== gb) return ga - gb;
  const oa = ORDER_HINT.indexOf(a.repoPath);
  const ob = ORDER_HINT.indexOf(b.repoPath);
  if (oa !== -1 || ob !== -1) return (oa === -1 ? 999 : oa) - (ob === -1 ? 999 : ob);
  return a.title.localeCompare(b.title);
});

mkdirSync(dirname(OUT_TS), { recursive: true });
writeFileSync(
  OUT_TS,
  `// Generated by scripts/build-docs.mjs — do not edit. Source of truth: README.md and docs/**/*.md\n` +
    `export interface DocEntry {\n  slug: string;\n  repoPath: string;\n  title: string;\n  summary: string;\n  group: string;\n  markdown: string;\n}\n\n` +
    `export const DOC_GROUPS: { id: string; label: string }[] = ${JSON.stringify(GROUPS.map(({ id, label }) => ({ id, label })), null, 2)};\n\n` +
    `export const DOCS: DocEntry[] = ${JSON.stringify(docs, null, 2)};\n`,
);

console.log(`docs: ${docs.length} documents, ${assetCount} assets → lib/docs/generated.ts + public/docs-assets/`);
