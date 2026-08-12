'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import { DocumentTextIcon, StarIcon } from '@heroicons/react/24/outline';
import { Github } from 'lucide-react';
import { CardItem } from '@/types/page';
import { cn } from '@/lib/utils';
import { useMessages } from '@/lib/i18n/useMessages';

const markdownComponents = {
    p: ({ children }: React.ComponentProps<'p'>) => <p className="mb-3 last:mb-0">{children}</p>,
    ul: ({ children }: React.ComponentProps<'ul'>) => <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>,
    ol: ({ children }: React.ComponentProps<'ol'>) => <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>,
    li: ({ children }: React.ComponentProps<'li'>) => <li className="mb-1">{children}</li>,
    a: ({ ...props }) => (
        <a {...props} target="_blank" rel="noopener noreferrer" className="text-accent font-medium hover:underline" />
    ),
    strong: ({ children }: React.ComponentProps<'strong'>) => <strong className="font-semibold text-primary">{children}</strong>,
    code: ({ children }: React.ComponentProps<'code'>) => (
        <code className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-[0.95em]">{children}</code>
    ),
};

interface ProjectCardProps {
    project: CardItem;
    embedded?: boolean;
    index?: number;
}

export default function ProjectCard({ project, embedded = false, index = 0 }: ProjectCardProps) {
    const messages = useMessages();
    const [expandedDetails, setExpandedDetails] = useState(false);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 * index }}
            className="bg-white dark:bg-neutral-900 p-5 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-800 hover:shadow-md transition-all duration-200"
        >
            {/* Row 1 — logo sits inline with the title. These are app icons, not figures:
                giving them a full 4:3 figure slot left square logos floating in a box that
                was mostly empty space, which is what made the card read as sparse. */}
            <div className="flex items-center gap-4 mb-3">
                {project.image && (
                    <div className="w-16 h-16 flex-shrink-0 relative">
                        <Image
                            src={project.image}
                            alt={project.title}
                            fill
                            className="object-contain"
                            sizes="64px"
                        />
                    </div>
                )}
                <div className="flex-1 min-w-0 flex items-baseline justify-between gap-3">
                    <h3 className={`${embedded ? "text-lg" : "text-xl"} font-semibold text-primary leading-tight truncate`}>
                        {project.link ? (
                            <a href={project.link} target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors">
                                {project.title}
                            </a>
                        ) : project.title}
                    </h3>
                    {project.date && (
                        <span className="text-sm text-neutral-500 font-medium whitespace-nowrap">
                            {project.date}
                        </span>
                    )}
                </div>
            </div>

            {project.subtitle && (
                <p className={`${embedded ? "text-sm" : "text-base"} text-accent font-medium mb-2`}>
                    {project.subtitle}
                </p>
            )}

            {/* Row 2 — description spans the full card width. */}
            {project.content && (
                <div className="text-sm text-neutral-600 dark:text-neutral-500 mb-4 leading-relaxed">
                    <ReactMarkdown components={markdownComponents}>{project.content}</ReactMarkdown>
                </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
                {project.link && (
                    <a
                        href={project.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-3 py-1 rounded-md text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-accent hover:text-white transition-colors"
                    >
                        <Github className="h-3 w-3 mr-1.5" />
                        {messages.projects.repository}
                    </a>
                )}
                {/* Hand-written in entry.toml — a static export cannot fetch this live. */}
                {typeof project.stars === 'number' && (
                    <span
                        className="inline-flex items-center px-3 py-1 rounded-md text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
                        title={messages.projects.stars}
                    >
                        <StarIcon className="h-3 w-3 mr-1.5" />
                        {project.stars.toLocaleString()}
                    </span>
                )}
                {project.details && (
                    <button
                        onClick={() => setExpandedDetails(!expandedDetails)}
                        className={cn(
                            "inline-flex items-center px-3 py-1 rounded-md text-xs font-medium transition-colors",
                            expandedDetails
                                ? "bg-accent text-white"
                                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-accent hover:text-white"
                        )}
                    >
                        <DocumentTextIcon className="h-3 w-3 mr-1.5" />
                        {messages.projects.details}
                    </button>
                )}
                {project.tags?.map((tag) => (
                    <span key={tag} className="text-xs text-neutral-500 bg-neutral-50 dark:bg-neutral-800/50 px-2 py-1 rounded border border-neutral-100 dark:border-neutral-800">
                        {tag}
                    </span>
                ))}
            </div>

            {/* The long description expands across the full card, like a paper's abstract. */}
            <AnimatePresence>
                {expandedDetails && project.details ? (
                    <motion.div
                        key="details"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden mt-4"
                    >
                        <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700 text-sm text-neutral-600 dark:text-neutral-500 leading-relaxed">
                            <ReactMarkdown components={markdownComponents}>{project.details}</ReactMarkdown>
                        </div>
                    </motion.div>
                ) : null}
            </AnimatePresence>
        </motion.div>
    );
}
