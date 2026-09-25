import { apiFetch as fetch } from '../../lib/api-fetch';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProductClient from './ProductClient';

const API      = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4002';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://mandemarket.soubadigital.com';

async function getProduct(id: string) {
  try {
    const res = await fetch(`${API}/api/products/${id}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.product ?? data ?? null;
  } catch {
    return null;
  }
}

async function getSimilarProducts(categoryId: string, excludeId: string) {
  try {
    const res = await fetch(
      `${API}/api/products?categoryId=${categoryId}&limit=5&status=active`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const products = data.products ?? [];
    return products.filter((p: any) => String(p.id) !== excludeId).slice(0, 4);
  } catch {
    return [];
  }
}

// ── Metadata dynamique — Google voit le vrai titre + description + image ──
export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const product = await getProduct((await params).id);
  if (!product) return { title: 'Produit introuvable | MandeMarket' };

  const title       = product.name;
  const description = product.description?.slice(0, 160) ?? '';
  const url         = `${SITE_URL}/boutique/${(await params).id}`;
  const image       = product.image;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName:        'MandeMarket',
      locale:          'fr_CI',
      alternateLocale: ['fr_FR', 'fr_SN', 'en_GH'],
      type:            'website',
      ...(image && { images: [{ url: image, alt: title, width: 800, height: 800 }] }),
    },
    twitter: {
      card:        'summary_large_image',
      title,
      description,
      ...(image && { images: [image] }),
    },
  };
}

// ── Page (server component) ──
export default async function ProductDetailPage(
  { params }: { params: Promise<{ id: string }> }
) {
  const product = await getProduct((await params).id);

  if (!product) notFound();

  const similar = await getSimilarProducts(
    product.categoryId,
    String(product.id)
  );

  return <ProductClient initialProduct={product} similarProducts={similar} />;
}
