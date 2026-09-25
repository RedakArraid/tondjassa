import { Metadata } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://mandemarket.soubadigital.com';

type Props = { params: Promise<{ id: string }> };

// Génère des hreflang dynamiques par produit
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const url = `${SITE_URL}/boutique/${(await params).id}`;

  const languages: Record<string, string> = {
    'fr': url, 'en': url,
    'fr-CI': url, 'fr-SN': url, 'fr-ML': url, 'fr-BF': url,
    'fr-TG': url, 'fr-BJ': url, 'fr-GN': url, 'fr-CM': url,
    'fr-NE': url, 'fr-MA': url,
    'en-GH': url, 'en-NG': url,
    'fr-FR': url, 'fr-BE': url, 'fr-CH': url, 'fr-LU': url,
    'en-GB': url, 'en-IE': url,
    'x-default': url,
  };

  return {
    title: {
      default: 'Produit | MandeMarket',
      template: '%s | MandeMarket',
    },
    alternates: {
      canonical: url,
      languages,
    },
    openGraph: {
      url,
      locale:          'fr_CI',
      alternateLocale: ['fr_FR', 'fr_SN', 'en_GH', 'en_GB'],
      siteName:        'MandeMarket',
      type:            'website',
    },
    twitter: { card: 'summary_large_image' },
  };
}

export default function ProductLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
