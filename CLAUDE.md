# CLAUDE.md

个人学术主页 (熊旗 / Qi Xiong), 基于 PRISM 模板。Next.js 15 静态导出 → GitHub Pages。

**内容怎么写, 看 [`docs/content-structure.md`](docs/content-structure.md)** —— 那是面向"填内容"的完整手册 (目录结构、多语言写法、加论文/奖项/项目的分步操作)。
本文件只讲**这份手册没覆盖的部分**: 改代码时的扩展路径、必须手工同步的地方、以及会咬人的坑。

---

## 命令

```bash
npm run dev      # 开发 (predev 会先跑 sync-assets)
npm run build    # 构建 (prebuild 会先跑 sync-assets), 产物在 out/
npm run sync     # 只跑资源同步 + 全量校验, 不构建
npx tsc --noEmit # 类型检查
```

**永远用 `npm run build`, 不要用 `npx next build`** —— 后者会绕过 `scripts/sync-assets.mjs` 这道校验关卡, 死链和结构错误就漏到线上了。

---

## 核心心智模型

**一个条目 = 一个文件夹, 该条目的文本和资源全在里面。**

```
content/<页面>/<条目 id>/
├── entry.toml   (或 entry.bib)
├── cover.png
└── certificate.pdf
```

`public/` 目录基本是空的。`content/**` 下的图片和 PDF 由 `scripts/sync-assets.mjs` 在 prebuild 时镜像到 `public/assets/<页面>/<条目 id>/`。**`public/assets/` 是生成物, 已在 `.gitignore` 里, 不要手工往里放东西。**

多语言不靠目录, 靠 localized value: `title = { en = "...", zh = "..." }`。语言无关的东西 (navigation 骨架、features、i18n、图片路径、链接) 全站只写一份。

---

## ⚠️ 必须手工同步的地方

这是本项目最容易出错的部分 —— **同一个事实存在多处, 没有任何自动同步机制**。改了一处务必回头改其他处。

| 事实 | 存在于 | 说明 |
|---|---|---|
| 论文 / 奖项 / 服务 / 实习 | `content/<页面>/<条目>/` **+** `content/cv/cv.en.md` **+** `cv.zh.md` **+** `README.md` **+** `README_cn.md` | CV 和 README 都是人工誊写的, 不从 content/ 生成 |
| 动态 (News) | `content/about/news.toml` **+** `README.md` **+** `README_cn.md` | 同上 |
| bio 正文 | `content/about/bio.en.md` / `bio.zh.md` **+** 两份 README 的"关于我" | 同上 |
| 开源项目 star 数 | `content/projects/<id>/entry.toml` 的 `stars` | 手写。README 用的是 shields.io 徽章, 那个实时; 站点是静态导出, 拉不了 |
| 站点更新日期 | `content/config.toml` 的 `last_updated` | 手写, 改完内容记得同步 |
| 研究兴趣 | `content/about/_page.toml` 的 `research_interests` **+** 两份 README | 同上 |

> 想减轻这个负担, 可以考虑让 `sync-assets.mjs` 从 content/ 生成 CV 和 README 的对应段落。目前**没做**, 是有意的取舍 —— 那两份文件的排版和站点差异较大。

---

## 代码扩展路径

### 加一个新的页面类型 (例如 `talk`)

改 6 处, 少一处就静默失效:

| # | 文件 | 改什么 |
|---|---|---|
| 1 | `src/types/page.ts` | `BasePageConfig['type']` 联合类型加成员; 定义 `XxxPageConfig` |
| 2 | `src/lib/content.ts` | `getPageConfig` 里决定要不要聚合 `items` (card/project 走 `getCardItems`) |
| 3 | `src/app/[slug]/page.tsx` | `loadDynamicPageData` 加分支 |
| 4 | `src/components/pages/DynamicPageClient.tsx` | 联合类型 + 渲染分支 |
| 5 | `scripts/sync-assets.mjs` | `VALID_PAGE_TYPES` 加进去, **否则构建直接失败** |
| 6 | `content/config.toml` | `[[navigation]]` 登记 + 建 `content/<slug>/_page.toml` |

### 首页再加一个分区

首页分区由 `content/about/_page.toml` 的 `[[sections]]` 顺序决定。加新类型要改 3 处:

