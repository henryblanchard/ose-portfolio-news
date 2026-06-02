import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const issuesDir = path.resolve("site/issues");
const indexPath = path.join(issuesDir, "index.json");

const files = (await readdir(issuesDir))
  .filter((file) => /^\d{4}-\d{2}-\d{2}\.md$/.test(file))
  .sort()
  .reverse();

const issues = [];

for (const file of files) {
  const markdown = await readFile(path.join(issuesDir, file), "utf8");
  const slug = file.replace(/\.md$/, "");
  const date = slug;
  const title = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() || `Issue: ${date}`;
  const summary =
    markdown
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith("#") && !line.startsWith("-")) ||
    "Weekly portfolio news digest";
  const status = /scheduled|placeholder/i.test(markdown) ? "scheduled" : "published";

  issues.push({ slug, date, title, summary, status });
}

await writeFile(indexPath, `${JSON.stringify({ issues }, null, 2)}\n`);
console.log(`Indexed ${issues.length} issue${issues.length === 1 ? "" : "s"}.`);
