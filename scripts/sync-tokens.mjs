#!/usr/bin/env node
/*
 * Copies the design tokens from the UniQuarter app monorepo into this site.
 *
 *   node scripts/sync-tokens.mjs                 (monorepo next to this repo)
 *   node scripts/sync-tokens.mjs "<path to packages/design-system>"
 *
 * The source is the generated file packages/design-system/src/styles/tokens.css.
 * The Tailwind-only "@theme inline { ... }" block is removed, because this site
 * has no Tailwind build. Everything else is copied as it is, so the light,
 * dark and device-setting blocks all come across. The site pins light mode with
 * data-theme="light" on <html>, so the dark blocks never apply.
 *
 * Run it after the tokens change in the monorepo, check the page, then commit.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const designSystem = resolve(process.argv[2] ?? resolve(repoRoot, "../Uni Quarter/packages/design-system"));
const source = resolve(designSystem, "src/styles/tokens.css");
const target = resolve(repoRoot, "assets/css/tokens.css");

let css;
try {
  css = readFileSync(source, "utf8");
} catch {
  console.error(`Could not read ${source}\nPass the path to packages/design-system as the first argument.`);
  process.exit(1);
}

// Remove the @theme block by matching braces, so nested blocks are handled.
// Match it only at the start of a line: the file's header comment mentions it too.
const match = /^@theme\b[^{]*\{/m.exec(css);
const start = match ? match.index : -1;
if (start !== -1) {
  let depth = 0;
  let end = -1;
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) {
      end = i + 1;
      break;
    }
  }
  if (end === -1) {
    console.error("Found @theme but not the end of its block. Nothing written.");
    process.exit(1);
  }
  css = css.slice(0, start).trimEnd() + "\n" + css.slice(end);
}

const banner =
  "/* Vendored from the UniQuarter design system (packages/design-system/src/styles/tokens.css)\n" +
  ` * by scripts/sync-tokens.mjs on ${new Date().toISOString().slice(0, 10)}. Do not edit by hand:\n` +
  " * change the tokens in the monorepo, then run the script again. */\n\n";

writeFileSync(target, banner + css.trim() + "\n");
console.log(`Wrote ${target}`);
