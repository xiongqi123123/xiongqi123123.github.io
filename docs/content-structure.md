# 内容结构手册 (Content Structure Guide)

这份文档说明本站的内容模型: **内容放在哪、怎么加一篇论文 / 一个奖项、多语言怎么写**。
加内容 (论文 / 奖项 / 服务 / 页面 / 翻译) 不需要改任何 `src/` 下的代码;
唯一的例外是**新增一门语言**时要额外补一份界面文案, 见 3.1 节第 4 步。

---

## 1. 三条铁律 (违反其一, 内容就会静默丢失)

| # | 铁律 | 违反后果 |
|---|---|---|
| 1 | Markdown 里的资源引用一律写 **`/assets/...` 开头的绝对路径** | 相对路径在 `/awards/` 这类目录式 URL 下会被浏览器解析成 `/awards/xxx`, 构建期零报错, 线上 404。**例外**: `entry.toml` / `entry.bib` 里可以只写裸文件名 (如 `cover.png`), 它会按"本条目文件夹"解析成 `/assets/<页面>/<条目>/cover.png`, 并且同样受构建期校验 |
| 2 | BibTeX 的自定义字段名 **必须全小写** (`selected` / `preview` / `pdf` / `code` / `description` / `keywords`) | 写成 `Preview` / `PDF` / `Selected` 会被解析器完全忽略, 而且也不会出现在页面的 BibTeX 框里 (双重隐身) |
| 3 | 往条目文件夹里新丢了图片/PDF 之后, 要跑 **`npm run sync`** (或重启 dev server) | 开发中新加的资源不会自动出现在 `public/assets/` 下, 页面上就是裂图。改**文字** (toml/md/bib) 不用重启, dev 模式下不缓存内容, 刷新即生效 |

> 三条都有构建期兜底: `scripts/sync-assets.mjs` 会在 `npm run build` 之前校验命名、结构、`source` 指向、每一条资源引用 (绝对路径与裸文件名都查)、BibTeX 字段名大小写, 以及 localized value 的键是否都已登记, 出错直接让构建失败。**但只有用 `npm run build` / `npm run dev` 才会触发** —— 直接跑 `npx next build` 会绕过这道关卡。

---

## 2. 目录总览

`content/` 是内容的**唯一真源**, 里面所有东西 (包括图片和 PDF) 都要提交进 git。

```
content/
├── config.toml                       # 站点配置: 结构一份 + 各语言文案
│
├── site/                             # 站点级资源 (不属于任何条目)
│   ├── favicon.jpg
│   └── avatar.png
│
├── about/                            # 路由 /
│   ├── _page.toml                    # 页面级 meta + profile + sections
│   ├── bio.en.md
│   ├── bio.zh.md
│   └── news.toml
│
├── publications/                     # 路由 /publications/
│   ├── _page.toml
│   └── xiong2026mindmargin/          # ★ 文件夹名 == BibTeX citation key
│       ├── entry.bib
│       └── preview.png
│
├── awards/                           # 路由 /awards/
│   ├── _page.toml
│   ├── 2026-motrixarena-s1/
│   │   ├── entry.toml
│   │   ├── cover.png
│   │   └── certificate.pdf
│   ├── 2024-smart-car/{entry.toml, cover.png}
│   ├── 2024-craic/{entry.toml, cover.png}
│   ├── 2024-raicom/{entry.toml, cover.png}
│   └── 2024-optoelectronic/{entry.toml, cover.png}
│
├── services/                         # 路由 /services/
│   ├── _page.toml
│   └── ieee-iot-j-reviewer/entry.toml
│
└── cv/                               # 路由 /cv/
    ├── _page.toml
    ├── cv.en.md
    └── cv.zh.md
```

**核心思想: 一个文件夹 = 一个条目。** 一篇论文 / 一个奖项 / 一项服务的文本、封面图、证书 PDF 全部住在同一个文件夹里。加一篇论文 = 建一个文件夹, 不用再去三个地方翻。

