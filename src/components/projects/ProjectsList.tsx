'use client';

import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { ProjectPageConfig } from '@/types/page';
import { useMessages } from '@/lib/i18n/useMessages';
import ProjectCard from './ProjectCard';

export default function ProjectsList({ config, embedded = false }: { config: ProjectPageConfig; embedded?: boolean }) {
    const messages = useMessages();

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
        >
            <div className={embedded ? "mb-4" : "mb-8"}>
                <h1 className={`${embedded ? "text-2xl" : "text-4xl"} font-serif font-bold text-primary mb-4`}>{config.title}</h1>
                {config.description && (
                    <div className={`${embedded ? "text-base" : "text-lg"} text-neutral-600 dark:text-neutral-500 max-w-2xl leading-relaxed`}>
                        <ReactMarkdown>{config.description}</ReactMarkdown>
                    </div>
                )}
            </div>

            {config.items.length === 0 ? (
                <p className="text-neutral-600 dark:text-neutral-500">{messages.projects.noResults}</p>
            ) : (
                <div className="space-y-6">
                    {config.items.map((project, index) => (
                        <ProjectCard key={project.id} project={project} embedded={embedded} index={index} />
                    ))}
                </div>
            )}
        </motion.div>
    );
}
