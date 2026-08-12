#!/usr/bin/env node
/**
 * sync-assets.mjs — content/ 资源 -> public/assets/ 镜像同步器
 * ============================================================================
 * 为什么需要它:
 *   next.config.ts 用了 output:'export' + images.unoptimized:true, 浏览器能取到的
 *   资源只能来自 public/。但内容模型要求"一个条目 = 一个文件夹, 文本与图片/PDF 同居"
 *   (content/<page>/<entry-id>/)。本脚本就是两者之间的桥:
 *
 *     content/<相对路径>  ->  public/assets/<同样的相对路径>  ->  URL /assets/<同样的相对路径>
 *
 *   同时它是整条内容链路上唯一的 fail-loud 关卡 (加载器其余部分全是静默降级):
 *     V1 命名校验   目录名/资源名必须全小写 ASCII (macOS 不敏感 / CI 敏感, 否则线上 404)
 *                   页面级目录 (含 _page.toml 的一级目录) 另外必须匹配加载器的
 *                   PAGE_ID_PATTERN, 否则 sync 放行而 next build 才炸
 *     V2 结构校验   每个 navigation page target 都要有 _page.toml;
 *                   _page.toml 的 type 必须是 about|publication|card|text;
 *                   type/section 声明的 source 指向的文本源必须真实存在
 *     V3 引用校验   资源引用必须真实存在, 两种写法都查:
 *                     - 任意文本里字面量 /assets/...
 *                     - entry.toml 的 image / [[attachments]].file 与 entry.bib 的
 *                       preview / pdf 里的裸文件名 (相对本条目文件夹)
 *     V4 反向检查   没有被任何地方引用的资源 -> 警告 (孤儿文件哨子)
 *     V5 条目校验   card 页子目录要有 entry.toml; publication 子目录要有 entry.bib
 *                   且 bib citation key === 文件夹名; bib 字段名必须全小写
 *                   (bibtex-parse-js 保留原样大小写, 加载器按小写取值 -> 静默丢失)
 *     V6 i18n 校验  localized table 的键必须全部登记在 [i18n] locales 里;
 *                   混入未登记的键会让整张表不再被识别为 localized value, 于是所有
 *                   语言同时丢内容 (title 静默退化成文件夹名), 全链路零报错
 *
 * 用法:
 *   node scripts/sync-assets.mjs            写盘 (由 npm 的 predev/prebuild 自动调用)
 *   node scripts/sync-assets.mjs --check    只校验 + 报告差异, 不写盘 (CI / 人工核对)
 *
 * 实现约束: 全同步 fs API (异步没 await 完就退出 = 半拉子产物且零报错)。唯一的依赖是
 *   smol-toml —— 加载器用的同一个解析器, 校验器必须和它看到同一棵树, 否则正则近似
 *   出来的结论跟运行时对不上 (localized value 是内联表, 正则根本抓不住)。
 */

import fs from 'node:fs';
import path from 'node:path';
import { parse as parseToml } from 'smol-toml';

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------
const CONTENT_DIR = path.join(process.cwd(), 'content');
const OUT_DIR = path.join(process.cwd(), 'public', 'assets');

// ★ 白名单, 绝不用黑名单 —— content/ 下同目录躺着 toml/bib/md 源文件,
//   黑名单漏一个就会把内容源码发布到 public/ 里去。
const ASSET_EXT = new Set([
    '.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.svg', '.ico',
    '.pdf', '.mp4', '.webm',
]);
const TEXT_EXT = new Set(['.toml', '.bib', '.md']);
const SKIP_DIR = new Set(['node_modules', '.git', '.DS_Store']);
const NAME_RE = /^[a-z0-9_][a-z0-9._-]*$/; // 目录名/entry id: 全小写, 它同时是 URL 路径段
// 资源文件名: 允许大小写混用 (MarginAD.pdf 这种论文原名), 仍禁空格与非 ASCII —— 前者要
// 百分号编码, 后者在 URL 里更糟。大小写不一致导致的 "macOS 能开 / CI 上 404" 由 S5 引用校验
// 兜底: expectedUrls 是按真实文件名建的 Set, Set.has() 大小写敏感, 拼错大小写照样构建失败。
const ASSET_NAME_RE = /^[A-Za-z0-9_][A-Za-z0-9._-]*$/;

