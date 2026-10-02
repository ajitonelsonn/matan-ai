#!/usr/bin/env node
/**
 * Parses every ```mermaid block in README.md and docs/**\/*.md with the real Mermaid parser.
 * A diagram that fails here renders as plain source on GitHub and in the in-app docs, which is
 * easy to miss - usually a label containing braces or starting with "/" that needs quoting.
 *
 * Usage: pnpm docs:lint
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BUNDLE = join(ROOT, "node_modules/mermaid/dist/mermaid.min.js");

if (!existsSync(BUNDLE)) {
  console.error("mermaid is not installed - run pnpm install");
  process.exit(1);
}

const walk = (dir, acc = []) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (name.endsWith(".md")) acc.push(full);
  }
  return acc;
};

const blocks = [];
for (const file of [join(ROOT, "README.md"), ...walk(join(ROOT, "docs"))].filter(existsSync)) {
  const src = readFileSync(file, "utf8");
  const re = /```mermaid\n([\s\S]*?)```/g;
  let match;
  let index = 0;
  while ((match = re.exec(src))) blocks.push({ file: relative(ROOT, file), index: ++index, code: match[1] });
}

const { chromium } = await import("playwright").catch(() => ({ chromium: null }));
if (!chromium) {
  console.log(`${blocks.length} mermaid diagrams found. To validate them, install Playwright once:\n  pnpm add -D playwright && pnpm exec playwright install chrome`);
  process.exit(0);
}

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage();
await page.setContent("<div></div>");
await page.addScriptTag({ path: BUNDLE });
await page.evaluate(() => window.mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "base" }));

let failed = 0;
for (const block of blocks) {
  const error = await page.evaluate(async (code) => {
    try {
      await window.mermaid.parse(code);
      return null;
    } catch (e) {
      return String(e?.message ?? e).split("\n").slice(0, 3).join(" ").slice(0, 200);
    }
  }, block.code);
  if (error) {
    failed += 1;
    console.error(`✖ ${block.file} (diagram ${block.index}): ${error}`);
  }
}
await browser.close();

console.log(`${blocks.length} mermaid diagrams checked, ${failed} failing`);
process.exit(failed ? 1 : 0);
