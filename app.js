const content = window.PORTFOLIO_CONTENT;

const escapeHtml = (value = "") =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character],
  );

const formatDate = (date) =>
  new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));

function renderProfile() {
  const { profile } = content;
  document.title = `${profile.name} — ${profile.role}`;

  document.querySelectorAll("[data-name]").forEach((element) => {
    element.textContent = profile.name;
  });
  document.querySelector(".wordmark-mark").textContent = profile.name
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  document.querySelector("[data-availability]").textContent = profile.availability;
  document.querySelector("[data-intro]").textContent = profile.intro;
  document.querySelector("[data-role]").textContent = profile.role;
  document.querySelector("[data-location]").textContent = profile.location;
  document.querySelector("[data-about]").textContent = profile.about;
  document.querySelector("[data-email]").textContent = profile.email;
  document.querySelector("[data-email-link]").href = `mailto:${profile.email}`;
  document.querySelector("[data-resume]").href = profile.resume;
  document.querySelector("[data-github]").href = profile.social.github;
  document.querySelector("[data-linkedin]").href = profile.social.linkedin;
  document.querySelector("[data-year]").textContent = new Date().getFullYear();

  document.querySelector("[data-skills]").innerHTML = profile.skills
    .map((skill) => `<span class="skill">${escapeHtml(skill)}</span>`)
    .join("");
}

function renderProjects() {
  document.querySelector("[data-projects]").innerHTML = content.projects
    .map(
      (project) => `
        <article class="project">
          <span class="project-number">${escapeHtml(project.number)}</span>
          <h3>${escapeHtml(project.title)}</h3>
          <div class="project-copy-wrap">
            <p class="project-copy">${escapeHtml(project.description)}</p>
            <div class="project-tags">
              ${project.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
            </div>
          </div>
          <a class="project-link" href="${escapeHtml(project.link)}" aria-label="${escapeHtml(project.linkLabel)}">↗</a>
        </article>
      `,
    )
    .join("");
}

function postMarkup(post, featured = false) {
  if (featured) {
    return `
      <article class="featured-post" data-post-file="${escapeHtml(post.file)}" tabindex="0">
        <div class="post-art" aria-hidden="true"><span class="pulse"></span></div>
        <p class="post-category">${escapeHtml(post.category)} · Featured</p>
        <h3>${escapeHtml(post.title)}</h3>
        <p class="post-excerpt">${escapeHtml(post.excerpt)}</p>
        <div class="post-meta">
          <span>${formatDate(post.date)}</span><span>${escapeHtml(post.readTime)}</span>
        </div>
      </article>
    `;
  }

  return `
    <article class="post-item" data-post-file="${escapeHtml(post.file)}" tabindex="0">
      <p class="post-category">${escapeHtml(post.category)}</p>
      <h3>${escapeHtml(post.title)}</h3>
      <div class="post-meta">
        <span>${formatDate(post.date)}</span><span>${escapeHtml(post.readTime)}</span>
      </div>
    </article>
  `;
}

function renderPosts() {
  const featured = content.posts.find((post) => post.featured) || content.posts[0];
  const remaining = content.posts.filter((post) => post !== featured);

  document.querySelector("[data-featured-post]").innerHTML = featured
    ? postMarkup(featured, true)
    : "<p>No posts yet. Add one in content.js.</p>";
  document.querySelector("[data-posts]").innerHTML = remaining
    .map((post) => postMarkup(post))
    .join("");
}

