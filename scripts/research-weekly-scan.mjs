import { mkdir, readFile, writeFile } from "node:fs/promises";

const sourceMapPath = process.argv[2] || "site/sources/portfolio-source-map.json";
const startDate = process.argv[3] || "2026-06-02";
const endDate = process.argv[4] || "2026-06-08";
const outDir = process.argv[5] || "work/weekly-scan";
const userAgent =
  "Mozilla/5.0 (compatible; OSEPortfolioNewsBot/1.0; +https://henryblanchard.github.io/ose-portfolio-news/)";

const sourceMap = JSON.parse(await readFile(sourceMapPath, "utf8"));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const exclusiveEnd = new Date(`${endDate}T00:00:00Z`);
exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
const exclusiveEndDate = exclusiveEnd.toISOString().slice(0, 10);
const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const pageDateNeedles = [];
for (
  const date = new Date(`${startDate}T00:00:00Z`);
  date <= new Date(`${endDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1)
) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const monthName = monthNames[date.getUTCMonth()];
  pageDateNeedles.push(
    `${year}-${month}-${day}`,
    `${year}/${month}/${day}`,
    `${monthName}\\s+${date.getUTCDate()},?\\s+${year}`,
    `${date.getUTCDate()}\\s+${monthName}\\s+${year}`
  );
}
const pageDatePattern = new RegExp(
  pageDateNeedles
    .map((needle) => (needle.includes("\\s") ? needle : escapeRegex(needle)))
    .join("|"),
  "i"
);

const clean = (value = "") =>
  value
    .replace(/^<!\[CDATA\[/, "")
    .replace(/\]\]>$/, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

const fetchText = async (url, timeoutMs = 12000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": userAgent },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return { text: await response.text(), finalUrl: response.url };
  } finally {
    clearTimeout(timeout);
  }
};

const parseRss = (xml) =>
  [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => {
    const item = match[1];
    const get = (tag) => item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))?.[1] || "";
    return {
      title: clean(get("title")),
      link: clean(get("link")),
      pubDate: clean(get("pubDate")),
      source: clean(item.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] || ""),
      description: clean(get("description").replace(/<[^>]+>/g, " ")),
    };
  });

const parseSitemap = (xml) =>
  [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((match) => {
    const block = match[1];
    return {
      url: clean(block.match(/<loc>([\s\S]*?)<\/loc>/)?.[1] || ""),
      lastmod: clean(block.match(/<lastmod>([\s\S]*?)<\/lastmod>/)?.[1] || ""),
    };
  });

const isInWindow = (value) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return false;
  return date >= new Date(`${startDate}T00:00:00Z`) && date <= new Date(`${endDate}T23:59:59Z`);
};

const pageSignals = (html) => {
  const dates = [
    ...html.matchAll(
      /(?:datePublished|dateModified|article:published_time|article:modified_time)["'\s:=]+["']?(\d{4}-\d{2}-\d{2}(?:T[^"'<> ]+)*)/gi
    ),
  ].map((match) => match[1]);
  const title =
    clean(html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i)?.[1]) ||
    clean(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]);
  return { title, dates: [...new Set(dates)] };
};

const newsResults = [];
const officialResults = [];
const socialQueries = [];

for (const [index, company] of sourceMap.sources.entries()) {
  const exactQuery = `"${company.name}" after:${startDate} before:${exclusiveEndDate}`;
  const newsUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(
    exactQuery
  )}&hl=en-GB&gl=GB&ceid=GB:en`;

  try {
    const { text } = await fetchText(newsUrl);
    const items = parseRss(text).filter((item) => isInWindow(item.pubDate));
    if (items.length) newsResults.push({ company: company.name, query: exactQuery, items });
  } catch (error) {
    newsResults.push({ company: company.name, query: exactQuery, error: error.message, items: [] });
  }

  const candidatePages = new Set(company.officialNewsPages || []);
  if (company.website) {
    try {
      const origin = new URL(company.website).origin;
      for (const sitemapUrl of [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`]) {
        try {
          const { text } = await fetchText(sitemapUrl, 9000);
          const nested = [...text.matchAll(/<loc>([^<]+\.xml[^<]*)<\/loc>/g)].map((match) =>
            clean(match[1])
          );
          const sitemapDocs = nested.length ? nested.slice(0, 12) : [sitemapUrl];
          for (const docUrl of sitemapDocs) {
            try {
              const sitemapText =
                docUrl === sitemapUrl ? text : (await fetchText(docUrl, 9000)).text;
              for (const entry of parseSitemap(sitemapText)) {
                if (
                  isInWindow(entry.lastmod) &&
                  /news|press|blog|insight|resource|publication|event|media/i.test(entry.url)
                ) {
                  candidatePages.add(entry.url);
                }
              }
            } catch {
              // Continue through other sitemap documents.
            }
          }
        } catch {
          // Sitemaps are optional.
        }
      }
    } catch {
      // Invalid or missing website.
    }
  }

  const pages = [];
  for (const url of [...candidatePages].slice(0, 30)) {
    try {
      const { text, finalUrl } = await fetchText(url, 10000);
      const signals = pageSignals(text);
      if (
        signals.dates.some(isInWindow) ||
        pageDatePattern.test(text)
      ) {
        pages.push({ url: finalUrl, ...signals });
      }
    } catch {
      // A blocked page remains discoverable through news/social indexing.
    }
    await sleep(35);
  }
  if (pages.length) officialResults.push({ company: company.name, pages });

  socialQueries.push({
    company: company.name,
    linkedin: company.linkedin || "",
    xTwitter: company.xTwitter || "",
    queries: [
      `site:linkedin.com/posts "${company.name}" after:${startDate} before:${exclusiveEndDate}`,
      `site:x.com "${company.name}" since:${startDate} until:${exclusiveEndDate}`,
    ],
  });

  console.log(`${index + 1}/${sourceMap.sources.length} ${company.name}`);
  await sleep(80);
}

await mkdir(outDir, { recursive: true });
await writeFile(
  `${outDir}/news-results.json`,
  `${JSON.stringify({ startDate, endDate, results: newsResults }, null, 2)}\n`
);
await writeFile(
  `${outDir}/official-results.json`,
  `${JSON.stringify({ startDate, endDate, results: officialResults }, null, 2)}\n`
);
await writeFile(
  `${outDir}/social-queries.json`,
  `${JSON.stringify({ startDate, endDate, queries: socialQueries }, null, 2)}\n`
);

console.log(
  `Wrote ${newsResults.length} news-company results, ${officialResults.length} official-company results, and ${socialQueries.length} social query sets to ${outDir}. Run research-linkedin-scan.mjs for dated public company posts.`
);
