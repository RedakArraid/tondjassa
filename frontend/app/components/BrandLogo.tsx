import Image from 'next/image';
import Link from 'next/link';

type BrandLogoProps = {
  href?: string;
  className?: string;
  variant?: 'light' | 'dark' | 'orange';
  size?: 'sm' | 'md' | 'lg';
};

const sizeClass = {
  sm: 'h-8',
  md: 'h-10',
  lg: 'h-12',
};

export default function BrandLogo({
  href = '/',
  className = '',
  variant = 'light',
  size = 'md',
}: BrandLogoProps) {
  const logo = (
    <Image
      src="/images/brand/logo-tondjassa.png"
      alt="Tondjassa"
      width={420}
      height={86}
      priority
      className={`w-auto ${sizeClass[size]} ${className}`}
    />
  );
  const content = variant === 'dark'
    ? <span className="inline-flex rounded-xl bg-white px-2 py-1 shadow-sm">{logo}</span>
    : logo;

  if (!href) return content;
  return (
    <Link
      href={href}
      className="inline-flex items-center hover:opacity-90 transition-opacity"
      aria-label="Tondjassa"
    >
      {content}
    </Link>
  );
}