function inlineMarkdown(text) {
  return text
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

function markdownToHtml(markdown) {
  const lines = escapeHtml(markdown).replace(/\r/g, "").split("\n");
  const output = [];
  let paragraph = [];
  let listType = null;
  let inCode = false;
  let code = [];
  let tableRows = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      output.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (listType) {
      output.push(`</${listType}>`);
      listType = null;
    }
  };
  const flushTable = () => {
    if (!tableRows.length) return;
    const rows = tableRows.filter((row) => !/^\|?[\s:-]+\|/.test(row));
    const cells = rows.map((row) =>
      row
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((cell) => inlineMarkdown(cell.trim())),
    );
    output.push(
      `<table>${cells
        .map(
          (row, rowIndex) =>
            `<tr>${row.map((cell) => `<${rowIndex ? "td" : "th"}>${cell}</${rowIndex ? "td" : "th"}>`).join("")}</tr>`,
        )
        .join("")}</table>`,
    );
    tableRows = [];
  };

  lines.forEach((line) => {
    if (line.trim().startsWith("```")) {
      flushParagraph();
      flushList();
      flushTable();
      if (inCode) {
        output.push(`<pre><code>${code.join("\n")}</code></pre>`);
        code = [];
      }
      inCode = !inCode;
      return;
    }
    if (inCode) {
      code.push(line);
      return;
    }
    if (line.includes("|") && line.trim().startsWith("|")) {
      flushParagraph();
      flushList();
      tableRows.push(line);
      return;
    }
    flushTable();

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const unorderedItem = line.match(/^[-*]\s+(.+)$/);
    const orderedItem = line.match(/^\d+\.\s+(.+)$/);

    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      output.push(
        `<h${level}${level === 1 ? ' id="reader-title"' : ""}>${inlineMarkdown(heading[2])}</h${level}>`,
      );
    } else if (/^---+$/.test(line.trim())) {
      flushParagraph();
      flushList();
      output.push("<hr>");
    } else if (line.startsWith("&gt; ")) {
      flushParagraph();
      flushList();
      output.push(`<blockquote>${inlineMarkdown(line.slice(5))}</blockquote>`);
    } else if (unorderedItem || orderedItem) {
      flushParagraph();
      const nextType = unorderedItem ? "ul" : "ol";
      if (listType !== nextType) {
        flushList();
        listType = nextType;
        output.push(`<${listType}>`);
      }
      output.push(`<li>${inlineMarkdown((unorderedItem || orderedItem)[1])}</li>`);
    } else if (!line.trim()) {
      flushParagraph();
      flushList();
    } else {
      paragraph.push(line.trim());
    }
  });

  flushParagraph();
  flushList();
  flushTable();
  return output.join("\n");
}

async function openReader(file) {
  const reader = document.querySelector("[data-reader]");
  const readerContent = document.querySelector("[data-reader-content]");
  readerContent.innerHTML = "<p>Loading article…</p>";
  reader.classList.add("is-open");
  reader.setAttribute("aria-hidden", "false");
  document.body.classList.add("reader-open");

  try {
    const response = await fetch(file);
    if (!response.ok) throw new Error("Article could not be loaded.");
    readerContent.innerHTML = markdownToHtml(await response.text());
    document.querySelector(".reader-panel").scrollTop = 0;
  } catch {
    readerContent.innerHTML = `
      <div class="reader-error">
        <h1 id="reader-title">Preview unavailable</h1>
        <p>Run the website through a local server to read Markdown articles. See README.md for the one-line command.</p>
      </div>
    `;
  }
}

function closeReader() {
  const reader = document.querySelector("[data-reader]");
  reader.classList.remove("is-open");
  reader.setAttribute("aria-hidden", "true");
  document.body.classList.remove("reader-open");
}

function bindInteractions() {
  const menuButton = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".site-nav");

  menuButton.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    menuButton.setAttribute("aria-expanded", String(isOpen));
  });
  nav.querySelectorAll("a").forEach((link) =>
    link.addEventListener("click", () => {
      nav.classList.remove("is-open");
      menuButton.setAttribute("aria-expanded", "false");
    }),
  );

  document.querySelectorAll("[data-post-file]").forEach((post) => {
    const open = () => openReader(post.dataset.postFile);
    post.addEventListener("click", open);
    post.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") open();
    });
  });

  document.querySelectorAll("[data-close-reader]").forEach((button) =>
    button.addEventListener("click", closeReader),
  );
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeReader();
  });
}

function updateLocalTime() {
  document.querySelector("#local-time").textContent = new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

renderProfile();
renderProjects();
renderPosts();
bindInteractions();
updateLocalTime();
setInterval(updateLocalTime, 60_000);
