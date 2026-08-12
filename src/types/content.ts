import type { LocalizedValue } from '@/lib/localized';

/**
 * Shape of `content/<page>/<entry-id>/entry.toml` *as authored* — every text field may
 * still be a localized table (`{ en = "…", zh = "…" }`).
 */
export interface RawCardAttachment {
    file: string;
    label?: LocalizedValue<string>;
    type?: string;
}

export interface RawCardEntry {
    order?: number;
    title?: LocalizedValue<string>;
    subtitle?: LocalizedValue<string>;
    date?: LocalizedValue<string>;
    content?: LocalizedValue<string>;
    tags?: LocalizedValue<string[]>;
    link?: string;
    image?: string;
    attachments?: RawCardAttachment[];
}

/**
 * The same entry *after* `getTomlContent` has collapsed every localized table into the
 * active locale. This is what the card loader actually sees.
 */
export interface ResolvedCardAttachment {
    file?: string;
    label?: string;
    type?: string;
}

export interface ResolvedCardEntry {
    order?: number;
    title?: string;
    subtitle?: string;
    date?: string;
    content?: string;
    tags?: string[];
    link?: string;
    image?: string;
    attachments?: ResolvedCardAttachment[];
}
