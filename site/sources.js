const target = document.querySelector("#source-list");

const escapeHtml = (value) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const link = (url, label = "link") =>
  url ? `<a href="${escapeHtml(url)}" rel="noopener noreferrer" target="_blank">${escapeHtml(label)}</a>` : "";

const render = ({ generatedAt, sources = [] }) => {
  if (!sources.length) {
    target.innerHTML = '<p class="muted">No sources have been mapped yet.</p>';
    return;
  }

  target.innerHTML = `
    <div class="source-meta">Generated ${new Date(generatedAt).toLocaleString("en-GB")}</div>
    <div class="source-table-wrap">
      <table class="source-table">
        <thead>
          <tr>
            <th>Company</th>
            <th>Sector</th>
            <th>Website</th>
            <th>LinkedIn</th>
            <th>X/Twitter</th>
            <th>Newsroom Candidates</th>
          </tr>
        </thead>
        <tbody>
          ${sources
            .map(
              (source) => `
                <tr>
                  <td>
                    <strong>${escapeHtml(source.name)}</strong>
                    <span>${escapeHtml(source.description)}</span>
                  </td>
                  <td>${escapeHtml(source.sector || "")}</td>
                  <td>${link(source.website, "website")}</td>
                  <td>${link(source.linkedin, "LinkedIn")}</td>
                  <td>${link(source.xTwitter, "X/Twitter")}</td>
                  <td>${(source.officialNewsPages || []).map((url) => link(url, new URL(url).pathname.replace("/", "") || "news")).join(", ")}</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
};

fetch("./sources/portfolio-source-map.json")
  .then((response) => {
    if (!response.ok) throw new Error("Source map unavailable");
    return response.json();
  })
  .then(render)
  .catch(() => {
    target.innerHTML = '<p class="muted">The source map could not be loaded.</p>';
  });
