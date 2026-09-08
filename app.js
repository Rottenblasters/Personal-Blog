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
  document.querySelector("[data-intro]").textContent = profile.intro;
  document.querySelector("[data-location]").textContent = profile.location;
  const aboutCopy = document.querySelector("[data-about]");
  const aboutParagraphs = Array.isArray(profile.about) ? profile.about : [profile.about];
  aboutCopy.innerHTML = aboutParagraphs
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("");
  const aboutHeadline = document.querySelector("[data-about-headline]");
  if (aboutHeadline && profile.aboutHeadline) {
    aboutHeadline.textContent = profile.aboutHeadline;
  }
  document.querySelectorAll("[data-email]").forEach((el) => {
    el.textContent = profile.email;
  });
  document.querySelectorAll("[data-email-link]").forEach((el) => {
    el.href = `mailto:${profile.email}`;
  });
  document.querySelectorAll("[data-resume]").forEach((el) => {
    el.href = profile.resume;
  });
  document.querySelectorAll("[data-github]").forEach((el) => {
    el.href = profile.social.github;
  });
  document.querySelectorAll("[data-linkedin]").forEach((el) => {
    el.href = profile.social.linkedin;
  });
  document.querySelector("[data-year]").textContent = new Date().getFullYear();

  document.querySelector("[data-skills]").innerHTML = profile.skills
    .map((skill) => `<span class="skill">${escapeHtml(skill)}</span>`)
    .join("");
}

function renderEducation() {
  const education = content.education || [];
  const target = document.querySelector("[data-education]");
  if (!target) return;

  target.innerHTML = education
    .map(
      (entry) => `
        <article class="education">
          <div class="education-row">
            <div>
              <h4 class="education-school">${escapeHtml(entry.school)}</h4>
              <p class="education-degree">${escapeHtml(entry.degree)}</p>
              <p class="education-location">${escapeHtml(entry.location || "")}</p>
            </div>
            <p class="education-dates">${escapeHtml(entry.dates)}</p>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderExperience() {
  const experience = content.experience || [];
  document.querySelector("[data-experience]").innerHTML = experience
    .map((job) => {
      const companyName = escapeHtml(job.company);
      const companyLabel = job.url
        ? `<a class="experience-company-link" href="${escapeHtml(job.url)}" target="_blank" rel="noreferrer">${companyName}<span aria-hidden="true"> ↗</span></a>`
        : companyName;
      const logo = job.logo
        ? `<img class="experience-logo" src="${escapeHtml(job.logo)}" alt="${companyName} logo" width="44" height="44" loading="lazy" />`
        : "";

      return `
        <article class="experience">
          <div class="experience-header">
            ${logo}
            <h4 class="experience-company">${companyLabel}</h4>
          </div>
          ${(job.roles || [])
            .map(
              (role) => `
            <div class="experience-role">
              <div class="experience-role-row">
                <p class="experience-title">${escapeHtml(role.title)}</p>
                <p class="experience-dates">${escapeHtml(role.dates)}</p>
              </div>
              <ul class="experience-bullets">
                ${(role.bullets || [])
                  .map((bullet) => `<li>${escapeHtml(bullet)}</li>`)
                  .join("")}
              </ul>
            </div>
          `,
            )
            .join("")}
        </article>
      `;
    })
    .join("");
}

function renderProjects() {
  document.querySelector("[data-projects]").innerHTML = content.projects
    .map((project) => {
      const isArticle = /\.md$/i.test(project.link || "");
      const linkAttrs = isArticle
        ? `href="#projects" data-post-file="${escapeHtml(project.link)}" role="button"`
        : `href="${escapeHtml(project.link)}"`;
      return `
        <article class="project">
          <span class="project-number">${escapeHtml(project.number)}</span>
          <h3>${escapeHtml(project.title)}</h3>
          <div class="project-copy-wrap">
            <p class="project-copy">${escapeHtml(project.description)}</p>
            <div class="project-tags">
              ${project.tags
                .filter(Boolean)
                .map((tag) => `<span>${escapeHtml(tag)}</span>`)
                .join("")}
            </div>
          </div>
          <a class="project-link" ${linkAttrs} aria-label="${escapeHtml(project.linkLabel)}">↗</a>
        </article>
      `;
    })
    .join("");
}

function inlineMarkdown(text) {
  return text
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
      const isVideo = /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(src);
      if (isVideo) {
        return `<video src="${src}" controls playsinline preload="metadata" title="${alt}"></video>`;
      }
      return `<img src="${src}" alt="${alt}" loading="lazy" />`;
    })
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
    const basePath = file.includes("/") ? file.slice(0, file.lastIndexOf("/") + 1) : "";
    let html = markdownToHtml(await response.text());
    html = html.replace(
      /(<(?:img|video)[^>]+src=")(?!https?:\/\/|\/|data:)([^"]+)(")/g,
      `$1${basePath}$2$3`,
    );
    readerContent.innerHTML = html;
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

function getTheme() {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

function syncThemeToggle(theme) {
  const button = document.querySelector("[data-theme-toggle]");
  const icon = document.querySelector("[data-theme-toggle-icon]");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!button || !icon) return;

  const nextTheme = theme === "light" ? "dark" : "light";
  // Show the destination theme: sun → light, moon → dark
  icon.textContent = nextTheme === "light" ? "☀" : "☾";
  button.setAttribute("aria-label", `Switch to ${nextTheme} theme`);
  if (meta) {
    meta.setAttribute("content", theme === "light" ? "#f3ebe0" : "#1a1612");
  }
}

function setTheme(theme) {
  const next = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  try {
    localStorage.setItem("theme", next);
  } catch (error) {
    /* ignore quota / private mode */
  }
  syncThemeToggle(next);
}

function bindThemeToggle() {
  const button = document.querySelector("[data-theme-toggle]");
  if (!button) return;
  syncThemeToggle(getTheme());
  button.addEventListener("click", () => {
    setTheme(getTheme() === "dark" ? "light" : "dark");
  });
}

function bindHeaderScroll() {
  const header = document.querySelector(".site-header");
  const nav = document.querySelector(".site-nav");
  if (!header) return;

  let lastY = window.scrollY;
  let ticking = false;

  const update = () => {
    const y = window.scrollY;
    const menuOpen = nav?.classList.contains("is-open");

    if (menuOpen || y < 40) {
      header.classList.remove("is-hidden");
    } else if (y > lastY + 6) {
      header.classList.add("is-hidden");
    } else if (y < lastY - 6) {
      header.classList.remove("is-hidden");
    }

    lastY = y;
    ticking = false;
  };

  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    },
    { passive: true },
  );
}

function bindInteractions() {
  const menuButton = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".site-nav");
  const header = document.querySelector(".site-header");

  menuButton.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    menuButton.setAttribute("aria-expanded", String(isOpen));
    if (isOpen) header?.classList.remove("is-hidden");
  });
  nav.querySelectorAll("a").forEach((link) =>
    link.addEventListener("click", () => {
      nav.classList.remove("is-open");
      menuButton.setAttribute("aria-expanded", "false");
    }),
  );

  document.querySelectorAll("[data-post-file]").forEach((post) => {
    const open = (event) => {
      event.preventDefault();
      openReader(post.dataset.postFile);
    };
    post.addEventListener("click", open);
    post.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openReader(post.dataset.postFile);
      }
    });
  });

  document.querySelectorAll("[data-close-reader]").forEach((button) =>
    button.addEventListener("click", closeReader),
  );
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeReader();
  });

  bindThemeToggle();
  bindHeaderScroll();
}

renderProfile();
renderEducation();
renderExperience();
renderProjects();
bindInteractions();
