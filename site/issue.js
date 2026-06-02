const reader = document.querySelector("#issue-reader");
const params = new URLSearchParams(window.location.search);
const slug = params.get("issue");

if (!slug || !/^[a-z0-9-]+$/i.test(slug)) {
  reader.innerHTML = '<h1>Issue not found</h1><p class="muted">Choose an issue from the archive.</p>';
} else {
  fetch(`./issues/${slug}.md`)
    .then((response) => {
      if (!response.ok) throw new Error("Issue not found");
      return response.text();
    })
    .then((markdown) => {
      reader.innerHTML = markdownToHtml(markdown);
      const heading = reader.querySelector("h1");
      if (heading) document.title = `${heading.textContent} | OSE Portfolio News`;
    })
    .catch(() => {
      reader.innerHTML = '<h1>Issue not found</h1><p class="muted">The requested issue is not available.</p>';
    });
}

function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      html.push("</ul>");
      inList = false;
    }
  };

  for (const line of lines) {
    if (!line.trim()) {
      closeList();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      closeList();
      html.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`);
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${inline(bullet[1])}</li>`);
      continue;
    }

    closeList();
    html.push(`<p>${inline(line)}</p>`);
  }

  closeList();
  return html.join("\n");
}

function inline(value) {
  return escapeHtml(value)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" rel="noopener noreferrer" target="_blank">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
