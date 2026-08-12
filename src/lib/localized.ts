/**
 * Localized values.
 *
 * The whole site keeps a single content tree (`content/`); multilingual text lives
 * *inside* the files rather than in per-locale directories. A value is "localized"
 * when it is a plain table whose keys are all locale codes:
 *
 *   title = { en = "Awards", zh = "奖项" }
 *
 *   [profile.research_interests]
 *   en = ["Robotics"]
 *   zh = ["机器人学"]
 *
 * Anything else (plain string, number, array, table with non-locale keys) is left
 * untouched, so language-independent structure is written exactly once.
 *
 * This module is pure (no `fs`), so it is safe to import from client components.
 */

export type LocalizedValue<T> = T | Record<string, T>;

export interface LocaleContext {
    /** All configured locales, normalized, in declaration order. e.g. ['zh', 'en'] */
    locales: string[];
    /** Fallback locale, normalized. Always a member of `locales`. */
    defaultLocale: string;
    /** The locale to resolve into. Normalized, always a member of `locales`. */
    locale: string;
}

/** `zh_CN` / ` ZH-cn ` -> `zh-cn`. Note the *global* underscore replacement. */
export function normalizeLocale(locale: string): string {
    return locale.trim().replace(/_/g, '-').toLowerCase();
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
    return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        !(value instanceof Date)
    );
}

/**
 * A localized table is a non-array, non-null plain object with a non-empty key set
 * whose every key is a configured locale.
 */
export function isLocalizedRecord(value: unknown, locales: string[]): boolean {
    if (!isPlainRecord(value)) {
        return false;
    }

    const keys = Object.keys(value);
    if (keys.length === 0) {
        return false;
    }

    return keys.every((key) => locales.includes(normalizeLocale(key)));
}

/**
 * Pick one branch out of a localized table:
 *   ctx.locale -> ctx.defaultLocale -> first locale (in `ctx.locales` order) present.
 * Non-localized values are returned untouched.
 */
export function resolveLocalized<T>(value: LocalizedValue<T>, ctx: LocaleContext): T {
    if (!isLocalizedRecord(value, ctx.locales)) {
        return value as T;
    }

    const table = value as Record<string, T>;
    const byLocale = new Map<string, T>();
    for (const [key, entry] of Object.entries(table)) {
        byLocale.set(normalizeLocale(key), entry);
    }

    for (const candidate of [ctx.locale, ctx.defaultLocale, ...ctx.locales]) {
        const found = byLocale.get(candidate);
        if (found !== undefined) {
            return found;
        }
    }

    // Unreachable: isLocalizedRecord() guarantees at least one locale key exists.
    return Object.values(table)[0];
}

function resolveDeepUnknown(value: unknown, ctx: LocaleContext): unknown {
    if (Array.isArray(value)) {
        return value.map((item) => resolveDeepUnknown(item, ctx));
    }

    if (isPlainRecord(value)) {
        if (isLocalizedRecord(value, ctx.locales)) {
            return resolveDeepUnknown(resolveLocalized(value, ctx), ctx);
        }

        const resolved: Record<string, unknown> = {};
        for (const [key, entry] of Object.entries(value)) {
            resolved[key] = resolveDeepUnknown(entry, ctx);
        }
        return resolved;
    }

    return value;
}

/**
 * Recursively resolve every localized table inside `value`.
 * Arrays are mapped, localized tables collapse to one branch (which is then
 * resolved again), plain tables are walked, everything else passes through.
 */
export function resolveDeep<T>(value: T, ctx: LocaleContext): T {
    return resolveDeepUnknown(value, ctx) as T;
}
