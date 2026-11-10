import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://flintel.app';

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/pricing', '/privacy', '/terms'],
        disallow: ['/api/', '/dashboard/', '/prospects/', '/brain/', '/settings/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
