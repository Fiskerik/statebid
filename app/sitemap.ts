import type { MetadataRoute } from 'next';
import { US_STATES } from '@/lib/states';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://statebid.lol';
  return [
    { url: base, changeFrequency: 'hourly', priority: 1 },
    ...US_STATES.map((state) => ({ url: `${base}/state/${state.code.toLowerCase()}`, changeFrequency: 'hourly' as const, priority: 0.8 })),
    ...['about', 'rules', 'terms', 'privacy'].map((page) => ({ url: `${base}/${page}`, changeFrequency: 'monthly' as const, priority: 0.4 })),
  ];
}
