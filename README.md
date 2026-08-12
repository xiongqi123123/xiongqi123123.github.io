<div align="center">
  <img src="./logo.png" alt="PRISM Logo" height="100"/>
</div>

# PRISM

**English** · [中文](README_cn.md) · [Demo](https://prism-demo.pages.dev)  · [Changelog](CHANGELOG.md)

**If you like this project, please give it a star ⭐️**

PRISM stands for **P**ortfolio & **R**esearch **I**nterface **S**ite **M**aker. It is a modern, configurable, and high-performance personal website template built with Next.js, Tailwind CSS, and TypeScript. It is designed for researchers, developers, and academics to showcase their work, publications, and portfolio with ease.

Feel free to customize your own version of PRISM with coding agents.

## ✨ Features

*   **📄 Configuration-Driven**: Manage your entire site's content using simple `TOML`, `Markdown`, and `BibTeX` files in the `content/` directory. No code changes required for content updates!
*   **📚 BibTeX Support**: Directly render your publications from a `.bib` file. Includes search, filtering (Year, Type), and automatic citation generation.
*   **🎨 Modern Design**: Clean, responsive UI with a beautiful serif/sans-serif typography pairing, smooth animations (Framer Motion), and Dark Mode support.
*   **⚡️ High Performance**: Built on Next.js 20 with Turbopack. Static export ensures blazing fast load times and easy deployment.
*   **🔍 SEO Optimized**: Dynamic metadata generation for every page.
*   **🧩 Dynamic Routing**: Easily add new pages by simply creating a config file.

## 🚀 Getting Started

### Prerequisites

*   Node.js 22 or later
    *   **Important**: Please download and install Node.js manually from [https://nodejs.org/en/download](https://nodejs.org/en/download).
    *   Better not to use the pre-installed version on your system, as it may be outdated or incompatible.
*   npm, pnpm, or yarn

### Installation

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/xyjoey/PRISM.git
    cd PRISM
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Run the development server:**

    ```bash
    npm run dev
    ```

    Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 🛠️ Configuration

All content lives in the `content/` directory — **one folder per entry**, with its text, images and PDFs living together. See **[docs/content-structure.md](docs/content-structure.md)** for the full guide.

```
content/
├── config.toml                  # Site config (structure once + per-language copy)
├── site/                        # Site-level assets (favicon, avatar)
├── about/                       # Route /        — _page.toml, bio.<locale>.md, news.toml
├── publications/                # Route /publications/
│   └── <citation-key>/          #   entry.bib + preview.png (+ paper.pdf)
├── awards/                      # Route /awards/
│   └── <entry-id>/              #   entry.toml + cover.png (+ certificate.pdf)
├── services/                    # Route /services/
│   └── <entry-id>/entry.toml
└── cv/                          # Route /cv/     — _page.toml, cv.<locale>.md
```

### 1. Global Site Config (`content/config.toml`)
Configure your site title, author details, social links, and navigation menu here. Language-independent structure is written **once**; only the copy is per-language.

```toml
[site]
title = { en = "Your Name", zh = "你的名字" }
description = { en = "Personal website of Your Name", zh = "某某某的个人主页" }
favicon = "/assets/site/favicon.jpg"

[author]
name = { en = "Your Name", zh = "你的名字" }
title = { en = "PhD Student / Researcher", zh = "博士生 / 研究员" }
avatar = "/assets/site/avatar.png"

[features]
enable_likes = true

[[navigation]]
type = "page"
target = "awards"      # == content/awards/ folder name == route slug
href = "/awards"
title = { en = "Awards", zh = "奖项" }
```

### 2. Homepage (`content/about/_page.toml`)
Customize the "About" section, "News", and "Selected Publications" on the homepage. Bio text lives in `content/about/bio.<locale>.md`, news items in `content/about/news.toml`.

### 3. Publications (`content/publications/<citation-key>/entry.bib`)
Each paper gets its own folder, named exactly after its BibTeX citation key, holding one `entry.bib` plus that paper's own preview image and PDF. Customize the display by changing the `selected`, `preview`, `pdf` and `description` keys in the bib file.

**Custom bib field names must be all-lowercase** (`selected` / `preview` / `pdf` / `code` / `description`) — `Preview` or `PDF` are silently ignored.

Publication titles support a subset of BibTeX inline formatting commands, including `\textit{}`, `\emph{}`, `\textbf{}`, `\textsc{}`, `\textsuperscript{}` and `\textsubscript{}`.

### 4. Assets (`/assets/...`)
Because the site is a static export, browsers can only reach files under `public/`. A prebuild hook mirrors every image/PDF from `content/` into `public/assets/`, keeping the same relative path:

```
content/awards/2024-craic/cover.png  ->  public/assets/awards/2024-craic/cover.png  ->  /assets/awards/2024-craic/cover.png
```

So **always reference assets as `/assets/...` absolute paths**. `public/assets/` is generated and git-ignored; the source of truth is `content/`. After dropping a new file into an entry folder, run `npm run sync` (or restart the dev server).

```bash
npm run sync             # mirror content/ assets into public/assets/
npm run sync -- --check  # validate only, no writes (CI / pre-commit)
```

`npm run dev` and `npm run build` run this automatically via `predev` / `prebuild` hooks. Note that invoking `npx next build` directly bypasses them.

### 5. Adding New Pages
To add a new page (e.g., "Projects"), create `content/projects/_page.toml` and add a matching `[[navigation]]` entry (with `target = "projects"`) to `content/config.toml`.

Supported page types:
*   `text`: Renders Markdown content (Great for CVs, Bio).
*   `card`: Renders a list of cards (Great for Projects, Awards). Each card is its own `<entry-id>/entry.toml` folder; content supports Markdown, and entries can carry `attachments` (certificates, posters).
*   `publication`: Renders the full publications list with filters.

### 6. I18N Support (localized values)
**Multi-language copy lives inside the files, not in separate directories.** There is no `content_<locale>/`.

```toml
date = "2024.08"                                    # plain string  -> shared by all languages
title = { en = "Second Prize", zh = "二等奖" }        # localized     -> one value per language

[content]                                           # same thing, nicer for long text/arrays
en = "Description in English."
zh = "中文描述。"
```

Resolution order: current locale → `default_locale` → first available. Markdown uses filename suffixes instead: `bio.zh.md` → `bio.en.md` → `bio.md`.

Adding a language means adding **one key** to the localized values you want translated (plus `bio.<locale>.md` / `cv.<locale>.md`) and registering it under `[i18n] locales` and `[i18n.labels]`. No structure is ever duplicated — navigation, sections and asset paths exist exactly once.

Configure language behavior in `content/config.toml`:

## 📦 Deployment

PRISM is optimized for static deployment.

```bash
npm run build
```

This generates a static `out/` directory that can be hosted anywhere.

👉 **[Read the full Deployment Guide](docs/deployment.md)** for instructions on deploying to **GitHub Pages** and **Cloudflare Pages**.

## 📂 Project Structure

```
PRISM/
├── content/              # ✨ Single source of truth: text AND assets, one folder per entry
├── public/               # Only generated output: public/assets/ (git-ignored)
├── scripts/
│   └── sync-assets.mjs   # Mirrors content/ assets -> public/assets/ + validates content
├── docs/
│   └── content-structure.md   # How to add a paper / an award / a language
├── src/
│   ├── app/              # Next.js App Router
│   ├── components/       # React components
│   ├── lib/              # Utility functions (parsers, config loaders)
│   └── types/            # TypeScript definitions
├── next.config.ts        # Next.js configuration
└── tailwind.config.ts    # Tailwind CSS configuration
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
