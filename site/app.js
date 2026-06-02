const list = document.querySelector("#issue-list");
const latest = document.querySelector("#latest-issue");

const formatDate = (value) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00Z`));

const renderIssues = (issues) => {
  if (!issues.length) {
    list.innerHTML = '<p class="muted">No issues have been published yet.</p>';
    latest.innerHTML = '<p class="muted">No issues have been published yet.</p>';
    return;
  }

  const published = issues.find((issue) => issue.status === "published") || issues[0];
  const scheduled = issues.filter((issue) => issue.status !== "published");
  latest.innerHTML = renderLeadIssue(published, scheduled[0]);

  list.innerHTML = issues
    .map((issue) => renderIssueCard(issue))
    .join("");
};

const renderLeadIssue = (issue, nextIssue) => {
  const href = `./issue.html?issue=${encodeURIComponent(issue.slug)}`;
  const next = nextIssue
    ? `<p class="next-edition">Next: ${escapeHtml(nextIssue.title)} · ${formatDate(nextIssue.date)}</p>`
    : "";
  return `
    <a class="lead-link" href="${href}">
      <h2>${escapeHtml(issue.title)}</h2>
      <p class="issue-date">${formatDate(issue.date)}</p>
      <p>${escapeHtml(issue.summary || "Weekly portfolio news digest")}</p>
      <span class="read-more">Read the edition</span>
    </a>
    ${next}
  `;
};

const renderIssueCard = (issue) => {
  const status = issue.status || "published";
  const href = `./issue.html?issue=${encodeURIComponent(issue.slug)}`;
  return `
    <a class="issue-card ${status}" href="${href}">
      <span class="issue-meta">${formatDate(issue.date)} · ${escapeHtml(status)}</span>
      <h3>${escapeHtml(issue.title)}</h3>
      <p>${escapeHtml(issue.summary || "Weekly portfolio news digest")}</p>
    </a>
  `;
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
