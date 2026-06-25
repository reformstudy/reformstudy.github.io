import { BookOpen, Library, Clock, ChevronRight } from 'lucide-react';

const cards = [
  {
    type: 'exe',
    title: 'Genesis 15:6',
    label: 'Scripture Reference',
    theme: '--accent-exe',
    bg: '--bg-exe-light',
    icon: <BookOpen size={14} />,
    desc: '"And he believed the LORD, and he counted it to him as righteousness." (Context: God establishes his covenant...)'
  },
  {
    type: 'theo',
    title: 'Westminster Confession, 7.5',
    label: 'Confessional Doctrine',
    theme: '--accent-theo',
    bg: '--bg-theo-light',
    icon: <Library size={14} />,
    desc: '"This covenant was differently administered in the time of the law, and in the time of the gospel..."'
  },
  {
    type: 'time',
    title: 'The Abrahamic Covenant',
    label: 'Timeline Event',
    theme: '--accent-time',
    bg: '--bg-time-light',
    icon: <Clock size={14} />,
    desc: 'God formally enters into an unconditional covenant with Abram, promising him a land, a nation...'
  }
];

export default function GlobalSearch() {
  return (
    <div className="workspace">
      <aside className="left-sidebar" style={{ padding: 32, width: 280 }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 20 }}>
          Filter by Domain
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {['All Results', 'Scripture & Exegesis', 'Theology & Confessions', 'Geography'].map((filter, index) => (
            <button
              key={filter}
              type="button"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderRadius: 8,
                cursor: 'pointer',
                backgroundColor: index === 0 ? 'white' : 'transparent',
                boxShadow: index === 0 ? 'var(--shadow-card)' : 'none',
                fontWeight: index === 0 ? 700 : 600,
                color: index === 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
                border: 'none'
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 16, height: 16, borderRadius: 4, backgroundColor: index === 0 ? 'var(--text-primary)' : 'var(--border-soft)' }} />
                {filter}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{Math.floor(Math.random() * 100) + 10}</span>
            </button>
          ))}
        </div>
      </aside>

      <div className="center-content" style={{ display: 'block', padding: 40 }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.2rem', marginBottom: 10 }}>
            Exploring <span style={{ color: 'var(--accent-exe)', fontStyle: 'italic' }}>&quot;Abraham&quot;</span>
          </h1>
          <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            Showing top results across all domains
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
          {cards.map((card) => (
            <div key={card.title} style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-card)', cursor: 'pointer', display: 'flex', flexDirection: 'column' }}>
              <div style={{ height: 4, width: '100%', backgroundColor: `var(${card.theme})` }} />
              <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid var(--border-soft)', color: `var(${card.theme})`, backgroundColor: `var(${card.bg})` }}>
                {card.icon} {card.label}
              </div>
              <div style={{ padding: 20, flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem', marginBottom: 12, color: 'var(--text-primary)' }}>{card.title}</div>
                <div style={{ fontSize: '0.95rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>{card.desc}</div>
              </div>
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-soft)', backgroundColor: '#FAFAFA', fontSize: '0.85rem', fontWeight: 700, display: 'flex', justifyContent: 'space-between', color: `var(${card.theme})` }}>
                Open Result <ChevronRight size={16} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