### 资源是怎么到浏览器的

项目用了 `output: 'export'` + `images.unoptimized: true`, 浏览器只能取到 `public/` 下的文件。所以有一个 prebuild 钩子做镜像:

```
content/<相对路径>   --(scripts/sync-assets.mjs)-->   public/assets/<同样的相对路径>   -->   URL /assets/<同样的相对路径>
```

例: `content/awards/2024-craic/cover.png` → 引用时写 `/assets/awards/2024-craic/cover.png`。

`public/assets/` 是**生成物**, 已加入 `.gitignore`, 不要手工往里放文件 —— 下次 sync 会把不认识的文件当陈旧文件删掉。

相关命令:

```bash
npm run sync             # 手动同步一次
npm run sync -- --check  # 只校验, 不写盘 (CI / 提交前自查)
npm run dev              # predev 钩子会自动先 sync
npm run build            # prebuild 钩子会自动先 sync
```

---

## 3. 多语言: Localized Value

**多语言写在文件里, 不是写在目录名里。** 不存在 `content_zh/` 这种目录。任何一个文案字段都有三种写法:

```toml
# 形态 1: 纯字符串 => 所有语言共用 (日期、链接、机构名等)
date = "2024.08"

# 形态 2: 单行表 => 每种语言一份文案
title = { en = "Second Prize", zh = "二等奖" }

# 形态 3: 内容较长或是数组时, 用独立表, 更好读
[content]
en = "All-terrain locomotion control for quadruped robots."
zh = "四足机器人全地形控制任务。"
```

解析顺序: 当前语言 → `default_locale` → `locales` 里第一个存在的 key。

> ⚠️ **禁令**: `content/` 下的 TOML 里不要把 `en` / `zh` 当成普通数据键名 (比如别写一个叫 `en` 的普通字段), 否则会被误当成 localized value 解析掉。唯一的例外是 `content/config.toml` 里的 `[i18n]` 小节, 校验器与加载器都特判过它。
>
> ⚠️ **一张表里的语言 key 必须全部登记在 `[i18n] locales` 里**。混进一个没登记的 key (拼错的 `jp`、或"先加 key 后登记 locale") 会让整张表**不再被识别为 localized value**, 后果不是"少一门语言", 而是**所有语言同时丢掉这个字段** (`title` 会静默退化成文件夹名)。`npm run sync` 会拦下这种情况并指出是哪个文件的哪张表。

Markdown 走的是文件名后缀: `bio.zh.md` → `bio.en.md` → `bio.md`, 找到哪个用哪个。

### 新增一门语言 (例如日语 ja)

1. **先**在 `content/config.toml` 里登记 (顺序很重要: 没登记就去各文件加 key, 会触发上面那条禁令):
   ```toml
   [i18n]
   locales = ["zh", "en", "ja"]

   [i18n.labels]
   ja = "日本語"
   ```
2. 给需要翻译的 localized value **加一个 key** (`title = { en = "...", zh = "...", ja = "..." }`)。
3. 加 `content/about/bio.ja.md`、`content/cv/cv.ja.md`。
4. **界面文案要另外补一份**: 研究兴趣、Abstract / BibTeX / Code 按钮、搜索框占位、主题切换、Last updated、View All 等等**不在 `content/` 里**, 它们硬编码在 `src/lib/i18n/messages.ts`。复制里面的 `const zh: LocaleMessages = {...}` 改成 `const ja`, 再加进文件末尾的 `messages` 映射。不补也能跑, 只是界面文字会全部回退成英文 (`getMessages()` 的兜底是 `en`) —— 内容是日语、按钮是英语, 很容易被误以为是自己配错了。

**不需要复制任何结构**: navigation 骨架、sections 列表、`features`、条目的图片/附件路径全站只有一份。漏翻的字段会自动回退到 `default_locale`。

---

## 4. 加一个奖项 / 一项服务 (card 页)

