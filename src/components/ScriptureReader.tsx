import { BookOpen } from 'lucide-react';

export default function ScriptureReader() {
  return (
    <div className="workspace">
      <aside className="left-sidebar">
        <div style={{ padding: '20px 20px 10px', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
          Pauline Epistles
        </div>
        {['Romans', '1 Corinthians', '2 Corinthians', 'Galatians'].map((book) => (
          <button key={book} type="button" style={{ padding: '10px 20px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', background: 'transparent', border: 'none', textAlign: 'left' }}>
            {book}
          </button>
        ))}
        <div style={{ padding: '10px 20px', fontWeight: 600, backgroundColor: 'white', color: 'var(--accent-geo)', borderLeft: '3px solid var(--accent-geo)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Ephesians</span> <BookOpen size={16} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, padding: '12px 20px 20px', backgroundColor: 'white', borderBottom: '1px solid var(--border-soft)' }}>
          {[1, 2, 3, 4, 5, 6].map((chapter) => (
            <button key={chapter} type="button" style={{ aspectRatio: '1', borderRadius: 8, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', backgroundColor: chapter === 1 ? 'var(--accent-geo)' : 'transparent', color: chapter === 1 ? 'white' : 'var(--text-secondary)', border: 'none' }}>
              {chapter}
            </button>
          ))}
        </div>
      </aside>

      <div className="center-content">
        <div style={{ maxWidth: 680, width: '100%', paddingBottom: 80 }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.5rem', marginBottom: 8 }}>Ephesians 1</h1>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, backgroundColor: 'var(--bg-geo-light)', color: 'var(--accent-geo)', padding: '4px 12px', borderRadius: 16 }}>
              English Standard Version (ESV)
            </span>
          </div>

          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', lineHeight: 2, color: '#38332E' }}>
            <p style={{ fontWeight: 700, fontFamily: 'var(--font-sans)', fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: 0.5, margin: '24px 0 12px' }}>
              Greeting
            </p>
            <div className="verse">
              <span className="v-num">1</span>
              Paul, an apostle of Christ Jesus by the will of God, To the saints who are in <span className="token geo">Ephesus</span>, and are faithful in Christ Jesus:
            </div>
            <div className="verse">
              <span className="v-num">2</span>
              Grace to you and peace from God our Father and the Lord Jesus Christ.
            </div>

            <p style={{ fontWeight: 700, fontFamily: 'var(--font-sans)', fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: 0.5, margin: '24px 0 12px' }}>
              Spiritual Blessings in Christ
            </p>
            <div className="verse">
              <span className="v-num">3</span>
              Blessed be the God and Father of our Lord Jesus Christ, who has blessed us in Christ with every spiritual blessing in the heavenly places,
            </div>
            <div className="verse active-context">
              <span className="v-num">4</span>
              even as he chose us in him before the foundation of the world, that we should be holy and blameless before him. In love
            </div>
            <div className="verse active-context">
              <span className="v-num">5</span>
              he <span className="token exe active">predestined</span> us for adoption to himself as sons through Jesus Christ, according to the purpose of his will,
            </div>
          </div>
        </div>
      </div>

      <aside className="right-sidebar">
        <div style={{ padding: '24px', backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-soft)' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOpen size={18} /> Passage Insights
          </h2>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            Context automatically populating for verses 1:4-5
          </div>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto' }}>
          <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-soft)', boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border-soft)', backgroundColor: 'var(--bg-exe-light)', color: '#B07B46' }}>
              Greek Exegesis
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ display: 'inline-block', fontSize: '0.75rem', fontWeight: 700, backgroundColor: 'var(--bg-sidebar)', padding: '2px 8px', borderRadius: 12, color: 'var(--text-tertiary)', marginBottom: 12 }}>
                Strong's G4309
              </div>
              <div style={{ fontFamily: 'var(--font-greek)', fontSize: '1.8rem', marginBottom: 4 }}>προορίσας</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontStyle: 'italic', color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: 12 }}>proorisas</div>
              <ul style={{ paddingLeft: 20, fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                <li><strong>Root:</strong> From <em>pro</em> (before) and <em>horizō</em> (to establish boundaries).</li>
                <li><strong>Definition:</strong> To predetermine, foreordain.</li>
              </ul>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
