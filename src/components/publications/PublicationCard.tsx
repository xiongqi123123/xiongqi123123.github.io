'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import {
    BookOpenIcon,
    ClipboardDocumentIcon,
    DocumentTextIcon,
    DocumentArrowDownIcon
} from '@heroicons/react/24/outline';
import { Publication } from '@/types/publication';
import { cn } from '@/lib/utils';
import { resolveAssetPath } from '@/lib/assetPath';
import { useMessages } from '@/lib/i18n/useMessages';
import FormattedBibTeXText from './FormattedBibTeXText';

interface PublicationCardProps {
    publication: Publication;
    embedded?: boolean;
    index?: number;
}

export default function PublicationCard({ publication: pub, embedded = false, index = 0 }: PublicationCardProps) {
    const messages = useMessages();
    const [expandedBibtex, setExpandedBibtex] = useState(false);
    const [expandedAbstract, setExpandedAbstract] = useState(false);

    // Assets of a publication live in `content/publications/<citation key>/`, mirrored to
    // `/assets/publications/<citation key>/`. Absolute paths and external URLs pass through
    // untouched, so a bare file name in the .bib is just a shorthand for this entry's folder.
    // `scripts/sync-assets.mjs` validates both spellings, so a typo fails the build instead of
    // shipping a broken image.
    const assetScope = `publications/${pub.id}`;
    const previewSrc = resolveAssetPath(pub.preview, assetScope);
    const pdfHref = resolveAssetPath(pub.pdfUrl, assetScope);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 * index }}
            className="bg-white dark:bg-neutral-900 p-6 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-800 hover:shadow-md transition-all duration-200"
        >
            {/* Row 1 — the title always spans the full card width, so a long title wraps
                across the whole card instead of being squeezed beside the preview image. */}
            <h3 className={`${embedded ? "text-lg" : "text-xl"} font-semibold text-primary mb-4 leading-tight`}>
                <FormattedBibTeXText nodes={pub.titleNodes} fallback={pub.title} />
            </h3>

            {/* Row 2 — preview on the left (1/3), everything else on the right. */}
            <div className="flex flex-col md:flex-row gap-6">
                {previewSrc && (
                    <div className="w-full md:w-1/3 flex-shrink-0">
                        <div className="aspect-video md:aspect-[4/3] relative rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                            <Image
                                src={previewSrc}
                                alt={pub.title}
                                fill
                                className="object-contain p-1"
                                sizes="(max-width: 768px) 100vw, 33vw"
                            />
                        </div>
                    </div>
                )}
                {/* min-w-0 lets long unbreakable strings (DOIs, URLs) wrap instead of
                    stretching this flex child past the card. */}
                <div className="flex-1 min-w-0">
                    <p className={`${embedded ? "text-sm" : "text-base"} text-neutral-600 dark:text-neutral-400 mb-2`}>
                        {pub.authors.map((author, idx) => (
                            <span key={idx}>
                                <span className={`${author.isHighlighted ? 'font-semibold text-accent' : ''} ${author.isCoAuthor ? `underline underline-offset-4 ${author.isHighlighted ? 'decoration-accent' : 'decoration-neutral-400'}` : ''}`}>
                                    {author.name}
                                </span>
                                {author.isCorresponding && (
                                    <sup className={`ml-0 ${author.isHighlighted ? 'text-accent' : 'text-neutral-600 dark:text-neutral-400'}`}>†</sup>
                                )}
                                {idx < pub.authors.length - 1 && ', '}
                            </span>
                        ))}
                    </p>
                    <p className="text-sm font-medium text-neutral-800 dark:text-neutral-600 mb-3">
                        {pub.journal || pub.conference || pub.type.replace('-', ' ')} {pub.year}
                    </p>

                    {pub.description && (
                        <p className="text-sm text-neutral-600 dark:text-neutral-500 mb-4 line-clamp-3">
                            {pub.description}
                        </p>
                    )}

                    <div className="flex flex-wrap gap-2">
                        {pub.doi && (
                            <a
                                href={`https://doi.org/${pub.doi}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center px-3 py-1 rounded-md text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-accent hover:text-white transition-colors"
                            >
                                DOI
                            </a>
                        )}
                        {pub.code && (
                            <a
                                href={pub.code}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center px-3 py-1 rounded-md text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-accent hover:text-white transition-colors"
                            >
                                {messages.publications.code}
                            </a>
                        )}
                        {pdfHref && (
                            <a
                                href={pdfHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center px-3 py-1 rounded-md text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-accent hover:text-white transition-colors"
                            >
                                <DocumentArrowDownIcon className="h-3 w-3 mr-1.5" />
                                PDF
                            </a>
                        )}
                        {pub.abstract && (
                            <button
                                onClick={() => setExpandedAbstract(!expandedAbstract)}
                                className={cn(
                                    "inline-flex items-center px-3 py-1 rounded-md text-xs font-medium transition-colors",
                                    expandedAbstract
                                        ? "bg-accent text-white"
                                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-accent hover:text-white"
                                )}
                            >
                                <DocumentTextIcon className="h-3 w-3 mr-1.5" />
                                {messages.publications.abstract}
                            </button>
                        )}
                        {pub.bibtex && (
                            <button
                                onClick={() => setExpandedBibtex(!expandedBibtex)}
                                className={cn(
                                    "inline-flex items-center px-3 py-1 rounded-md text-xs font-medium transition-colors",
                                    expandedBibtex
                                        ? "bg-accent text-white"
                                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-accent hover:text-white"
                                )}
                            >
                                <BookOpenIcon className="h-3 w-3 mr-1.5" />
                                {messages.publications.bibtex}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Row 3 — abstract and BibTeX expand across the full card. Both are long-form
                (BibTeX is monospace and wide), so the 2/3 column would needlessly cramp them. */}
            <AnimatePresence>
                {expandedAbstract && pub.abstract ? (
                    <motion.div
                        key="abstract"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden mt-4"
                    >
                        <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700">
                            <p className="text-sm text-neutral-600 dark:text-neutral-500 leading-relaxed">
                                {pub.abstract}
                            </p>
                        </div>
                    </motion.div>
                ) : null}
                {expandedBibtex && pub.bibtex ? (
                    <motion.div
                        key="bibtex"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden mt-4"
                    >
                        <div className="relative bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700">
                            <pre className="text-xs text-neutral-600 dark:text-neutral-500 overflow-x-auto whitespace-pre-wrap font-mono">
                                {pub.bibtex}
                            </pre>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(pub.bibtex || '');
                                }}
                                className="absolute top-2 right-2 p-1.5 rounded-md bg-white dark:bg-neutral-700 text-neutral-500 hover:text-accent shadow-sm border border-neutral-200 dark:border-neutral-600 transition-colors"
                                title={messages.common.copyToClipboard}
                            >
                                <ClipboardDocumentIcon className="h-4 w-4" />
                            </button>
                        </div>
                    </motion.div>
                ) : null}
            </AnimatePresence>
        </motion.div>
    );
}
