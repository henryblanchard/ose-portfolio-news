import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const OSE_ORIGIN = "https://www.oxfordscienceenterprises.com";
const OUT_DIR = "site/sources";
const OUT_JSON = `${OUT_DIR}/portfolio-source-map.json`;
const OUT_MD = `${OUT_DIR}/portfolio-source-map.md`;

const userAgent =
  "Mozilla/5.0 (compatible; OSEPortfolioNewsBot/1.0; +https://henryblanchard.github.io/ose-portfolio-news/)";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const cleanText = (value = "") =>
  value
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

const normalizeUrl = (href) => {
  try {
    const url = new URL(href);
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
};

const fetchText = async (url, timeoutMs = 12000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": userAgent },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
};

const parsePortfolioCards = (html) => {
  const re =
    /<a class="block group portfolio-item[\s\S]*?href="([^"]+)"[\s\S]*?<img alt="([^"]+)"[\s\S]*?<div class="text-base[^>]*>([\s\S]*?)<\/div>/g;
  const rows = [];
  let match;
  while ((match = re.exec(html))) {
    rows.push({
      name: cleanText(match[2]),
      description: cleanText(match[3]),
      osePage: `${OSE_ORIGIN}${match[1]}`,
      slug: match[1].split("/").filter(Boolean).pop(),
    });
  }
  return rows;
};

const extractExternalLinks = (html) => {
  const hrefs = [...html.matchAll(/href="(https?:\/\/[^"]+)"/g)].map((match) =>
    match[1].replace(/\\u0026/g, "&")
  );
  return [...new Set(hrefs.map(normalizeUrl).filter(Boolean))].filter(
    (url) =>
      !url.includes("oxfordscienceenterprises-cms.com") &&
      !url.includes("cdn-cookieyes.com") &&
      !url.includes("googletagmanager.com") &&
      !url.includes("/admin/")
  );
};

const parseTerms = (html) => {
  const sector = cleanText(
    html.match(/<div class="text-lightblue[^>]*>\s*Sector\s*<\/div>[\s\S]*?<div class="text-lg[^>]*>([\s\S]*?)<\/div>/)?.[1]
  );
  const stage = cleanText(
    html.match(/<div class="text-lightblue[^>]*>\s*Stage\s*<\/div>[\s\S]*?<div class="text-lg[^>]*>([\s\S]*?)<\/div>/)?.[1]
  );
  return { sector, stage };
};

const newsPathPattern =
  /\/(news|newsroom|press|press-releases|media|media-centre|insights|blog|resources|publications|events)(\/|$|-)/i;

const isUsefulNewsUrl = (url) => {
  const { pathname, search } = new URL(url);
  return (
    newsPathPattern.test(pathname) &&
    !/\/(?:wp-content|wp-json|_next|static|assets?)\//i.test(pathname) &&
    !/\.(?:css|js|json|xml|ico|png|jpe?g|gif|svg|webp|woff2?|ttf|otf|pdf)$/i.test(
      pathname
    ) &&
    !/[?&](?:ical|feed)=/i.test(search)
  );
};

const extractSiteLinks = (html, baseUrl) => {
  const urls = [];
  for (const match of html.matchAll(/href=["']([^"']+)["']/g)) {
    try {
      const url = new URL(match[1].replace(/&amp;/g, "&"), baseUrl);
      url.hash = "";
      if (url.origin === new URL(baseUrl).origin && isUsefulNewsUrl(url.toString())) {
        urls.push(url.toString().replace(/\/$/, ""));
      }
    } catch {
      // Ignore malformed links.
    }
  }
  return [...new Set(urls)];
};

const discoverNewsCandidates = async (website) => {
  if (!website) return [];
  const candidates = [];
  const origin = new URL(website).origin;

  try {
    candidates.push(...extractSiteLinks(await fetchText(website, 9000), website));
  } catch {
    // Some sites block homepage fetches; continue with sitemap discovery.
  }

  try {
    const sitemap = await fetchText(`${origin}/sitemap.xml`, 9000);
    for (const match of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      const url = normalizeUrl(match[1]);
      if (url && new URL(url).origin === origin && isUsefulNewsUrl(url)) {
        candidates.push(url);
      }
    }
  } catch {
    // Sitemap is optional.
  }

  return [...new Set(candidates)].slice(0, 12);
};