1. 建文件夹: `content/awards/<年份>-<赛事简称>/`
   命名只允许小写 ASCII `[a-z0-9-]`, 例如 `2025-robocup`。
2. 把封面图和证书 PDF 放进去, 文件名也要全小写 ASCII: `cover.png`、`certificate.pdf`。
3. 写 `entry.toml`:

```toml
order = 0                                          # 升序, 数字小的排前面; 不写的排到最后
date = "2025.06"                                   # 右上角日期胶囊, 原样显示
image = "/assets/awards/2025-robocup/cover.png"    # 也可以只写 "cover.png", 按本条目文件夹解析

title = { en = "RoboCup", zh = "机器人世界杯" }
subtitle = { en = "First Prize", zh = "一等奖" }

[content]
en = "One or two sentences. Markdown is supported."
zh = "一两句话描述，支持 Markdown。"

# 可选: 标签
# tags = { en = ["Robotics"], zh = ["机器人"] }

# 可选: 标题变成外链
# link = "https://example.com"

# 可选: 附件按钮 (证书 / 海报 / 幻灯片), 可以写多个 [[attachments]]
[[attachments]]
file = "/assets/awards/2025-robocup/certificate.pdf"
label = { en = "Certificate", zh = "获奖证书" }
```

4. `npm run sync` (或重启 dev), 刷新 `/awards/` 就能看到。

**注意**:
- 条目的 `id` 由**文件夹名**决定, 不要在 `entry.toml` 里写 `id`, 写了也会被覆盖。
- **不要**在 `content/awards/_page.toml` 里手写 `[[items]]`。条目列表由加载器扫描子文件夹自动生成。
- 排序规则: `order` 升序 → `date` 降序 → 文件夹名升序。想调顺序就改 `order`, 不要指望文件系统的天然顺序。
- 排序用的 `date` 取的是 **`default_locale` 那一支**, 所以就算 `date` 写成 localized value (`{ en = "2026 - Present", zh = "2026 至今" }`), 各语言的顺序也保持一致。仍然建议: 只要一页里有多个条目, 就显式写 `order`。
- 学术服务 (`content/services/<机构>-<角色>/entry.toml`) 用法完全一样。

---

## 5. 加一篇论文 (publication 页)

1. 建文件夹: `content/publications/<citation key>/`
   **文件夹名必须等于 BibTeX 的 citation key**, 例如 `xiong2026mindmargin`。构建期会强制校验, 不一致直接构建失败。
2. 把预览图和论文 PDF 放进去: `preview.png`、`paper.pdf`。
3. 写 `entry.bib`, **一个文件有且仅有一条** `@xxx{...}`:

```bibtex
@article{xiong2026mindmargin,
  selected={true},
  title = {Mind the Margin: ...},
  author = {Xiong, Qi and Zhang, Jinlai* and ...},
  year = {2026},
  month = aug,
  journal = {IEEE Robotics and Automation Letters (RA-L)},
  preview = {/assets/publications/xiong2026mindmargin/preview.png},
  pdf = {/assets/publications/xiong2026mindmargin/paper.pdf},
  doi = {...},
  code = {https://github.com/...},
  abstract = {...},
  description={首页/列表里显示的一句话摘要。},
  keywords={End-to-End Autonomous Driving, Motion Planning}
}
```

4. `npm run sync`, 刷新 `/publications/`。

**注意**:
- `selected={true}` (小写) 的论文会出现在首页的 Selected Publications 区。只认小写的 `{true}` / `{yes}`。
- 所有自定义字段名全小写 —— 见第 1 节铁律 2。
- 列表顺序由 bib 解析器按 `year` 降序 → `month` 降序自动排, 不用手工调。
- `author` 里的 `*` (通讯作者) 和 `#` (共同一作) 标记会被前端识别并渲染。

### MarginAD 论文 PDF 怎么放 (当前待办)

`entry.bib` 里原先写的 `pdf = {/papers/overview_horizon.pdf}` 是**死链** (文件从来不存在), 已在重构中移除, 所以现在 `/publications/` 页上没有 PDF 按钮。

