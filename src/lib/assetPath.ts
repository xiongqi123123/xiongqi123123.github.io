/**
 * The single asset-path rule for the whole site.
 *
 * Assets live next to the entry they belong to (`content/<page>/<entry-id>/…`) and are
 * mirrored to `public/assets/<same relative path>` by `scripts/sync-assets.mjs`
 * (wired to npm's `prebuild`/`predev` hooks), so the browser-visible URL is always
 * `/assets/<same relative path>`.
 *
 * With `output: 'export'` + `images.unoptimized`, `next/image` degrades to a plain
 * `<img>`: a relative path would be resolved against the current directory-style URL
 * (`/awards/` -> `/awards/cover.png`) and 404 at runtime with zero build-time errors.
 * Everything this function returns is therefore either an absolute site path or an
 * external URL.
 *
 * This module is pure (no `fs`), so it is safe to import from client components.
 */

const EXTERNAL = /^([a-z][a-z0-9+.-]*:|\/\/)/i;

/**
 * - external URL (`https:`, `//cdn…`, `data:`, `mailto:`) -> returned as-is
 * - site-absolute path (`/assets/…`, and any other `/…` for backwards compatibility) -> as-is
 * - bare file name / relative path -> `/assets/<scope>/<value>` (or `/assets/<value>` without a scope)
 * - empty or blank input -> `undefined`
 */
export function resolveAssetPath(value?: string, scope?: string): string | undefined {
    if (typeof value !== 'string') {
        return undefined;
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return undefined;
    }

    if (EXTERNAL.test(trimmed) || trimmed.startsWith('/')) {
        return trimmed;
    }

    const relative = trimmed.replace(/^\.\//, '');
    const normalizedScope = scope ? scope.replace(/^\/+|\/+$/g, '') : '';

    return normalizedScope ? `/assets/${normalizedScope}/${relative}` : `/assets/${relative}`;
}