// utimesSync 走的是 Date/浮点秒, 在 APFS 这类高精度文件系统上会引入亚毫秒级抖动
// (实测 0.37ms), 直接用 === 比较 mtime 会让脚本永远判定"过期", 幂等性失效。
// 2ms 容差远小于任何真实编辑造成的时间差, 且有 size 相等作为第二道保险。
const MTIME_TOLERANCE_MS = 2;

const CHECK_ONLY = process.argv.includes('--check');

const errors = [];
const warnings = [];
const err = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

const toPosix = (p) => p.split(path.sep).join('/');

// ---------------------------------------------------------------------------
// S1 扫描 content/
// ---------------------------------------------------------------------------
/** @type {Map<string, {abs: string, size: number, mtimeMs: number}>} 相对路径 -> 元信息 */
const assets = new Map();
/** @type {string[]} 相对路径 */
const textFiles = [];
/** @type {string[]} 相对路径 */
const unknownFiles = [];

function scanContent(absDir, relDir) {
    const entries = fs.readdirSync(absDir, { withFileTypes: true });
    for (const ent of entries) {
        if (ent.name.startsWith('.') || SKIP_DIR.has(ent.name)) continue;
        const abs = path.join(absDir, ent.name);
        const rel = relDir ? `${relDir}/${ent.name}` : ent.name;

        if (ent.isDirectory()) {
            // V1: 目录名必须全小写 ASCII
            if (!NAME_RE.test(ent.name)) {
                err(`[naming] directory name must match ${NAME_RE} (lowercase ASCII): content/${rel}`);
            }
            scanContent(abs, rel);
            continue;
        }
        if (!ent.isFile()) continue;

        const ext = path.extname(ent.name).toLowerCase();
        if (ASSET_EXT.has(ext)) {
            // V1: 资源文件名必须是 ASCII 且不含空格 (非 ASCII / 空格在 URL 里都要百分号编码)
            if (!ASSET_NAME_RE.test(ent.name)) {
                err(`[naming] asset file name must match ${ASSET_NAME_RE} (ASCII, no spaces): content/${rel}`);
            }
            const st = fs.statSync(abs);
            assets.set(rel, { abs, size: st.size, mtimeMs: st.mtimeMs });
        } else if (TEXT_EXT.has(ext)) {
            textFiles.push(rel);
        } else {
            unknownFiles.push(rel);
        }
    }
}

if (!fs.existsSync(CONTENT_DIR) || !fs.statSync(CONTENT_DIR).isDirectory()) {
    console.error('[sync-assets] FATAL: content/ directory not found');
    process.exit(1);
}
scanContent(CONTENT_DIR, '');

// ---------------------------------------------------------------------------
// S2 解析全部 TOML (一次), 解析失败即硬错误
//   加载器遇到坏 TOML 只 console.error 后返回 null, 页面变空白但构建照样绿。
// ---------------------------------------------------------------------------
/** @type {Map<string, Record<string, unknown>>} 相对路径 -> 解析结果 */
const tomlDocs = new Map();
for (const rel of textFiles) {
    if (!rel.endsWith('.toml')) continue;
    try {
        tomlDocs.set(rel, parseToml(fs.readFileSync(path.join(CONTENT_DIR, rel), 'utf-8')));
    } catch (e) {
        err(`[toml] content/${rel}: ${e.message}`);
    }
}

const isTable = (v) =>
    typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Date);
const contentExists = (rel) => fs.existsSync(path.join(CONTENT_DIR, rel));
/** `zh_CN` / ` ZH-cn ` -> `zh-cn`. 必须与 src/lib/localized.ts 的 normalizeLocale 一致。 */
const normalizeLocale = (v) => String(v).trim().replace(/_/g, '-').toLowerCase();

// ---------------------------------------------------------------------------
// S3a config.toml: locales + navigation (V2)
// ---------------------------------------------------------------------------
const config = tomlDocs.get('config.toml');

/** @type {string[]} 已登记的语言, 已归一化 */
let LOCALES = [];
let DEFAULT_LOCALE = '';

