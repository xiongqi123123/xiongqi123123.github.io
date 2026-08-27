'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import Profile from '@/components/home/Profile';
import About from '@/components/home/About';
import SelectedPublications from '@/components/home/SelectedPublications';
import News, { NewsItem } from '@/components/home/News';
import PublicationsList from '@/components/publications/PublicationsList';
import TextPage from '@/components/pages/TextPage';
import CardPage from '@/components/pages/CardPage';
import SelectedProjects from '@/components/home/SelectedProjects';
import ProjectsList from '@/components/projects/ProjectsList';
import type { SiteConfig } from '@/lib/config';
import { Publication } from '@/types/publication';
import { CardItem, CardPageConfig, ProjectPageConfig, PublicationPageConfig, TextPageConfig } from '@/types/page';
import { useLocaleStore } from '@/lib/stores/localeStore';
import { cn } from '@/lib/utils';

interface SectionConfig {
  id: string;
  type: 'markdown' | 'publications' | 'list' | 'projects';
  title?: string;
  source?: string;
  filter?: string;
  limit?: number;
  content?: string;
  publications?: Publication[];
  items?: NewsItem[];
  projects?: CardItem[];
}

type PageData =
  | { type: 'about'; id: string; sections: SectionConfig[] }
  | { type: 'publication'; id: string; config: PublicationPageConfig; publications: Publication[] }
  | { type: 'text'; id: string; config: TextPageConfig; content: string }
  | { type: 'card'; id: string; config: CardPageConfig }
  | { type: 'project'; id: string; config: ProjectPageConfig };

export interface HomePageLocaleData {
  author: SiteConfig['author'];
  social: SiteConfig['social'];
  features: SiteConfig['features'];
  enableOnePageMode?: boolean;
  researchInterests?: string[];
  pagesToShow: PageData[];
}

interface HomePageClientProps {
  dataByLocale: Record<string, HomePageLocaleData>;
  defaultLocale: string;
}

// lg:top-8 在上方留了 2rem, 下方也留同样的量, 侧栏整体塞得进视口才允许 sticky。
const STICKY_GUTTER_PX = 64;

/**
 * 侧栏是否能整个塞进视口。塞不下就不 sticky, 让它随页面滚动, 底部永远够得着。
 *
 * 之前的做法是 max-h + overflow-y-auto 让侧栏内部滚动, 但这是个坑: overflow 只要有一轴
 * 不是 visible, 另一轴会被强制成 auto, 整个格子就成了裁剪容器; 它又是 sticky (定位元素),
 * Profile 里联系方式的 tooltip (absolute, 邮箱那个会向左溢出格子) 逃不出去, 左半边被切掉。
 * 所以格子上不能有任何 overflow, 改成量高度决定要不要 sticky。
 */
function useFitsViewport(ref: RefObject<HTMLDivElement | null>): boolean {
  const [fits, setFits] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const check = () => setFits(el.offsetHeight + STICKY_GUTTER_PX <= window.innerHeight);
    check();

    const observer = new ResizeObserver(check);
    observer.observe(el);
    window.addEventListener('resize', check);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', check);
    };
  }, [ref]);

  return fits;
}

export default function HomePageClient({ dataByLocale, defaultLocale }: HomePageClientProps) {
  const locale = useLocaleStore((state) => state.locale);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const sidebarFits = useFitsViewport(sidebarRef);
  const fallback = dataByLocale[defaultLocale] || Object.values(dataByLocale)[0];
  const data = dataByLocale[locale] || fallback;

  if (!data) {
    return null;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 bg-background min-h-screen">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* sticky 必须落在 grid 单元格上, 且要 self-start —— 否则 align-items:stretch 会把
            单元格拉成整行高度, 元素没有可移动的余量, sticky 看上去就"不生效"。
            ★ 这个格子上不要加 overflow-*: 会把联系方式的 tooltip 裁掉, 见 useFitsViewport。 */}
        <div
          ref={sidebarRef}
          className={cn('lg:col-span-1 lg:self-start', sidebarFits && 'lg:sticky lg:top-8')}
        >
          <Profile
            author={data.author}
            social={data.social}
            features={data.features}
            researchInterests={data.researchInterests}
          />
        </div>

        <div className="lg:col-span-2 space-y-8">
          {data.pagesToShow.map((page) => (
            <section key={page.id} id={page.id} className="scroll-mt-24 space-y-8">
              {page.type === 'about' && page.sections.map((section: SectionConfig) => {
                switch (section.type) {
                  case 'markdown':
                    return (
                      <About
                        key={section.id}
                        content={section.content || ''}
                        title={section.title}
                      />
                    );
                  case 'publications':
                    return (
                      <SelectedPublications
                        key={section.id}
                        publications={section.publications || []}
                        title={section.title}
                        enableOnePageMode={data.enableOnePageMode}
                      />
                    );
                  case 'list':
                    return (
                      <News
                        key={section.id}
                        items={section.items || []}
                        title={section.title}
                      />
                    );
                  case 'projects':
                    return (
                      <SelectedProjects
                        key={section.id}
                        projects={section.projects || []}
                        title={section.title}
                        enableOnePageMode={data.enableOnePageMode}
                      />
                    );
                  default:
                    return null;
                }
              })}
              {page.type === 'publication' && (
                <PublicationsList
                  config={page.config}
                  publications={page.publications}
                  embedded={true}
                />
              )}
              {page.type === 'text' && (
                <TextPage
                  config={page.config}
                  content={page.content}
                  embedded={true}
                />
              )}
              {page.type === 'card' && (
                <CardPage
                  config={page.config}
                  embedded={true}
                />
              )}
              {page.type === 'project' && (
                <ProjectsList
                  config={page.config}
                  embedded={true}
                />
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
