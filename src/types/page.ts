export interface BasePageConfig {
    type: 'about' | 'publication' | 'card' | 'project' | 'text';
    title: string;
    description?: string;
}

export interface PublicationPageConfig extends BasePageConfig {
    type: 'publication';
    /** Directory name (e.g. "publications") or a single file path, relative to `content/`. */
    source: string;
}

export interface TextPageConfig extends BasePageConfig {
    type: 'text';
    /** File path relative to `content/`, e.g. "cv/cv.md". */
    source: string;
}

/** Attachment of a card entry (certificate PDF, poster, slides, …). */
export interface CardAttachment {
    /** Site-absolute path; always starts with '/' (guaranteed by the loader). */
    file: string;
    /** Button label; the loader falls back to the file name. */
    label: string;
    /** Inferred from the file extension when not given explicitly. */
    type: 'pdf' | 'image' | 'file';
}

export interface CardItem {
    /** Entry id — always the `content/<page>/<entry-id>/` folder name. */
    id: string;
    /** Explicit sort key, ascending. Entries without one sort last. */
    order?: number;
    title: string;
    subtitle?: string;
    date?: string;
    content?: string;
    tags?: string[];
    link?: string;
    /** Already resolved to a site-absolute path by the loader. */
    image?: string;
    attachments?: CardAttachment[];

    // --- project entries only -------------------------------------------------
    /** Marks a project as representative; the homepage block shows only these. */
    selected?: boolean;
    /** GitHub star count. Hand-written: a static export has no backend to fetch it live. */
    stars?: number;
    /** Long description behind the "Details" toggle. Markdown. */
    details?: string;
}

/**
 * Open-source projects. Entries load through the same `content/<page>/<entry-id>/entry.toml`
 * pipeline as card pages; only the rendering differs (project cards mirror publication cards).
 */
export interface ProjectPageConfig extends BasePageConfig {
    type: 'project';
    items: CardItem[];
}

export interface CardPageConfig extends BasePageConfig {
    type: 'card';
    /** Aggregated by the loader from `content/<page>/<entry-id>/entry.toml`; never undefined. */
    items: CardItem[];
}
