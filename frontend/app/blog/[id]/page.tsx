import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import PublicHeader from '../../components/PublicHeader';
import PublicFooter from '../../components/PublicFooter';
import { blogPosts, getBlogPost } from '../posts';

export function generateStaticParams() {
  return blogPosts.map((post) => ({ id: String(post.id) }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const post = getBlogPost((await params).id);
  if (!post) return { title: 'Article introuvable | MandeMarket' };
  return {
    title: `${post.title} | MandeMarket`,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      images: [{ url: post.image }],
      type: 'article',
    },
  };
}

export default async function BlogPostPage(
  { params }: { params: Promise<{ id: string }> }
) {
  const post = getBlogPost((await params).id);
  if (!post) notFound();

  return (
    <div className="min-h-screen bg-brand-cream">
      <PublicHeader />
      <main>
        <article className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:py-16">
          <Link href="/blog" className="text-sm font-semibold text-brand-orange hover:underline">
            ← Retour au blog
          </Link>
          <p className="mt-8 text-sm font-bold uppercase tracking-wider text-brand-orange">{post.category}</p>
          <h1 className="mt-3 text-4xl font-extrabold leading-tight text-brand-navy md:text-5xl">{post.title}</h1>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
            <span>{post.author}</span>
            <span>{post.date}</span>
            <span>{post.readTime} de lecture</span>
          </div>
          <div className="mt-8 aspect-[16/9] overflow-hidden rounded-3xl bg-gray-100 shadow-card">
            <img src={post.image} alt={post.title} className="h-full w-full object-cover" />
          </div>
          <p className="mt-8 text-xl font-medium leading-8 text-gray-700">{post.excerpt}</p>
          <div className="mt-8 space-y-6 text-lg leading-8 text-gray-700">
            {post.content.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </div>
          <div className="mt-12 flex flex-wrap gap-3 border-t border-gray-200 pt-8">
            <Link href="/boutique" className="rounded-xl bg-brand-orange px-5 py-3 font-bold text-white hover:bg-brand-orange-dark">
              Découvrir les produits
            </Link>
            <Link href="/blog" className="rounded-xl border border-gray-300 px-5 py-3 font-bold text-brand-navy hover:bg-white">
              Voir les autres articles
            </Link>
          </div>
        </article>
      </main>
      <PublicFooter />
    </div>
  );
}