if (!contentExists('config.toml')) {
    err('[structure] missing content/config.toml');
} else if (config) {
    const i18n = isTable(config.i18n) ? config.i18n : {};
    LOCALES = Array.isArray(i18n.locales)
        ? i18n.locales.filter((l) => typeof l === 'string').map(normalizeLocale)
        : [];
    if (LOCALES.length === 0) {
        err('[structure] content/config.toml: [i18n] locales must be a non-empty array of strings');
    }
    DEFAULT_LOCALE =
        typeof i18n.default_locale === 'string' ? normalizeLocale(i18n.default_locale) : '';
    if (DEFAULT_LOCALE && !LOCALES.includes(DEFAULT_LOCALE)) {
        err(`[structure] content/config.toml: [i18n] default_locale "${i18n.default_locale}" is not in locales`);
        DEFAULT_LOCALE = '';
    }
    if (!DEFAULT_LOCALE) DEFAULT_LOCALE = LOCALES[0] ?? '';

    const navigation = Array.isArray(config.navigation) ? config.navigation : [];
    let pageTargets = 0;
    for (const item of navigation) {
        if (!isTable(item) || item.type !== 'page') continue;
        pageTargets++;
        const target = typeof item.target === 'string' ? item.target : '';
        if (!target) {
            err('[structure] a [[navigation]] entry with type="page" has no target');
            continue;
        }
        if (!contentExists(`${target}/_page.toml`)) {
            err(`[structure] navigation target "${target}" has no content/${target}/_page.toml`);
        }
    }
    if (pageTargets === 0) warn('[structure] content/config.toml declares no [[navigation]] page');
}

// ---------------------------------------------------------------------------
// S3b V6: localized table 的键必须全部登记在 [i18n] locales 里
//   混入一个未登记的键 (拼错的 `jp`, 或先加 key 后登记 locale) 会让整张表不再被
//   识别为 localized value —— 于是所有语言同时丢内容, 而且全链路零报错。
// ---------------------------------------------------------------------------
function checkLocaleKeys(rel, value, keyPath) {
    if (Array.isArray(value)) {
        value.forEach((item, i) => checkLocaleKeys(rel, item, `${keyPath}[${i}]`));
        return;
    }
    if (!isTable(value)) return;

    const keys = Object.keys(value);
    const localeKeys = keys.filter((k) => LOCALES.includes(normalizeLocale(k)));
    if (localeKeys.length > 0 && localeKeys.length !== keys.length) {
        const unknown = keys.filter((k) => !LOCALES.includes(normalizeLocale(k)));
        err(
            `[i18n] content/${rel}: table "${keyPath || '<root>'}" mixes locale key(s) ` +
            `[${localeKeys.join(', ')}] with unregistered key(s) [${unknown.join(', ')}] — ` +
            `add them to [i18n] locales in content/config.toml first, or the whole table ` +
            `stops being a localized value and every language loses this field`
        );
        return; // 已经报过, 不再下钻
    }

    for (const [k, v] of Object.entries(value)) {
        checkLocaleKeys(rel, v, keyPath ? `${keyPath}.${k}` : k);
    }
}

if (LOCALES.length > 0) {
    for (const [rel, doc] of tomlDocs) {
        if (rel === 'config.toml') {
            // [i18n] 自己以语言代码为键 (locales/labels), 那是注册表不是 localized value
            for (const [k, v] of Object.entries(doc)) {
                if (k !== 'i18n') checkLocaleKeys(rel, v, k);
            }
            continue;
        }
        checkLocaleKeys(rel, doc, '');
    }
}

// ---------------------------------------------------------------------------
// S3c 逐个页面目录 (V2 type/source + V5 条目 + V3 裸名引用收集)
// ---------------------------------------------------------------------------
const VALID_PAGE_TYPES = new Set(['about', 'publication', 'card', 'project', 'text']);
// 必须与 src/lib/content.ts 的 PAGE_ID_PATTERN 逐字一致: 那里对不匹配的 pageId 直接
// throw, 校验器放行的名字会在 next build 预渲染时才炸。
const PAGE_DIR_RE = /^[a-z0-9-]+$/;
const EXTERNAL_RE = /^([a-z][a-z0-9+.-]*:|\/\/)/i;

/** @type {{rel: string, field: string, raw: string, url: string}[]} 裸名引用, 待 S5 校验 */
const structuredRefs = [];

/**
 * 收集 entry.toml / entry.bib 里的资源引用。
 * 绝对路径与外链交给 S5 的字面量扫描 (或原样放行), 这里只负责裸名 ->
 * `/assets/<scope>/<name>`, 规则与 src/lib/assetPath.ts 的 resolveAssetPath 一致。
 */
