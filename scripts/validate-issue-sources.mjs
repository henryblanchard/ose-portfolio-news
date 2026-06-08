import { readFile } from "node:fs/promises";

const issuePath = process.argv[2];
if (!issuePath) {
  console.error("Usage: node scripts/validate-issue-sources.mjs site/issues/YYYY-MM-DD.md");
  process.exit(1);
}

const markdown = await readFile(issuePath, "utf8");
const lines = markdown.replace(/\r\n/g, "\n").split("\n");
const errors = [];
const hasLink = (value) => /\[[^\]]+\]\(https?:\/\/[^)]+\)/.test(value);

for (let index = 0; index < lines.length; index += 1) {
  const heading = lines[index].match(/^###\s+(.+)$/);
  if (!heading) continue;

  const block = [];
  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    if (/^#{1,3}\s+/.test(lines[cursor])) break;
    block.push(lines[cursor]);
  }

  if (!hasLink(block.join("\n"))) {
    errors.push(`Story section "${heading[1]}" has no clickable source link.`);
  }
}

for (const sectionName of [
  "Signals, Not Headlines",
  "Editor's Addendum: Leads, Caveats & Corrections",
]) {
  const start = lines.findIndex((line) => line === `## ${sectionName}`);
  if (start === -1) {
    errors.push(`Required section "${sectionName}" is missing.`);
    continue;
  }

  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^##\s+/.test(lines[index])) break;
    if (/^-\s+/.test(lines[index]) && !hasLink(lines[index])) {
      errors.push(
        `Unattributed bullet in "${sectionName}" at line ${index + 1}.`
      );
    }
  }
}

if (/news\.google\.com\/rss\/articles/.test(markdown)) {
  errors.push("Issue cites a Google News redirect instead of a direct source.");
}

if (errors.length) {
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Validated clickable attribution in ${issuePath}`);
