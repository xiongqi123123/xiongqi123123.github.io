<div align="center">
  <img src="./logo.png" alt="PRISM Logo" height="100"/>
</div>

# PRISM

[English](README.md) · **中文** · [在线演示](https://prism-demo.pages.dev) · [更新日志](CHANGELOG.md)

**如果你喜欢这个项目，请给一个 Star ⭐️**

PRISM 是 **P**ortfolio & **R**esearch **I**nterface **S**ite **M**aker（作品集与研究主页生成器）的缩写。这是一个基于 Next.js、Tailwind CSS 和 TypeScript 构建的现代化、高性能个人网站模板。

PRISM 专为**研究人员、开发者和学者**量身打造，只为让你能以最优雅、最轻松的方式，向世界展示你的工作成果、学术论文和个人履历。

你也可以借助编程智能体自定义属于自己的 PRISM 版本。

## ✨ 核心特性

*   **📄 配置驱动**：无需繁杂的代码！你只需在 `content/` 目录下编辑简单的 `TOML`、`Markdown` 和 `BibTeX` 文件即可管理全站内容。更新网站就像写文档一样简单。
*   **📚 原生 BibTeX 支持**：直接读取你的 `.bib` 文件渲染论文列表。支持按年份、类型筛选，支持搜索，甚至还能自动生成引用格式。
*   **🎨 现代美学设计**：干净清爽的响应式 UI，精心调配的衬线/无衬线字体排印，丝般顺滑的 Framer Motion 动画，以及完美支持深色模式。
*   **⚡️ 极致性能体验**：基于 Next.js 20 和 Turbopack 构建。静态导出确保了闪电般的加载速度，也让部署变得前所未有的简单。
*   **🔍 SEO 友好**：为每个页面自动动态生成元数据，让你的主页更容易被检索。
*   **🧩 灵活的动态路由**：只需新建一个配置文件，系统会自动为你处理好路由。

## 🚀 快速开始

### 前置要求

*   Node.js 22 或更高版本
    *   **重要提示**：请务必前往 [https://nodejs.org/en/download](https://nodejs.org/en/download) 手动下载并安装 Node.js。
    *   最好不要使用系统自带的包管理器安装的版本，因为它们通常较旧且可能导致兼容性问题。
*   npm, pnpm, 或 yarn

### 安装步骤

1.  **克隆仓库：**

    ```bash
    git clone https://github.com/xyjoey/PRISM.git
    cd PRISM
    ```

2.  **安装依赖：**

    ```bash
    npm install
    ```

3.  **启动开发服务器：**

    ```bash
    npm run dev
    ```

    在浏览器中打开 [http://localhost:3000](http://localhost:3000)，即可实时预览你的网站。

## 🛠️ 配置指南

所有的内容数据都存放在 `content/` 目录中，采用**「一个条目 = 一个文件夹」**的组织方式：一篇论文 / 一个奖项的文本、封面图、证书 PDF 全部住在同一个文件夹里。完整说明见 **[docs/content-structure.md](docs/content-structure.md)**。

```
content/
├── config.toml                  # 站点配置（结构一份 + 各语言文案）
├── site/                        # 站点级资源（favicon、头像）
├── about/                       # 路由 /              — _page.toml、bio.<locale>.md、news.toml
├── publications/                # 路由 /publications/
│   └── <citation-key>/          #   entry.bib + preview.png（+ paper.pdf）
├── awards/                      # 路由 /awards/
│   └── <entry-id>/              #   entry.toml + cover.png（+ certificate.pdf）
├── services/                    # 路由 /services/
│   └── <entry-id>/entry.toml
└── cv/                          # 路由 /cv/           — _page.toml、cv.<locale>.md
```

### 1. 全局站点配置 (`content/config.toml`)

在这里设置你的网站标题、作者信息、社交媒体链接以及顶部导航菜单。**与语言无关的结构只写一份**，只有文案是分语言的。

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
enable_likes = true # 是否开启点赞功能

[[navigation]]
type = "page"
target = "awards"      # 同时是 content/awards/ 目录名和路由 slug
href = "/awards"
title = { en = "Awards", zh = "奖项" }
```

### 2. 首页内容 (`content/about/_page.toml`)

自定义首页的“关于我 (About)”、“最新动态 (News)”以及“精选论文 (Selected Publications)”板块。个人简介正文在 `content/about/bio.<locale>.md`，动态条目在 `content/about/news.toml`。

### 3. 论文列表 (`content/publications/<citation-key>/entry.bib`)

每篇论文一个文件夹，**文件夹名必须等于 BibTeX 的 citation key**，里面放一个 `entry.bib` 和这篇论文自己的预览图、PDF。
*   **小贴士**：你可以在 bib 文件中通过添加 `selected`、`preview`、`pdf` 和 `description` 字段来自定义论文的展示效果（例如是否在首页置顶、添加封面图等）。
*   ⚠️ **bib 的自定义字段名必须全小写**（`selected` / `preview` / `pdf` / `code` / `description`）。写成 `Preview`、`PDF` 会被静默忽略。
*   论文标题支持部分 BibTeX 行内格式命令，包括 `\textit{}`、`\emph{}`、`\textbf{}`、`\textsc{}`、`\textsuperscript{}` 和 `\textsubscript{}`。

### 4. 图片与附件 (`/assets/...`)

因为本站是静态导出，浏览器只能访问 `public/` 下的文件。所以有一个 prebuild 钩子，会把 `content/` 里的图片和 PDF 按相同的相对路径镜像到 `public/assets/`：

```
content/awards/2024-craic/cover.png  ->  public/assets/awards/2024-craic/cover.png  ->  /assets/awards/2024-craic/cover.png
```

因此**引用资源一律写 `/assets/...` 开头的绝对路径**。`public/assets/` 是生成物，已被 git 忽略，真源永远是 `content/`。往条目文件夹里新丢了文件之后，记得跑一次 `npm run sync`（或重启 dev server）。

```bash
npm run sync             # 手动同步一次
npm run sync -- --check  # 只校验不写盘（CI / 提交前自查）
```

`npm run dev` 和 `npm run build` 会通过 `predev` / `prebuild` 钩子自动执行。注意直接跑 `npx next build` 会绕过这道钩子。

### 5. 添加新页面

想增加一个“项目展示”页？很简单：
1. 新建 `content/projects/_page.toml`。
2. 在 `content/config.toml` 里加一条 `[[navigation]]`，其 `target = "projects"` 必须与目录名一致。

PRISM 支持以下几种页面类型：

*   `text`: 纯文本渲染（Markdown），非常适合用来放 **个人简历 (CV)** 或 **详细介绍 (Bio)**。
*   `card`: 卡片列表布局，适合展示 **项目 (Projects)** 或 **获奖经历 (Awards)**。每张卡片是一个 `<entry-id>/entry.toml` 文件夹，`content` 字段支持 Markdown，还可以带 `attachments`（获奖证书、海报等附件按钮）。
*   `publication`: 完整的论文列表页，自带搜索和筛选器。

### 6. 多语言支持（localized value）

**多语言写在文件里，不是写在目录名里。** 已不存在 `content_<locale>/` 这种目录。

```toml
date = "2024.08"                                    # 纯字符串 -> 所有语言共用
title = { en = "Second Prize", zh = "二等奖" }        # 分语言文案

[content]                                           # 长文本/数组用独立表，更好读
en = "Description in English."
zh = "中文描述。"
```

解析顺序：当前语言 → `default_locale` → 第一个可用的语言。Markdown 则走文件名后缀：`bio.zh.md` → `bio.en.md` → `bio.md`。

新增一门语言 = 给需要翻译的字段**加一个 key**（外加 `bio.<locale>.md` / `cv.<locale>.md`），并在 `[i18n] locales` 和 `[i18n.labels]` 里登记。全程**不需要复制任何结构** —— 导航骨架、分区列表、资源路径全站只有一份。

在 `content/config.toml` 中配置多语言行为：

## 📦 部署上线

PRISM 针对静态部署进行了深度优化，你可以轻松将其托管在任何支持静态网站的平台上。

```bash
npm run build
```

运行上述命令后，会生成一个 `out/` 目录，这就是你网站的全部静态文件。

👉 **[点击阅读完整的部署指南](docs/deployment_cn.md)** （包含部署到 **GitHub Pages** 和 **Cloudflare Pages** 的详细教程）。

## 📂 项目结构概览

```
PRISM/
├── content/              # ✨ 内容唯一真源：文本与图片/PDF 同居，一个条目一个文件夹
├── public/               # 只剩生成物 public/assets/（已 git 忽略）
├── scripts/
│   └── sync-assets.mjs   # 把 content/ 的资源镜像到 public/assets/，并做内容校验
├── docs/
│   └── content-structure.md   # 内容结构手册：怎么加论文 / 奖项 / 新语言
├── src/
│   ├── app/              # Next.js App Router 核心逻辑
│   ├── components/       # React 组件库
│   ├── lib/              # 工具函数 (解析器, 配置加载器)
│   └── types/            # TypeScript 类型定义
├── next.config.ts        # Next.js 配置文件
└── tailwind.config.ts    # Tailwind CSS 配置文件
```

## 🤝 参与贡献

如果你有好的想法或发现了 Bug，欢迎提交 Pull Request 或 Issue。让我们一起把 PRISM 变得更好！

## 📄 开源协议

本项目遵循 MIT 开源协议 - 详情请参阅 [LICENSE](LICENSE) 文件。
