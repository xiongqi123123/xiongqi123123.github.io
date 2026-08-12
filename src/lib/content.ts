import fs from 'fs';
import path from 'path';
import { parse } from 'smol-toml';
import { getContentRoot, getLocaleContext } from '@/lib/config';
import { resolveDeep } from '@/lib/localized';
import { resolveAssetPath } from '@/lib/assetPath';
import type { CardAttachment, CardItem } from '@/types/page';

/**
 * `content/` is the single source of truth.
 *
 *   content/<page>/_page.toml                 page-level meta
 *   content/<page>/<entry-id>/entry.toml      one card entry  (awards, services, …)
 *   content/<page>/<entry-id>/entry.bib       one publication (citation key === folder name)
 *   content/<dir>/<name>.<locale>.md          markdown, per locale
 *
 * Multilingual text lives inside the files as localized tables; there is no
 * `content_<locale>/` directory any more.
 */

// Keep in sync with PAGE_DIR_RE in scripts/sync-assets.mjs, which rejects the same
// page-directory names up front so a bad name fails at sync time, not mid-build.
const PAGE_ID_PATTERN = /^[a-z0-9-]+$/;

// Content files live outside the bundler's module graph, so nothing can invalidate
// these caches on edit. In `next dev` that would serve stale text until the server is
// restarted; caching is therefore production-only, where the tree is read once per build.
const CACHE_ENABLED = process.env.NODE_ENV === 'production';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.svg', '.ico']);

// --- path helpers -----------------------------------------------------------

/** Resolve a content-relative path, refusing anything that escapes `content/`. */
function resolveContentPath(relPath: string): string {
    const root = getContentRoot();
    const abs = path.resolve(root, relPath);

    if (abs !== root && !abs.startsWith(root + path.sep)) {
        throw new Error(`Content path escapes content/: ${relPath}`);
    }

    return abs;
}

function assertPageId(pageId: string): void {
    if (!PAGE_ID_PATTERN.test(pageId)) {
        throw new Error(`Invalid page id "${pageId}" (expected /^[a-z0-9-]+$/)`);
    }
}

function statOrNull(absPath: string): fs.Stats | null {
    try {
        return fs.statSync(absPath);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            console.error(`Error reading ${absPath}:`, error);
        }
        return null;
    }
}

function isFile(absPath: string): boolean {
    return statOrNull(absPath)?.isFile() ?? false;
}

