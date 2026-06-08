# OSE Portfolio News Archive

Static newsletter archive for the weekly Oxford Science Enterprises portfolio news automation.

Live site: <https://henryblanchard.github.io/ose-portfolio-news/>

## Local Preview

```bash
python3 -m http.server 8080 --directory site
```

Open `http://localhost:8080`.

## Issue Files

Each weekly issue lives at `site/issues/YYYY-MM-DD.md`.

After adding or replacing an issue, rebuild the archive index:

```bash
node scripts/build-issue-index.mjs
```

## Source Map

Refresh the company/source directory before research:

```bash
node scripts/build-source-map.mjs
```

This writes `site/sources/portfolio-source-map.json` and `site/sources/portfolio-source-map.md`.
OSE portfolio pages are used only for roster and official link discovery; issues should cite company, social, regulatory, publication, event, press-release, or reputable media sources instead.

## Manual Research Run

Run the broad news and official-site scan for a date window:

```bash
node scripts/research-weekly-scan.mjs \
  site/sources/portfolio-source-map.json \
  2026-06-02 2026-06-08 \
  work/weekly-scan-2026-06-08
```

Then collect dated posts exposed by public LinkedIn company pages:

```bash
node scripts/research-linkedin-scan.mjs \
  site/sources/portfolio-source-map.json \
  2026-06-02 2026-06-08 \
  work/weekly-scan-2026-06-08/linkedin-results.json
```

Research output is kept under `work/` and is not published. Review and verify candidate items before adding them to an issue.

Each issue must retain an `Editor's Addendum: Leads, Caveats & Corrections` section. Use it for unconfirmed leads, rumours, inference, recycled coverage, chronology problems, false-positive identity matches, and research reviewed but not promoted. Every item needs a clickable source and a clear disposition.

Validate attribution before publication:

```bash
node scripts/validate-issue-sources.mjs site/issues/YYYY-MM-DD.md
```

## Netlify

Create a Netlify site from this repository. Netlify will publish the `site` directory and run:

```bash
node scripts/build-issue-index.mjs
```

## GitHub Pages

Push this repository to GitHub with the default branch named `main`, then enable GitHub Pages using GitHub Actions. The included workflow deploys `site/`.
