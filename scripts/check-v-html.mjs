#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * CI guard: reject unauthorized `v-html` usage in Vue templates (XSS prevention).
 *
 * The previous implementation shelled out to `grep -r "v-html" src`, which also
 * matched comments that merely *mention* v-html (for example the audit note in
 * src/components/settings/ThemeSwitcher.vue explaining that v-html was removed).
 *
 * This implementation parses each .vue file and only reports real directive
 * usage (`v-html="..."`) inside template markup:
 *   - HTML comments (<!-- ... -->, including multi-line) are masked out
 *   - <script> / <style> blocks are masked out (a string literal such as
 *     `'v-html'` in a script is not a template directive)
 *   Masking replaces the affected characters with spaces while keeping every
 *   newline, so reported line numbers still point at the original file.
 *
 * Files listed in ALLOWED_V_HTML_FILES are skipped (audited exceptions).
 *
 * Usage: node scripts/check-v-html.mjs   (exit 1 on findings, 0 otherwise)
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(REPO_ROOT, 'src');
const VUE_EXTENSION = '.vue';

export const ALLOWED_V_HTML_FILES = [
  // Add audited files here, e.g. 'src/components/AuditedComponent.vue'.
];

// A real directive always carries a value: v-html="expr". The lookbehind keeps
// lookalikes such as `x-v-html` out of the results.
const V_HTML_DIRECTIVE_PATTERN = /(?<![\w-])v-html\s*=/g;

const SCRIPT_OR_STYLE_PATTERN = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;
const HTML_COMMENT_PATTERN = /<!--[\s\S]*?-->/g;

/** Replace every character but the newlines with a space, preserving line numbers. */
function maskPreservingLines(text) {
  return text.replace(/[^\n]/g, ' ');
}

/**
 * Blank out everything that is not template markup, keeping line offsets intact.
 * Comments are masked before script/style blocks so that a commented-out
 * `<script>` tag cannot desynchronize the block pairs.
 */
export function maskNonTemplateRegions(source) {
  return source.replace(HTML_COMMENT_PATTERN, maskPreservingLines).replace(SCRIPT_OR_STYLE_PATTERN, maskPreservingLines);
}

/**
 * Find real `v-html="..."` directive usages in a .vue source.
 * @returns {{ line: number, text: string }[]} 1-based line numbers of the original source.
 */
export function findVHtmlUsages(source) {
  const masked = maskNonTemplateRegions(source);
  const originalLines = source.split('\n');
  const usages = [];

  V_HTML_DIRECTIVE_PATTERN.lastIndex = 0;
  let match = V_HTML_DIRECTIVE_PATTERN.exec(masked);
  while (match !== null) {
    const line = masked.slice(0, match.index).split('\n').length;
    usages.push({ line, text: (originalLines[line - 1] ?? '').trim() });
    match = V_HTML_DIRECTIVE_PATTERN.exec(masked);
  }

  return usages;
}

/** Recursively collect every .vue file under dir (sorted for stable output). */
export function collectVueFiles(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...collectVueFiles(full));
    else if (entry.isFile() && entry.name.endsWith(VUE_EXTENSION)) files.push(full);
  }

  return files.sort();
}

function toRepoRelative(file) {
  const relative = path.relative(REPO_ROOT, path.resolve(file));
  return relative.split(path.sep).join('/');
}

/**
 * Scan a directory for unauthorized v-html directive usage.
 * @returns {{ file: string, line: number, text: string }[]} findings (empty when clean).
 */
export function findUnauthorizedVHtml(root = SRC_DIR, allowed = ALLOWED_V_HTML_FILES) {
  const findings = [];

  for (const file of collectVueFiles(root)) {
    const relative = toRepoRelative(file);
    if (allowed.some((entry) => relative.includes(entry))) continue;

    const source = fs.readFileSync(file, 'utf8');
    for (const usage of findVHtmlUsages(source)) {
      findings.push({ file: relative, line: usage.line, text: usage.text });
    }
  }

  return findings;
}

export function runCheckVHtml(root = SRC_DIR, allowed = ALLOWED_V_HTML_FILES) {
  console.log('--- Checking for unauthorized v-html usage ---');

  let findings;
  try {
    findings = findUnauthorizedVHtml(root, allowed);
  } catch (error) {
    console.error('Failed to run check:', error.message);
    process.exit(1);
  }

  if (findings.length > 0) {
    console.error('\x1b[31mError: Found unauthorized v-html usage:\x1b[0m');
    findings.forEach((finding) => console.error(`  ${finding.file}:${finding.line}:${finding.text}`));
    console.error(
      '\n\x1b[33mPlease use v-safe-html directive instead or add the file to ALLOWED_V_HTML_FILES in scripts/check-v-html.mjs if it is audited.\x1b[0m'
    );
    return 1;
  }

  console.log('\x1b[32mSuccess: No unauthorized v-html usage found.\x1b[0m');
  return 0;
}

function isDirectRun() {
  if (!process.argv[1]) return false;
  try {
    return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isDirectRun()) {
  process.exit(runCheckVHtml());
}
