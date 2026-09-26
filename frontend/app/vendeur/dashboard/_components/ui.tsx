'use client';

import Link from 'next/link';
import { useSellerAccess } from './access';

export function SellerActionButton({
  children,
  href,
  onClick,
  variant = 'primary',
  type = 'button',
  disabled,
  size = 'md',
  permission,
}: {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  type?: 'button' | 'submit';
  disabled?: boolean;
  size?: 'sm' | 'md';
  permission?: string;
}) {
  const { can } = useSellerAccess();
  const inferredPermission = href?.includes('/produits/ajouter') ? 'catalog.write' : undefined;
  if ((permission || inferredPermission) && !can(permission || inferredPermission!)) return null;
  const styles = {
    primary: 'bg-brand-orange text-white hover:bg-brand-orange-dark border border-transparent',
    secondary: 'bg-white text-brand-navy border border-gray-200 hover:bg-gray-50',
    danger: 'bg-red-600 text-white hover:bg-red-700 border border-transparent',
    ghost: 'bg-brand-soft text-brand-orange hover:bg-brand-cream border border-transparent',
    outline: 'bg-transparent text-brand-navy border border-brand-navy/20 hover:bg-brand-soft',
  }[variant];

  const sizing = size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-4 py-2.5 text-sm';
  const className = `inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition disabled:opacity-60 ${styles} ${sizing}`;

  if (href) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  );
}

export function SellerHeaderActions({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

export function SellerPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
      <div>
        <h2 className="text-2xl font-bold text-brand-navy">{title}</h2>
        {description && <p className="text-sm text-gray-500 mt-1 max-w-2xl">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function SellerCard({
  title,
  children,
  className = '',
  action,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={`bg-white rounded-xl border border-gray-100 shadow-sm ${className}`}>
      {(title || action) && (
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
          {title ? <h3 className="font-semibold text-brand-navy">{title}</h3> : <span />}
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

export function SellerEmptyState({
  title,
  description,
  message,
  actionLabel,
  actionHref,
  onAction,
  actionPermission,
}: {
  title?: string;
  description?: string;
  message?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  actionPermission?: string;
}) {
  const { can } = useSellerAccess();
  const displayTitle = title || message || 'Aucun élément trouvé';
  const displayDesc = description || (title && message ? message : '');
  const inferredPermission = actionHref?.includes('/produits/ajouter') ? 'catalog.write' : undefined;
  const canShowAction = !(actionPermission || inferredPermission) || can(actionPermission || inferredPermission!);
  return (
    <div className="text-center py-14 px-4">
      <p className="text-lg font-semibold text-brand-navy">{displayTitle}</p>
      {displayDesc && <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">{displayDesc}</p>}
      {canShowAction && actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="inline-flex mt-5 px-4 py-2.5 rounded-lg bg-brand-orange text-white text-sm font-semibold hover:bg-brand-orange-dark transition"
        >
          {actionLabel}
        </Link>
      )}
      {canShowAction && actionLabel && onAction && !actionHref && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex mt-5 px-4 py-2.5 rounded-lg bg-brand-orange text-white text-sm font-semibold hover:bg-brand-orange-dark transition"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function SellerStatGrid({
  items,
}: {
  items: { label: string; value: string; hint?: string }[];
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
      {items.map((item) => (
        <div key={item.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{item.label}</p>
          <p className="text-xl font-bold text-brand-navy mt-1">{item.value}</p>
          {item.hint && <p className="text-xs text-gray-400 mt-1">{item.hint}</p>}
        </div>
      ))}
    </div>
  );
}

export function FilterChips({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          aria-pressed={value === opt}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
            value === opt
              ? 'bg-brand-orange text-white border-brand-orange'
              : 'bg-white text-gray-600 border-gray-200 hover:border-brand-orange'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export function PeriodSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const options = ['Aujourd’hui', '7 jours', '30 jours', '3 mois', 'Cette année', 'Toutes périodes'];
  return <FilterChips options={options} value={value} onChange={onChange} />;
}

export function RowActions({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-1.5">{children}</div>;
}
