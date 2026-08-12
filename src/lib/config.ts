import fs from 'fs';
import path from 'path';
import { parse } from 'smol-toml';
import type { I18nConfig } from '@/types/i18n';
import { getRuntimeI18nConfig } from '@/lib/i18n/config';
import {
  normalizeLocale,
  resolveLocalized,
  type LocaleContext,
  type LocalizedValue,
} from '@/lib/localized';

export interface SiteConfig {
  site: {
    title: string;
    description: string;
    favicon: string;
    last_updated?: string;
  };
  author: {
    name: string;
    title: string;
    institution: string;
    avatar: string;
    /** Extra roles rendered under `institution`, one line each. */
    affiliations?: string[];
  };
  social: {
    email?: string;
    location?: string;
    location_url?: string;
    location_details?: string[];
    google_scholar?: string;
    orcid?: string;
    github?: string;
    linkedin?: string;
    [key: string]: string | string[] | undefined;
  };
  features: {
    enable_likes: boolean;
    enable_one_page_mode?: boolean;
  };
  navigation: Array<{
    title: string;
    type: 'section' | 'page' | 'link';
    target: string;
    href: string;
  }>;
  /**
   * Legacy top-level `sections` surface. `content/config.toml` no longer carries it
   * (the about page owns its sections in `content/about/_page.toml`), so this is
   * always `undefined`. Kept only so the interface shape stays stable.
   */
  sections?: Array<{
    id: string;
    type: 'markdown' | 'publications' | 'list' | 'cards';
    source?: string;
    title?: string;
    filter?: string;
    limit?: number;
  }>;
  i18n?: I18nConfig;
}

const CONTENT_DIR = 'content';

// Content files live outside the bundler's module graph, so nothing can invalidate these
// caches on edit. In `next dev` that would serve stale text until the server restarts;
// caching is therefore production-only, where the whole tree is read once per build.
const CACHE_ENABLED = process.env.NODE_ENV === 'production';

type NavigationItem = SiteConfig['navigation'][number];

interface RawConfig {
  site?: Record<string, unknown>;
  author?: Record<string, unknown>;
  social?: Record<string, unknown>;
  features?: Record<string, unknown>;
  navigation?: unknown;
  i18n?: I18nConfig;
}

/** Absolute path of the one and only content root. */
export function getContentRoot(): string {
  return path.join(process.cwd(), CONTENT_DIR);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const items = value.filter((item): item is string => typeof item === 'string');
  return items.length === value.length ? items : undefined;
}

function record(value: unknown): Record<string, unknown> {
  return isPlainRecord(value) ? value : {};
}

// --- raw config (parsed once per process) -----------------------------------

let rawConfigCache: RawConfig | null = null;

function readRawConfig(): RawConfig {
  if (CACHE_ENABLED && rawConfigCache) {
    return rawConfigCache;
  }

  const configPath = path.join(getContentRoot(), 'config.toml');

  let fileContent: string;
  try {
    fileContent = fs.readFileSync(configPath, 'utf-8');
  } catch (error) {
    console.error(`Error reading ${configPath}:`, error);
    throw new Error('Failed to load content/config.toml');
  }

  let parsed: unknown;
  try {
    parsed = parse(fileContent);
  } catch (error) {
    console.error(`Error parsing ${configPath}:`, error);
    throw new Error('Failed to load content/config.toml');
  }

  if (!isPlainRecord(parsed)) {
    throw new Error('Failed to load content/config.toml');
  }

  rawConfigCache = parsed as RawConfig;
  return rawConfigCache;
}

// --- locale context ---------------------------------------------------------

const localeContextCache = new Map<string, LocaleContext>();

/**
 * Resolve the locale a caller asked for against `[i18n]`.
 *
 * Passing no locale (or an unknown one) yields `default_locale`, which is what keeps
 * `generateMetadata` / `generateStaticParams` / the SSR first paint on English.
 */
export function getLocaleContext(locale?: string): LocaleContext {
  const raw = readRawConfig();
  const runtime = getRuntimeI18nConfig(raw.i18n);
  const { locales, defaultLocale } = runtime;

  const requested = locale ? normalizeLocale(locale) : '';
  const target = requested && locales.includes(requested) ? requested : defaultLocale;

  const cached = CACHE_ENABLED ? localeContextCache.get(target) : undefined;
  if (cached) {
    return cached;
  }

  const context: LocaleContext = { locales, defaultLocale, locale: target };
  localeContextCache.set(target, context);
  return context;
}

// --- localized-value helpers (field whitelist, never a deep walk) ------------

function localizedString(value: unknown, ctx: LocaleContext): string | undefined {
  return asString(resolveLocalized(value as LocalizedValue<unknown>, ctx));
}

function buildSocial(rawSocial: Record<string, unknown>, ctx: LocaleContext): SiteConfig['social'] {
  const social: SiteConfig['social'] = {};

  for (const [key, value] of Object.entries(rawSocial)) {
    const resolved = resolveLocalized(value as LocalizedValue<unknown>, ctx);
    const text = asString(resolved);
    if (text !== undefined) {
      social[key] = text;
      continue;
    }
    const list = asStringArray(resolved);
    if (list !== undefined) {
      social[key] = list;
    }
  }

  return social;
}

function buildNavigation(rawNavigation: unknown, ctx: LocaleContext): NavigationItem[] {
  if (!Array.isArray(rawNavigation)) {
    return [];
  }

  return rawNavigation.filter(isPlainRecord).map((item) => ({
    title: localizedString(item.title, ctx) ?? '',
    // `type` / `target` / `href` are language-independent structure: passed through verbatim.
    type: (asString(item.type) ?? 'page') as NavigationItem['type'],
    target: asString(item.target) ?? '',
    href: asString(item.href) ?? '',
  }));
}

function buildSiteConfig(raw: RawConfig, ctx: LocaleContext): SiteConfig {
  const rawSite = record(raw.site);
  const rawAuthor = record(raw.author);
  const rawFeatures = record(raw.features);

  return {
    site: {
      title: localizedString(rawSite.title, ctx) ?? '',
      description: localizedString(rawSite.description, ctx) ?? '',
      favicon: asString(rawSite.favicon) ?? '',
      last_updated: localizedString(rawSite.last_updated, ctx),
    },
    author: {
      name: localizedString(rawAuthor.name, ctx) ?? '',
      title: localizedString(rawAuthor.title, ctx) ?? '',
      institution: localizedString(rawAuthor.institution, ctx) ?? '',
      avatar: asString(rawAuthor.avatar) ?? '',
      affiliations: asStringArray(resolveLocalized(rawAuthor.affiliations as LocalizedValue<unknown>, ctx)),
    },
    social: buildSocial(record(raw.social), ctx),
    features: {
      enable_likes: rawFeatures.enable_likes === true,
      enable_one_page_mode: rawFeatures.enable_one_page_mode === true,
    },
    navigation: buildNavigation(raw.navigation, ctx),
    sections: undefined,
    i18n: raw.i18n,
  };
}

// --- public entry point -----------------------------------------------------

const configCache = new Map<string, SiteConfig>();

/**
 * Read `content/config.toml` and resolve every localized text field into the given
 * locale. There is exactly one config file: navigation structure, `features` and
 * `[i18n]` are written once and shared by all languages.
 */
export function getConfig(locale?: string): SiteConfig {
  const ctx = getLocaleContext(locale);

  const cached = CACHE_ENABLED ? configCache.get(ctx.locale) : undefined;
  if (cached) {
    return cached;
  }

  const config = buildSiteConfig(readRawConfig(), ctx);
  configCache.set(ctx.locale, config);
  return config;
}
