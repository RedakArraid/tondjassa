import { apiFetch as fetch } from './lib/api-fetch';
import { MetadataRoute } from 'next';

const API      = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4002';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://mandemarket.soubadigital.com';

// Toutes les locales supportées — utilisées pour les <xhtml:link> dans le sitemap
const LOCALES = [
  'fr', 'en',
  'fr-CI', 'fr-SN', 'fr-ML', 'fr-BF', 'fr-TG', 'fr-BJ', 'fr-GN', 'fr-CM', 'fr-NE', 'fr-MA',
  'en-GH', 'en-NG',
  'fr-FR', 'fr-BE', 'fr-CH', 'fr-LU', 'en-GB', 'en-IE',
];

// Next.js sitemap type ne supporte pas nativement xhtml:link,
// mais on ajoute `alternates` qui sera utilisé par generateMetadata dans les layouts.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL,                          lastModified: now, changeFrequency: 'daily',   priority: 1.0 },
    { url: `${SITE_URL}/boutique`,            lastModified: now, changeFrequency: 'hourly',  priority: 0.9 },
    { url: `${SITE_URL}/devenir-vendeur`,     lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/blog`,                lastModified: now, changeFrequency: 'daily',   priority: 0.7 },
    { url: `${SITE_URL}/contact`,             lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/cgv`,                 lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${SITE_URL}/mentions-legales`,    lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${SITE_URL}/confidentialite`,     lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${SITE_URL}/compte/login`,        lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/compte/register`,     lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
  ];

  try {
    const [productsRes, sellersRes] = await Promise.all([
      fetch(`${API}/api/products?limit=500`, { next: { revalidate: 3600 } }).catch(() => null),
      fetch(`${API}/api/sellers?limit=200`,  { next: { revalidate: 3600 } }).catch(() => null),
    ]);

    const productPages: MetadataRoute.Sitemap = [];
    if (productsRes?.ok) {
      const data = await productsRes.json().catch(() => ({}));
      const products = data.products || data.data || [];
      for (const p of products) {
        productPages.push({
          url:             `${SITE_URL}/boutique/${p.id}`,
          lastModified:    new Date(p.updatedAt || p.createdAt || Date.now()),
          changeFrequency: 'weekly',
          priority:        0.8,
        });
      }
    }

    const sellerPages: MetadataRoute.Sitemap = [];
    if (sellersRes?.ok) {
      const data = await sellersRes.json().catch(() => ({}));
      const sellers = data.sellers || data.data || [];
      for (const s of sellers) {
        if (s.slug) {
          sellerPages.push({
            url:             `${SITE_URL}/vendeur/${s.slug}`,
            lastModified:    new Date(s.updatedAt || s.createdAt || Date.now()),
            changeFrequency: 'weekly',
            priority:        0.6,
          });
        }
      }
    }

    return [...staticPages, ...productPages, ...sellerPages];
  } catch {
    return staticPages;
  }
}