1. `src/app/page.tsx` —— `SectionConfig['type']` 加成员; `processSections` 加 case (负责取数据、`filter`、`limit`)
2. `src/components/home/HomePageClient.tsx` —— `SectionConfig['type']` 同步; switch 加 case
3. 写个 `src/components/home/SelectedXxx.tsx` 组件

现有分区顺序: `about` → `news` (limit 5) → `featured_publications` → `featured_projects`。

### 加一门语言 (例如 ja)

1. `content/config.toml` 的 `[i18n]`: `locales` 加 `"ja"`, `[i18n.labels]` 加标签
2. 给**每一个** localized value 加 `ja` 键 (漏了会在构建期报错, 不会静默)
3. `src/lib/i18n/messages.ts` 加一份 `ja` UI 文案 (按钮、占位符这些)

**不需要**复制任何目录或结构化配置 —— 这是重构时的硬性设计目标。

### 组件对应关系

| 页面 | 组件 |
|---|---|
| 首页左栏 (头像/姓名/身份/联系方式/研究兴趣) | `src/components/home/Profile.tsx` |
| 论文卡片 | `src/components/publications/PublicationCard.tsx` |
| 开源项目卡片 | `src/components/projects/ProjectCard.tsx` |
| 奖项/服务卡片 | `src/components/pages/CardPage.tsx` |
| 动态 | `src/components/home/News.tsx` |

论文卡片和项目卡片是**两套独立布局**: 论文是"标题独占首行 + 左图 1/3 + 右信息", 项目是"64px 图标与标题同行 + 正文满宽"。改一个不会影响另一个。

---

## 坑 (都是实际踩过的)

- **论文文件夹名必须等于 BibTeX citation key**。IEEE 导出的数字 key (如 `10488639`) 不能直接用, 要改成 `wang2023rgbir` 这种。校验器会拦。
- **BibTeX 自定义字段名必须全小写**。写成 `Preview` / `PDF` 会被解析器**完全忽略**, 且不出现在页面 BibTeX 框里 (双重隐身)。校验器会拦。
- **`%` 在 `.bib` 条目内部不是注释**。要写注释就放在 `@article{` 之前 (条目外的文本 BibTeX 一律忽略)。
- **资源文件名**: ASCII 且无空格, 大小写可混用 (`MarginAD.pdf` 合法)。**目录名仍须全小写**, 因为它就是 URL 路径段。
- **`position: sticky` 要落在 grid 单元格上并配 `self-start`**。放在被 framer-motion 接管的内层 `motion.div` 上不生效: 一是 transform 干扰, 二是 grid 默认 `align-items: stretch` 把单元格拉满高度, 元素没有可移动余量。首页左栏就是这么修的。
- **`Cannot find module for page: /_not-found`** 这类构建报错是 Next 15.3.3 的 `.next` 缓存问题, **不是代码错误**。`rm -rf .next` 后重建即可。偶发, 已遇到两次。
- **部署不会自动触发**。`.github/workflows/deploy.yml` 的 push 触发是注释状态, 推 `main` 不会上线, 要手动 workflow_dispatch。"改了内容线上没变"通常是这个原因。
- **图片没压缩**。`images.unoptimized: true`, 浏览器下的就是原图。`content/site/avatar.png` 1.5 MB 却只渲染 256×256。

---

## 验证清单

改完内容或代码后, 这几条是判断"真的好了"的依据 (不要只看构建通过):

```bash
npm run build && npx tsc --noEmit          # 都要退出码 0
rm -rf public/assets && npm run build      # 验证 prebuild 钩子能从零重建资源

# 死链审计: 产物里每一条资源引用都要能落到真实文件
find out -type f \( -name '*.html' -o -name '*.js' -o -name '*.txt' \) -print0 \
 | xargs -0 grep -hoE '"/[^"]*\.(png|jpg|jpeg|pdf|svg|webp|ico)"' \
 | tr -d '"' | sort -u \
 | while read -r p; do [ -f "out$p" ] || echo "DEAD $p"; done
```

**滚动、hover、暗色模式这类观感, 静态产物验证不了** —— 需要 `npm run dev` 真实浏览器确认。改了这类东西要如实说明"只验证了 DOM/CSS, 没验证观感"。