真实 PDF 到手后:

1. 把文件放到 `content/publications/xiong2026mindmargin/paper.pdf`
2. 在 `content/publications/xiong2026mindmargin/entry.bib` 里加一行:
   ```
   pdf = {/assets/publications/xiong2026mindmargin/paper.pdf},
   ```
3. `npm run build` (prebuild 会自动把它镜像到 `public/assets/...`)

PDF 按钮就会自动出现。**文件放进去之前不要先写这一行** —— 引用校验会因为"引用了不存在的资源"直接让构建失败。

---

## 6. 页面级配置 `_page.toml`

每个页面目录下都有一个 `_page.toml`, 描述这个页面本身:

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `type` | `about` / `publication` / `card` / `text` | ✅ | 页面类型, 语言无关 |
| `title` | localized string | ✅ | 页面标题 (也是浏览器标签页的 `<title>`) |
| `description` | localized string | ❌ | 页面副标题 |
| `source` | string | `publication` / `text` 必填 | 相对 `content/` 根的路径或目录名 |
| `[profile]` | — | `about` 专用 | `research_interests` |
| `[[sections]]` | 数组 | `about` 专用 | 首页分区; `id`/`type`/`source`/`filter`/`limit` 语言无关, 只有 `title` 多语言 |
| `items` | — | **禁止手写** | card 页由加载器扫描子目录生成 |

### 加一个新页面

1. 建目录 `content/<slug>/` 和 `content/<slug>/_page.toml`。
2. 在 `content/config.toml` 里登记导航:
   ```toml
   [[navigation]]
   type = "page"
   target = "<slug>"      # 必须与目录名一致
   href = "/<slug>"       # 注意: 不带尾斜杠, 导航高亮依赖这个写法
   title = { en = "Projects", zh = "项目" }
   ```

`target` 有四重身份: 内容目录名、路由 slug、one-page 模式的 DOM id、导航锚点。**改一处就要四处一起改**, 所以尽量别改已有页面的 `target`。忘了建目录会让页面静默空白 —— 构建期的结构校验会拦下这种情况。

---

## 7. 已知遗留 (不是 bug, 是还没填的坑)

- **CV 只有骨架**: `content/cv/cv.en.md` / `content/cv/cv.zh.md` 里的模板假履历 ("The University of Example" / "某某大学" 那套) 已经清掉, 现在的内容全部来自 `content/` 里已有的事实 (学历、论文、奖项、服务)。经历、技能这些还没写, 需要自行补充。
- **`location_url` 是占位**: `content/config.toml` 里 `location_url = "https://maps.google.com"` 没有指向具体地点。
- **BibTeX 里不要写 LaTeX 细空格 `\,`**: 页面不跑 LaTeX, `0.60\,m` 会原样渲染成 `0.60,m` (读起来像断句错误)。直接写普通空格 `0.60 m`。现有 abstract 已经改过。
- **Markdown 里插图要写绝对路径**: 三处 Markdown 渲染都没有覆写 `img`, 所以 `bio.md` / `cv.md` 里写 `![](...)` 时路径必须是 `/assets/...` 开头。
- **部署不会自动触发**: `.github/workflows/deploy.yml` 的 push 触发目前是注释状态, 推上 `main` 不会自动上线, 需要手动 workflow_dispatch。改完内容后"线上没变"通常是这个原因, 不是构建挂了。
- **`svg2ico` 是没人用的遗留依赖**: 留在 `devDependencies` 里, 删它会引起 package-lock 大面积变更, 暂不处理。
- **图片没有压过**: `images.unoptimized: true` 意味着浏览器下的就是原图。`content/site/avatar.png` 有 1.5 MB 却只渲染成 256×256, 另有 3 张奖项封面在 1 MB 上下。想减带宽就自己重新导出 (缩到 512px / 转 WebP), 改完文件名记得同步改引用。
