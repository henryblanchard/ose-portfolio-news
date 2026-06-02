const list = document.querySelector("#issue-list");

const formatDate = (value) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00Z`));

const renderIssues = (issues) => {
  if (!issues.length) {
    list.innerHTML = '<p class="muted">No issues have been published yet.</p>';
    return;
  }

  list.innerHTML = issues
    .map((issue) => {
      const status = issue.status || "published";
      const href = `./issue.html?issue=${encodeURIComponent(issue.slug)}`;
      return `
        <a class="issue-card" href="${href}">
          <span>
            <h3>${escapeHtml(issue.title)}</h3>
            <p>${formatDate(issue.date)} · ${escapeHtml(issue.summary || "Weekly portfolio news digest")}</p>
          </span>
          <span class="status ${status}">${escapeHtml(status)}</span>
        </a>
      `;
    })
    .join("");
};

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

fetch("./issues/index.json")
  .then((response) => {
    if (!response.ok) throw new Error("Archive index unavailable");
    return response.json();
  })
  .then((data) => renderIssues(data.issues || []))
  .catch(() => {
    list.innerHTML = '<p class="muted">The issue archive could not be loaded.</p>';
  });
