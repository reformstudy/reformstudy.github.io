import { BookOpen, ScrollText, MapPin, Scale, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

export type ReferenceCardVariant = 'scripture' | 'confession' | 'geography' | 'doctrine';

export interface ReferenceCardProps {
  variant: ReferenceCardVariant;
  title: string;
  subtitle?: string;
  excerpt: string;
  to?: string;
  compact?: boolean;
}

const VARIANT_CONFIG: Record<ReferenceCardVariant, {
  icon: React.ReactNode;
  label: string;
  accent: string;
  bg: string;
  border: string;
  linkText: string;
}> = {
  scripture: {
    icon: <BookOpen size={11} />,
    label: 'Scripture',
    accent: 'var(--accent-exe)',
    bg: 'var(--bg-exe-light)',
    border: 'var(--accent-exe)',
    linkText: 'Read passage',
  },
  confession: {
    icon: <ScrollText size={11} />,
    label: 'Confession',
    accent: 'var(--accent-geo)',
    bg: 'var(--bg-geo-light)',
    border: 'var(--accent-geo)',
    linkText: 'Read chapter',
  },
  geography: {
    icon: <MapPin size={11} />,
    label: 'Geography',
    accent: 'var(--accent-gold)',
    bg: 'var(--accent-gold-light)',
    border: 'var(--accent-gold)',
    linkText: 'View on map',
  },
  doctrine: {
    icon: <Scale size={11} />,
    label: 'Doctrine',
    accent: 'var(--accent-theo)',
    bg: 'var(--bg-theo-light)',
    border: 'var(--accent-theo)',
    linkText: 'Explore doctrine',
  },
};

export function ReferenceCard({ variant, title, subtitle, excerpt, to, compact }: ReferenceCardProps) {
  const cfg = VARIANT_CONFIG[variant];
  const maxExcerptLength = compact ? 100 : 220;
  const truncatedExcerpt = excerpt.length > maxExcerptLength
    ? excerpt.slice(0, maxExcerptLength).replace(/\s+\S*$/, '') + '…'
    : excerpt;

  return (
    <div
      style={{
        borderRadius: 'var(--radius-md)',
        background: cfg.bg,
        borderLeft: `3px solid ${cfg.border}`,
        padding: compact ? '12px 14px' : '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? 6 : 10,
        transition: 'box-shadow 0.15s ease',
      }}
      className="reference-card"
    >
      {/* Badge row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: '0.68rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            color: cfg.accent,
          }}
        >
          {cfg.icon}
          {cfg.label}
        </div>
        {subtitle && (
          <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>
            {subtitle}
          </span>
        )}
      </div>

      {/* Title */}
      <div
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: compact ? '0.88rem' : '0.95rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          lineHeight: 1.3,
        }}
      >
        {title}
      </div>

      {/* Excerpt */}
      <div
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: compact ? '0.82rem' : '0.88rem',
          lineHeight: 1.6,
          color: 'var(--text-secondary)',
          fontStyle: 'italic',
        }}
      >
        "{truncatedExcerpt}"
      </div>

      {/* Link */}
      {to && (
        <div style={{ marginTop: 2 }}>
          <Link
            to={to}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: '0.78rem',
              fontWeight: 700,
              color: cfg.accent,
              textDecoration: 'none',
              borderBottom: `1px solid transparent`,
              transition: 'border-color 0.12s ease',
            }}
            className="reference-card__link"
          >
            {cfg.linkText}
            <ExternalLink size={11} />
          </Link>
        </div>
      )}
    </div>
  );
}