/** Code-point comparison — deterministic across macOS and Linux, unlike `localeCompare`. */
function compareByCodePoint(a: string, b: string): number {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asText(value: unknown): string | undefined {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asTextArray(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) {
        return undefined;
    }
    const items = value.filter((item): item is string => typeof item === 'string');
    return items.length > 0 ? items : undefined;
}

// --- markdown ---------------------------------------------------------------

const markdownCache = new Map<string, string>();

/**
 * Read a markdown file, preferring the per-locale variant:
 *   `<dir>/<base>.<locale>.md` -> `<dir>/<base>.<defaultLocale>.md` -> `<dir>/<base>.md`
 */
export function getMarkdownContent(source: string, locale?: string): string {
    const ctx = getLocaleContext(locale);
    const cacheKey = `${source}::${ctx.locale}`;

    const cached = CACHE_ENABLED ? markdownCache.get(cacheKey) : undefined;
    if (cached !== undefined) {
        return cached;
    }

    const extension = path.extname(source);
    const base = extension ? source.slice(0, source.length - extension.length) : source;

    const candidates = [
        `${base}.${ctx.locale}${extension}`,
        `${base}.${ctx.defaultLocale}${extension}`,
        source,
    ];

    for (const candidate of candidates) {
        const abs = resolveContentPath(candidate);
        if (!isFile(abs)) {
            continue;
        }
        const content = fs.readFileSync(abs, 'utf-8');
        markdownCache.set(cacheKey, content);
        return content;
    }

    console.warn(`Missing markdown "${source}" for locale "${ctx.locale}" under content/.`);
    markdownCache.set(cacheKey, '');
    return '';
}

// --- bibtex -----------------------------------------------------------------

const bibtexCache = new Map<string, string>();

/**
 * Read BibTeX from either a directory of entries or a single file.
 *
 * Directory form (`source = "publications"`): every `content/<source>/<entry-id>/entry.bib`
 * is concatenated in ascending folder-name order. The order only has to be *stable*
 * (`parseBibTeX` re-sorts by year/month), but a stable order keeps the build output
 * byte-identical between macOS and CI.
 */
export function getBibtexContent(source: string, locale?: string): string {
    // BibTeX itself is language-independent; the locale only takes part in the cache key
    // so the signature can stay compatible with the other content getters.
    const ctx = getLocaleContext(locale);
    const cacheKey = `${source}::${ctx.locale}`;

    const cached = CACHE_ENABLED ? bibtexCache.get(cacheKey) : undefined;
    if (cached !== undefined) {
        return cached;
    }

    const abs = resolveContentPath(source);
    const stats = statOrNull(abs);
    let content = '';

    if (stats?.isDirectory()) {
        const entryIds = fs
            .readdirSync(abs, { withFileTypes: true })
            .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
            .map((entry) => entry.name)
            .sort(compareByCodePoint);

        const chunks: string[] = [];
        for (const entryId of entryIds) {
            const bibPath = path.join(abs, entryId, 'entry.bib');
            if (!isFile(bibPath)) {
                console.warn(`Missing content/${source}/${entryId}/entry.bib, skipping entry.`);
                continue;
            }
            chunks.push(fs.readFileSync(bibPath, 'utf-8'));
        }

        content = chunks.join('\n\n');
    } else if (stats?.isFile()) {
        content = fs.readFileSync(abs, 'utf-8');
    } else {
        console.warn(`Missing bibtex source "${source}" under content/.`);
    }

    bibtexCache.set(cacheKey, content);
    return content;
}

// --- toml -------------------------------------------------------------------

const tomlCache = new Map<string, unknown>();

/**
 * Read a TOML file and resolve every localized table inside it into `locale`.
 * The path is exact — per-locale file variants are not a thing for TOML.
 */
export function getTomlContent<T>(source: string, locale?: string): T | null {
    const ctx = getLocaleContext(locale);
    const abs = resolveContentPath(source);
    const cacheKey = `${abs}::${ctx.locale}`;

    if (CACHE_ENABLED && tomlCache.has(cacheKey)) {
        return tomlCache.get(cacheKey) as T | null;
    }

    let fileContent: string;
    try {
        fileContent = fs.readFileSync(abs, 'utf-8');
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            console.warn(`Missing TOML file "${source}" under content/.`);
        } else {
            console.error(`Error reading ${abs}:`, error);
        }
        tomlCache.set(cacheKey, null);
        return null;
    }

    let parsed: unknown;
    try {
        parsed = parse(fileContent);
    } catch (error) {
        console.error(`Error parsing TOML file ${source}:`, error);
        tomlCache.set(cacheKey, null);
        return null;
    }

    const resolved = resolveDeep(parsed, ctx);
    tomlCache.set(cacheKey, resolved);
    return resolved as T;
}

// --- card entries -----------------------------------------------------------

