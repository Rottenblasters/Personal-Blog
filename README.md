# Personal portfolio and blog

A responsive, dependency-free portfolio that can be hosted on GitHub Pages,
Netlify, Vercel, or any static web server.

## Update your information

Open `content.js`. This is the only file you need for routine updates:

- Edit `profile` to change your name, bio, links, skills, and email.
- Add or remove entries in `projects`.
- Add or remove entries in `posts`.

Place your PDF résumé in this folder as `resume.pdf`, or change the `resume`
path in `content.js`.

## Add a blog post

1. Create a Markdown file in this folder, for example `my-new-post.md`.
2. Add its title, excerpt, date, category, reading time, and filename to the
   `posts` list in `content.js`.
3. Set `featured: true` if it should be the large highlighted article.

The included Markdown reader supports headings, bold and italic text, links,
lists, quotes, code blocks, horizontal rules, and tables.

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
