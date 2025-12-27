import { MetadataRoute } from 'next';
import { getAllPosts } from '@/lib/blog-data';

// Define your pages with their settings
const pageConfig: Record<string, { changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'; priority: number }> = {
  '': { changeFrequency: 'daily', priority: 1.0 },
  '/landing': { changeFrequency: 'weekly', priority: 0.9 },
  '/pools': { changeFrequency: 'hourly', priority: 1.0 },
  '/locks': { changeFrequency: 'daily', priority: 0.9 },
  '/swap': { changeFrequency: 'daily', priority: 0.8 },
  '/tools': { changeFrequency: 'weekly', priority: 0.9 },
  '/whale-club': { changeFrequency: 'weekly', priority: 0.7 },
  '/roadmap': { changeFrequency: 'monthly', priority: 0.7 },
  '/whitepaper': { changeFrequency: 'monthly', priority: 0.8 },
  '/docs': { changeFrequency: 'weekly', priority: 0.7 },
  '/support': { changeFrequency: 'monthly', priority: 0.6 },
  '/dashboard': { changeFrequency: 'daily', priority: 0.7 },
  '/blog': { changeFrequency: 'weekly', priority: 0.8 },
  '/refer': { changeFrequency: 'weekly', priority: 0.7 },
};

// Default settings for pages not in config
const defaultConfig = { changeFrequency: 'weekly' as const, priority: 0.7 };

// Pages to exclude from sitemap
const excludePaths = ['/api', '/admin', '/pool/'];

// Tool subpages - add new tools here and they auto-appear
const toolPages = [
  'wallet-cleanup',
  'wallet-analyzer', 
  'airdrop',
  'snapshot',
  'token-safety',
  'sniper-bot',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://stakepoint.app';
  const currentDate = new Date();

  // Main pages
  const mainPages: MetadataRoute.Sitemap = Object.entries(pageConfig).map(([path, config]) => ({
    url: `${baseUrl}${path}`,
    lastModified: currentDate,
    changeFrequency: config.changeFrequency,
    priority: config.priority,
  }));

  // Tool subpages
  const toolSubpages: MetadataRoute.Sitemap = toolPages.map((tool) => ({
    url: `${baseUrl}/tools/${tool}`,
    lastModified: currentDate,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  // Blog posts - fully dynamic from blog-data.ts
  const blogPosts: MetadataRoute.Sitemap = getAllPosts().map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  return [...mainPages, ...toolSubpages, ...blogPosts];
}