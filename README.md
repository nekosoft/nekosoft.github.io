# Luda Hex — ludahex.nl

The website of [Luda Hex](https://ludahex.nl), the security consultancy of
Yianna Paris, and her engineering documentation site: research, working
notes and writing on Offensive and Application Security.

Much of this work reflects my process and methodology. The main audience
for this documentation is myself — to remind me of all the knowledge I
acquire, where from, and how I can put it into practice. I am making it
public bit by bit, hoping it might help someone else on their Offensive
and Application Security journey. Treat all information as work in
progress; it might shift around.

If you notice a typo, an incorrect or missing attribution, or you believe
a fact is incorrect, please open an
[Issue](https://github.com/nekosoft/nekosoft.github.io/issues/new) via
GitHub.

## Stack

Built with [Astro 5](https://astro.build). All content is plain markdown.

```
src/
├── content/
│   ├── docs/       # research documentation (web-recon, iot)
│   └── blog/       # blog posts — drop a .md file here to publish
├── layouts/        # Base, Docs, BlogPost layouts
├── components/     # header, footer, sidebar, cards, sparkles…
├── pages/          # landing, about, 404, docs + blog routes
└── styles/         # global.css — the Luda Hex design tokens
```

## Development

```sh
npm install
npm run dev       # local dev server with hot reload at localhost:4321
npm run build     # production build to dist/
npm run preview   # serve the production build locally
```

### Writing content

- **Blog post**: add `src/content/blog/my-post.md` with frontmatter
  `title`, `pubDate`, and optionally `description`, `tags`, `draft`.
- **Doc page**: add a `.md` under `src/content/docs/<section>/` with
  `title`, `section` (`web-recon` or `iot`) and `order` (sidebar
  position).

## Deployment

Pushes to `main` deploy to GitHub Pages via
`.github/workflows/deploy.yaml`. Development happens on feature
branches; changes reach `main` only through pull requests. The site is
served at [ludahex.nl](https://ludahex.nl) (`public/CNAME`).

## License

This work is licensed under a [Creative Commons
Attribution-NonCommercial-ShareAlike 4.0
International](https://creativecommons.org/licenses/by-nc-sa/4.0/)
(CC BY-NC-SA 4.0) license — see [LICENSE.md](LICENSE.md).

### You are free to:

- **Share** — copy and redistribute the material in any medium or format
- **Adapt** — remix, transform, and build upon the material

The licensor cannot revoke these freedoms as long as you follow the
license terms.

### Under the following terms:

- **Attribution** — You must give appropriate credit, provide a link to
  the license, and indicate if changes were made. You may do so in any
  reasonable manner, but not in any way that suggests the licensor
  endorses you or your use.
- **NonCommercial** — You may not use the material for commercial
  purposes.
- **ShareAlike** — If you remix, transform, or build upon the material,
  you must distribute your contributions under the same license as the
  original.
- **No additional restrictions** — You may not apply legal terms or
  technological measures that legally restrict others from doing
  anything the license permits.