const probeUrl = async (url) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(url, {
      headers: { "User-Agent": userAgent },
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
    }).catch(async () => {
      return fetch(url, {
        headers: { "User-Agent": userAgent },
        redirect: "follow",
        signal: controller.signal,
      });
    });
    clearTimeout(timeout);
    if (!response.ok) return null;
    const finalUrl = normalizeUrl(response.url);
    if (!finalUrl) return null;
    const pathname = new URL(finalUrl).pathname;
    if (pathname === "/" || pathname === "" || !isUsefulNewsUrl(finalUrl)) return null;
    return finalUrl;
  } catch {
    return null;
  }
};

const findOfficialNewsPages = async (website) => {
  const found = [];
  for (const candidate of await discoverNewsCandidates(website)) {
    const result = await probeUrl(candidate);
    if (result && !found.includes(result)) found.push(result);
    await sleep(60);
  }
  return found;
};

const portfolioHtml = await fetchText(`${OSE_ORIGIN}/portfolio`);
const cards = parsePortfolioCards(portfolioHtml);
const sources = [];

for (const [index, company] of cards.entries()) {
  const entry = {
    ...company,
    sector: "",
    stage: "",
    website: "",
    linkedin: "",
    xTwitter: "",
    otherSocial: [],
    officialNewsPages: [],
    lastChecked: new Date().toISOString(),
  };

  try {
    const html = await fetchText(company.osePage);
    Object.assign(entry, parseTerms(html));
    const links = extractExternalLinks(html);
    entry.linkedin = links.find((url) => url.includes("linkedin.com/company/")) || "";
    entry.xTwitter =
      links.find((url) => url.includes("x.com/") || url.includes("twitter.com/")) || "";
    entry.website =
      links.find(
        (url) =>
          !url.includes("linkedin.com") &&
          !url.includes("x.com") &&
          !url.includes("twitter.com") &&
          !url.includes("facebook.com") &&
          !url.includes("instagram.com") &&
          !url.includes("youtube.com")
      ) || "";
    entry.otherSocial = links.filter(
      (url) =>
        /facebook\.com|instagram\.com|youtube\.com|bsky\.app|threads\.net|medium\.com/.test(url) &&
        url !== entry.xTwitter
    );

    if (entry.website) entry.officialNewsPages = await findOfficialNewsPages(entry.website);
  } catch (error) {
    entry.error = error.message;
  }

  sources.push(entry);
  console.log(`${index + 1}/${cards.length} ${entry.name}`);
  await sleep(120);
}

await mkdir(OUT_DIR, { recursive: true });
await writeFile(OUT_JSON, `${JSON.stringify({ generatedAt: new Date().toISOString(), sources }, null, 2)}\n`);

const md = [
  "# Portfolio Source Map",
  "",
  `Generated: ${new Date().toISOString()}`,
  "",
  "This directory uses Oxford Science Enterprises portfolio pages only to maintain the company roster and official link map. OSE pages are not to be cited as news sources in newsletter issues.",
  "",
  "| Company | Sector | Website | LinkedIn | X/Twitter | Official News Pages |",
  "| --- | --- | --- | --- | --- | --- |",
  ...sources.map((source) => {
    const link = (url) => (url ? `[link](${url})` : "");
    return [
      source.name,
      source.sector,
      link(source.website),
      link(source.linkedin),
      link(source.xTwitter),
      source.officialNewsPages.map(link).join(", "),
    ]
      .map((cell) => String(cell || "").replace(/\|/g, "\\|"))
      .join(" | ")
      .trimEnd();
  }),
  "",
].join("\n");

await writeFile(OUT_MD, md);
console.log(`Wrote ${OUT_JSON} and ${OUT_MD}`);