function collectAssetRef(rel, field, value, scope) {
    if (typeof value !== 'string') return;
    const trimmed = value.trim();
    if (!trimmed) return;
    if (EXTERNAL_RE.test(trimmed) || trimmed.startsWith('/')) return;
    const name = trimmed.replace(/^\.\//, '');
    structuredRefs.push({ rel, field, raw: trimmed, url: `/assets/${scope}/${name}` });
}

/** 加载器的 markdown 回退链: `<base>.<locale>.md` -> `<base>.<default>.md` -> `<source>` */
function markdownResolvable(source) {
    if (contentExists(source)) return true;
    const ext = path.extname(source);
    const base = ext ? source.slice(0, source.length - ext.length) : source;
    return DEFAULT_LOCALE ? contentExists(`${base}.${DEFAULT_LOCALE}${ext}`) : false;
}

function checkSectionSources(rel, sections) {
    if (!Array.isArray(sections)) return;
    for (const section of sections) {
        if (!isTable(section)) continue;
        const id = typeof section.id === 'string' ? section.id : '?';
        const source = typeof section.source === 'string' ? section.source : '';
        switch (section.type) {
            case 'markdown':
                if (!source || !markdownResolvable(source)) {
                    err(`[structure] content/${rel}: section "${id}" (markdown) source "${source}" not found under content/`);
                }
                break;
            case 'list':
                if (!source || !contentExists(source)) {
                    err(`[structure] content/${rel}: section "${id}" (list) source "${source}" not found under content/`);
                }
                break;
            case 'publications':
                if (source && !contentExists(source)) {
                    err(`[structure] content/${rel}: section "${id}" (publications) source "${source}" not found under content/`);
                }
                break;
            default:
                break;
        }
    }
}

for (const ent of fs.readdirSync(CONTENT_DIR, { withFileTypes: true })) {
    if (!ent.isDirectory() || ent.name.startsWith('.') || SKIP_DIR.has(ent.name)) continue;
    const pageId = ent.name;
    const pageDir = path.join(CONTENT_DIR, pageId);
    const pageTomlRel = `${pageId}/_page.toml`;
    if (!contentExists(pageTomlRel)) continue; // 例如 content/site/ 不是页面, 跳过

    // V1': 页面目录名比普通目录更严 —— 它同时是路由 slug 与加载器的 pageId
    if (!PAGE_DIR_RE.test(pageId)) {
        err(`[naming] page directory name must match ${PAGE_DIR_RE} (it is also the route slug): content/${pageId}`);
    }

    const page = tomlDocs.get(pageTomlRel);
    if (!page) continue; // 解析失败, S2 已经报过

    const pageType = typeof page.type === 'string' ? page.type : null;
    if (!pageType) {
        err(`[structure] content/${pageTomlRel} has no type = "..."`);
        continue;
    }
    if (!VALID_PAGE_TYPES.has(pageType)) {
        err(
            `[structure] content/${pageTomlRel} has invalid type="${pageType}" ` +
            `(expected one of ${[...VALID_PAGE_TYPES].join('|')}); the router would render a 404 page instead`
        );
        continue;
    }

    // V2': source 指向的文本源必须存在 (缺了不会 404, 只会得到一个"结构完好的空白页")
    const pageSource = typeof page.source === 'string' ? page.source : '';
    if (pageType === 'text') {
        if (!pageSource) {
            err(`[structure] content/${pageTomlRel} (type="text") has no source = "..."`);
        } else if (!markdownResolvable(pageSource)) {
            err(`[structure] content/${pageTomlRel}: source "${pageSource}" not found under content/`);
        }
    }
    if (pageType === 'publication') {
        if (!pageSource) {
            err(`[structure] content/${pageTomlRel} (type="publication") has no source = "..."`);
        } else if (!contentExists(pageSource)) {
            err(`[structure] content/${pageTomlRel}: source "${pageSource}" not found under content/`);
        }
    }
    if (pageType === 'about') {
        checkSectionSources(pageTomlRel, page.sections);
    }

    if (pageType !== 'card' && pageType !== 'publication') continue;

    const subDirs = fs
        .readdirSync(pageDir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
        .map((d) => d.name)
        .sort();

    if (subDirs.length === 0) {
        warn(`[structure] content/${pageId}/ (type="${pageType}") contains no entry folder`);
    }

    for (const id of subDirs) {
        const scope = `${pageId}/${id}`;

        if (pageType === 'card') {
            const entryRel = `${scope}/entry.toml`;
            if (!contentExists(entryRel)) {
                err(`[structure] missing content/${entryRel} (card entry)`);
                continue;
            }
            const entry = tomlDocs.get(entryRel);
            if (!entry) continue; // 解析失败, S2 已经报过
            collectAssetRef(entryRel, 'image', entry.image, scope);
            if (Array.isArray(entry.attachments)) {
                for (const att of entry.attachments) {
                    if (isTable(att)) collectAssetRef(entryRel, 'attachments.file', att.file, scope);
                }
            }
            continue;
        }

        // publication
        const bibRel = `${scope}/entry.bib`;
        if (!contentExists(bibRel)) {
            err(`[structure] missing content/${bibRel} (publication entry)`);
            continue;
        }
        const bibText = fs.readFileSync(path.join(CONTENT_DIR, bibRel), 'utf-8');
        const bibEntries = bibText.match(/@\w+\s*\{\s*[^,\s]+\s*,/g) || [];
        if (bibEntries.length === 0) {
            err(`[structure] content/${bibRel} contains no BibTeX entry`);
            continue;
        }
        if (bibEntries.length > 1) {
            err(`[structure] content/${bibRel} contains ${bibEntries.length} entries; exactly 1 is allowed`);
        }
        const key = bibEntries[0].match(/@\w+\s*\{\s*([^,\s]+)\s*,/)[1];
        if (key !== id) {
            err(`[structure] citation key "${key}" != folder name "${id}" in content/${bibRel}`);
        }

        // V5': 字段名必须全小写。bibtex-parse-js 原样保留大小写, 而 src/lib/bibtexParser.ts
        // 按 `tags.preview` / `tags.pdf` 这样的小写键取值 —— `Preview = {...}` 会静默丢失。
        for (const m of bibText.matchAll(/^[ \t]*([A-Za-z][A-Za-z0-9_-]*)[ \t]*=/gm)) {
            const field = m[1];
            if (field !== field.toLowerCase()) {
                err(`[bibtex] content/${bibRel}: field "${field}" must be lowercase ("${field.toLowerCase()}"), otherwise the loader silently drops it`);
            }
        }

        // 裸名引用: preview = {preview.png} / pdf = {paper.pdf}
        for (const m of bibText.matchAll(/^[ \t]*(preview|pdf|pdfurl)[ \t]*=[ \t]*\{([^{}]*)\}/gim)) {
            collectAssetRef(bibRel, m[1].toLowerCase(), m[2], scope);
        }
    }
}

// ---------------------------------------------------------------------------
// S4 计算期望产物
// ---------------------------------------------------------------------------
/** @type {Map<string, {src: string, dst: string, url: string, size: number, mtimeMs: number}>} rel -> plan */
const expected = new Map();
/** @type {Set<string>} 所有合法的 /assets/... URL */
const expectedUrls = new Set();

for (const [rel, meta] of assets) {
    const relPosix = toPosix(rel);
    expected.set(rel, {
        src: meta.abs,
        dst: path.join(OUT_DIR, rel),
        url: `/assets/${relPosix}`,
        size: meta.size,
        mtimeMs: meta.mtimeMs,
    });
    expectedUrls.add(`/assets/${relPosix}`);
}

// ---------------------------------------------------------------------------
// S5 引用校验 (V3) —— 死链在构建期就炸掉, 而不是上线后静默 404
// ---------------------------------------------------------------------------
const REF_RE = /\/assets\/[A-Za-z0-9._\-/]+/g;
/** @type {Set<string>} 被真实引用到的 URL */
const referenced = new Set();

for (const rel of textFiles) {
    const abs = path.join(CONTENT_DIR, rel);
    const lines = fs.readFileSync(abs, 'utf-8').split('\n');
    lines.forEach((line, i) => {
        const found = line.match(REF_RE);
        if (!found) return;
        for (const ref of found) {
            if (expectedUrls.has(ref)) {
                referenced.add(ref);
            } else {
                err(`[reference] content/${rel}:${i + 1}: ${ref}  (no such file under content/)`);
            }
        }
    });
}

// 裸文件名 (S3c 收集): resolveAssetPath 把它们拼成 /assets/<scope>/<name>, 字面量扫描
// 看不见它们, 不查就是"代码鼓励、校验器全盲"的死链盲区。
for (const ref of structuredRefs) {
    if (expectedUrls.has(ref.url)) {
        referenced.add(ref.url);
    } else {
        err(`[reference] content/${ref.rel}: ${ref.field} = "${ref.raw}" -> ${ref.url}  (no such file under content/)`);
    }
}

// ---------------------------------------------------------------------------
// S6 反向检查 (V4, 仅警告) —— 孤儿资源哨子
// ---------------------------------------------------------------------------
for (const [rel, plan] of expected) {
    if (!referenced.has(plan.url)) {
        warn(`unreferenced asset: content/${toPosix(rel)}`);
    }
}

// ---------------------------------------------------------------------------
// 校验汇总: 有 error 就在写盘之前中止
// ---------------------------------------------------------------------------
function reportAndMaybeExit() {
    for (const w of warnings) console.warn(`[sync-assets] [warn] ${w}`);
    if (errors.length > 0) {
        for (const e of errors) console.error(`[sync-assets] [error] ${e}`);
        console.error(`[sync-assets] FAILED: ${errors.length} error(s); nothing was written.`);
        process.exit(1);
    }
}
reportAndMaybeExit();

// ---------------------------------------------------------------------------
// S7 写盘 (幂等: 第二次运行必须 0 copied)
// ---------------------------------------------------------------------------
let copied = 0;
let upToDate = 0;
const pendingCopies = [];

for (const [, plan] of expected) {
    let same = false;
    if (fs.existsSync(plan.dst)) {
        const dstStat = fs.statSync(plan.dst);
        same =
            dstStat.size === plan.size &&
            Math.abs(dstStat.mtimeMs - plan.mtimeMs) <= MTIME_TOLERANCE_MS;
    }
    if (same) {
        upToDate++;
        continue;
    }
    pendingCopies.push(plan);
}

// ---------------------------------------------------------------------------
// S8 陈旧文件清理: 只在 public/assets/ 子树内做 diff 删除
//   绝对禁止 rm -rf public/assets 后重拷 (中途失败 = 全站缺图),
//   也绝对禁止触碰 public/assets/ 以外的任何路径。
// ---------------------------------------------------------------------------
const staleFiles = [];
function collectStale(absDir) {
    if (!fs.existsSync(absDir)) return;
    for (const ent of fs.readdirSync(absDir, { withFileTypes: true })) {
        const abs = path.join(absDir, ent.name);
        if (ent.isDirectory()) {
            collectStale(abs);
        } else if (ent.isFile()) {
            const rel = path.relative(OUT_DIR, abs);
            if (!expected.has(rel)) staleFiles.push(abs);
        }
    }
}
collectStale(OUT_DIR);

if (CHECK_ONLY) {
    if (pendingCopies.length > 0 || staleFiles.length > 0) {
        for (const p of pendingCopies) console.error(`[sync-assets] [check] out of date: ${toPosix(path.relative(process.cwd(), p.dst))}`);
        for (const f of staleFiles) console.error(`[sync-assets] [check] stale: ${toPosix(path.relative(process.cwd(), f))}`);
        console.error(`[sync-assets] --check FAILED: ${pendingCopies.length} out of date, ${staleFiles.length} stale. Run "npm run sync".`);
        process.exit(1);
    }
    console.log(`[sync-assets] --check OK: ${expected.size} assets up-to-date, 0 stale`);
    process.exit(0);
}

for (const plan of pendingCopies) {
    fs.mkdirSync(path.dirname(plan.dst), { recursive: true });
    fs.copyFileSync(plan.src, plan.dst);
    // 对齐 mtime 是幂等的关键: 下次运行才能判定为 up-to-date
    const srcStat = fs.statSync(plan.src);
    fs.utimesSync(plan.dst, srcStat.atime, srcStat.mtime);
    copied++;
}

let removed = 0;
for (const f of staleFiles) {
    fs.rmSync(f);
    removed++;
}

// 自底向上删掉空目录 (保留 public/assets/ 本身)
function pruneEmptyDirs(absDir) {
    if (!fs.existsSync(absDir)) return;
    for (const ent of fs.readdirSync(absDir, { withFileTypes: true })) {
        if (ent.isDirectory()) pruneEmptyDirs(path.join(absDir, ent.name));
    }
    if (absDir !== OUT_DIR && fs.readdirSync(absDir).length === 0) fs.rmdirSync(absDir);
}
fs.mkdirSync(OUT_DIR, { recursive: true });
pruneEmptyDirs(OUT_DIR);

// ---------------------------------------------------------------------------
// S9 摘要
// ---------------------------------------------------------------------------
if (unknownFiles.length > 0) {
    console.warn(
        `[sync-assets] [warn] ${unknownFiles.length} file(s) under content/ have an unrecognised extension and were NOT synced: ` +
        unknownFiles.map((f) => `content/${toPosix(f)}`).join(', ')
    );
}
console.log(
    `[sync-assets] ${expected.size} assets synced (${copied} copied, ${upToDate} up-to-date), ${removed} stale removed`
);
process.exit(0);
