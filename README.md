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

## Netlify

Create a Netlify site from this repository. Netlify will publish the `site` directory and run:

```bash
node scripts/build-issue-index.mjs
```

## GitHub Pages

Push this repository to GitHub with the default branch named `main`, then enable GitHub Pages using GitHub Actions. The included workflow deploys `site/`.
