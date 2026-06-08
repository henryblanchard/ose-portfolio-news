import { mkdir, readFile, writeFile } from "node:fs/promises";

const sourceMapPath = process.argv[2] || "site/sources/portfolio-source-map.json";
const startDate = process.argv[3] || "2026-06-02";
const endDate = process.argv[4] || "2026-06-08";
const outPath =
  process.argv[5] || "work/weekly-scan/linkedin-results.json";
const userAgent =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/137 Safari/537.36";

const sourceMap = JSON.parse(await readFile(sourceMapPath, "utf8"));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const windowStart = new Date(`${startDate}T00:00:00Z`);
const windowEnd = new Date(`${endDate}T23:59:59Z`);

const inWindow = (value) => {
  const date = new Date(value);
  return (
    !Number.isNaN(date.valueOf()) &&
    date >= windowStart &&
    date <= windowEnd
  );
};

const decodeHtml = (value) =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

const parseJsonLd = (html) => {
  const posts = [];
  const scripts = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );

  for (const match of scripts) {
    try {
      const data = JSON.parse(decodeHtml(match[1]).trim());
      const nodes = Array.isArray(data)
        ? data
        : Array.isArray(data["@graph"])
          ? data["@graph"]
          : [data];

      for (const node of nodes) {
        if (
          node?.["@type"] === "DiscussionForumPosting" &&
          inWindow(node.datePublished)
        ) {
          posts.push({
            datePublished: node.datePublished,
            author: node.author?.name || "",
            text: node.text || "",
            url: node.url || node.mainEntityOfPage || "",
          });
        }
      }
    } catch {
      // LinkedIn can include unrelated or escaped JSON-LD blocks.
    }
  }

  return posts;
};

const results = [];

for (const [index, company] of sourceMap.sources.entries()) {
  if (!company.linkedin) continue;

  try {
    const response = await fetch(company.linkedin, {
      headers: {
        "User-Agent": userAgent,
        "Accept-Language": "en-GB,en;q=0.9",
      },
      redirect: "follow",
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

    const posts = parseJsonLd(await response.text());
    if (posts.length) {
      results.push({
        company: company.name,
        profile: response.url,
        posts,
      });
    }
  } catch (error) {
    results.push({
      company: company.name,
      profile: company.linkedin,
      error: error.message,
      posts: [],
    });
  }

  console.log(`${index + 1}/${sourceMap.sources.length} ${company.name}`);
  await sleep(175);
}

await mkdir(outPath.slice(0, outPath.lastIndexOf("/")), { recursive: true });
await writeFile(
  outPath,
  `${JSON.stringify({ startDate, endDate, results }, null, 2)}\n`
);

const postCount = results.reduce((total, result) => total + result.posts.length, 0);
console.log(
  `Wrote ${postCount} posts from ${results.filter((result) => result.posts.length).length} companies to ${outPath}`
);
