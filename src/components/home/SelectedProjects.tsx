'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { CardItem } from '@/types/page';
import { useMessages } from '@/lib/i18n/useMessages';
import ProjectCard from '@/components/projects/ProjectCard';

interface SelectedProjectsProps {
    projects: CardItem[];
    title?: string;
    enableOnePageMode?: boolean;
}

export default function SelectedProjects({ projects, title, enableOnePageMode = false }: SelectedProjectsProps) {
    const messages = useMessages();
    const resolvedTitle = title || messages.home.selectedProjects;

    return (
        <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
        >
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-serif font-bold text-primary">{resolvedTitle}</h2>
                <Link
                    href={enableOnePageMode ? "/#projects" : "/projects"}
                    prefetch={true}
                    className="text-accent hover:text-accent-dark text-sm font-medium transition-all duration-200 rounded hover:bg-accent/10 hover:shadow-sm"
                >
                    {messages.home.viewAll} →
                </Link>
            </div>
            <div className="space-y-6">
                {projects.map((project, index) => (
                    <ProjectCard key={project.id} project={project} embedded={true} index={index} />
                ))}
            </div>
        </motion.section>
    );
}
