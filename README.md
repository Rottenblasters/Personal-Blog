# Personal portfolio and blog

A responsive, dependency-free portfolio that can be hosted on GitHub Pages,
Netlify, Vercel, or any static web server.

## Update your information

Open `content.js`. This is the only file you need for routine updates:

- Edit `profile` to change your name, bio, links, skills, and email.
- Edit `education` for schools and degrees.
- Edit `experience` for work history.
- Add or remove entries in `projects` (case studies can point to Markdown files under `projects/`).

Place your PDF résumé in `resume/` (for example `resume/Anshul_Singh_Resume.pdf`), or change the `resume`
path in `content.js`. Case-study Markdown lives under `projects/`.

## Add a project case study

1. Create a Markdown file under `projects/`, for example `projects/my-case-study.md`.
2. Add a matching entry to the `projects` list in `content.js` with `link` set to that file.
3. Visitors can open the case study from the Projects section.

The included Markdown reader supports headings, bold and italic text, links,
lists, quotes, code blocks, horizontal rules, tables, images, and videos
(`.mp4`, `.webm`, `.ogg`, `.mov` via the same `![alt](path)` syntax as images).

## Preview locally

Markdown files must be viewed through a web server rather than by opening
`index.html` directly. From this folder, run either:

```powershell
py -m http.server 8000
```

or:

```powershell
npx serve .
```

Then open `http://localhost:8000`.

## Publish with GitHub Pages

In the GitHub repository, open **Settings → Pages**, select **Deploy from a
branch**, choose the `main` branch and root folder, then save.