/** Entry folder names under `content/<pageId>/`, ascending. */
export function listEntryIds(pageId: string): string[] {
    assertPageId(pageId);

    const abs = resolveContentPath(pageId);
    if (!statOrNull(abs)?.isDirectory()) {
        return [];
    }

    return fs
        .readdirSync(abs, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
        .map((entry) => entry.name)
        .sort(compareByCodePoint);
}

function normalizeAttachmentType(value: unknown): CardAttachment['type'] | undefined {
    const text = asText(value)?.toLowerCase();
    return text === 'pdf' || text === 'image' || text === 'file' ? text : undefined;
}

function inferAttachmentType(file: string): CardAttachment['type'] {
    const extension = path.extname(file).toLowerCase();
    if (extension === '.pdf') {
        return 'pdf';
    }
    return IMAGE_EXTENSIONS.has(extension) ? 'image' : 'file';
}

function buildAttachments(value: unknown, scope: string): CardAttachment[] | undefined {
    if (!Array.isArray(value)) {
        return undefined;
    }

    const attachments: CardAttachment[] = [];

    for (const raw of value) {
        if (!isPlainRecord(raw)) {
            continue;
        }

        const declaredFile = asText(raw.file);
        const file = resolveAssetPath(declaredFile, scope);
        if (!file) {
            console.warn(`Skipping attachment without "file" in content/${scope}/entry.toml.`);
            continue;
        }

        attachments.push({
            file,
            label: asText(raw.label) ?? path.basename(declaredFile ?? file),
            type: normalizeAttachmentType(raw.type) ?? inferAttachmentType(file),
        });
    }

    return attachments.length > 0 ? attachments : undefined;
}

function toCardItem(pageId: string, entryId: string, raw: Record<string, unknown>): CardItem {
    const scope = `${pageId}/${entryId}`;

    if (isPlainRecord(raw.title)) {
        // Still a table after resolveDeep => its keys are not all registered locales, so the
        // whole table stopped being a localized value. Without this the title would silently
        // degrade to the folder name in *every* language. `npm run sync` fails on this too.
        console.warn(
            `content/${scope}/entry.toml: "title" is still a table after localization — ` +
            `every key must be registered in [i18n] locales in content/config.toml.`
        );
    }

    return {
        // The folder name is the id, always — anything written in the file is ignored.
        id: entryId,
        order: asNumber(raw.order),
        title: asText(raw.title) ?? entryId,
        subtitle: asText(raw.subtitle),
        date: asText(raw.date),
        content: asText(raw.content),
        tags: asTextArray(raw.tags),
        link: asText(raw.link),
        image: resolveAssetPath(asText(raw.image), scope),
        attachments: buildAttachments(raw.attachments, scope),
        selected: raw.selected === true,
        stars: asNumber(raw.stars),
        details: asText(raw.details),
    };
}

/** A card plus the language-independent key it is sorted by. */
interface SortableCardItem {
    item: CardItem;
    /**
     * `date` resolved into the *default* locale. `date` may be written as a localized
     * value (`{ en = "2026 - Present", zh = "2026 至今" }`), so sorting on the rendered
     * string would give `/awards/` a different order in each language — and the language
     * switch is a pure client-side re-render, so the list would visibly reshuffle.
     */
    sortDate: string;
}

/**
 * Deterministic card ordering, identical in every language:
 *   1. `order` ascending, entries without one last
 *   2. default-locale `date` descending (string comparison)
 *   3. `id` ascending
 * Never rely on `fs.readdirSync` order.
 */
function compareCardItems(a: SortableCardItem, b: SortableCardItem): number {
    const orderA = a.item.order ?? Number.POSITIVE_INFINITY;
    const orderB = b.item.order ?? Number.POSITIVE_INFINITY;
    if (orderA !== orderB) {
        return orderA - orderB;
    }

    if (a.sortDate !== b.sortDate) {
        return b.sortDate > a.sortDate ? 1 : -1;
    }

    return compareByCodePoint(a.item.id, b.item.id);
}

/** Aggregate `content/<pageId>/<entry-id>/entry.toml` into a sorted `CardItem[]`. */
export function getCardItems(pageId: string, locale?: string): CardItem[] {
    const ctx = getLocaleContext(locale);
    const entries: SortableCardItem[] = [];

    for (const entryId of listEntryIds(pageId)) {
        const source = `${pageId}/${entryId}/entry.toml`;
        const raw = getTomlContent<Record<string, unknown>>(source, ctx.locale);
        if (!raw || !isPlainRecord(raw)) {
            console.warn(`Missing or invalid content/${pageId}/${entryId}/entry.toml, skipping entry.`);
            continue;
        }

        const base =
            ctx.locale === ctx.defaultLocale
                ? raw
                : getTomlContent<Record<string, unknown>>(source, ctx.defaultLocale);

        entries.push({
            item: toCardItem(pageId, entryId, raw),
            sortDate: (isPlainRecord(base) ? asText(base.date) : undefined) ?? '',
        });
    }

    return entries.sort(compareCardItems).map((entry) => entry.item);
}

// --- page config ------------------------------------------------------------

const pageConfigCache = new Map<string, unknown>();

/**
 * Read `content/<pageId>/_page.toml`. Card pages get their `items` aggregated from the
 * entry folders next to it, so `items` is never hand-written and never undefined.
 */
export function getPageConfig<T = unknown>(pageId: string, locale?: string): T | null {
    assertPageId(pageId);

    const ctx = getLocaleContext(locale);
    const cacheKey = `${pageId}::${ctx.locale}`;

    if (CACHE_ENABLED && pageConfigCache.has(cacheKey)) {
        return pageConfigCache.get(cacheKey) as T | null;
    }

    const raw = getTomlContent<Record<string, unknown>>(`${pageId}/_page.toml`, locale);
    if (!raw) {
        console.warn(`Missing content/${pageId}/_page.toml`);
        pageConfigCache.set(cacheKey, null);
        return null;
    }

    const config: Record<string, unknown> =
        raw.type === 'card' || raw.type === 'project'
            ? { ...raw, items: getCardItems(pageId, locale) }
            : { ...raw };

    pageConfigCache.set(cacheKey, config);
    return config as T;
}
