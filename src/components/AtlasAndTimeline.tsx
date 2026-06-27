import { useState } from 'react';
import { Map as MapIcon, BookOpen, Clock, ChevronRight } from 'lucide-react';

interface EraEvent {
  id: string;
  date: string;
  title: string;
  loc: string;
  coords: { x: number; y: number };
  desc: string;
  scripture: string;
  theme: string;
}

interface EraData {
  title: string;
  timeframe: string;
  events: EraEvent[];
}

const eras = [
  { id: 'creation', label: 'Creation & Fall' },
  { id: 'preflood', label: 'Pre-Flood Age' },
  { id: 'patriarchal', label: 'Patriarchal Age' },
  { id: 'mosaic', label: 'Exodus & Conquest' },
  { id: 'kingdom', label: 'The Kingdom Era' },
  { id: 'exile', label: 'Exile & Return' },
  { id: 'church', label: 'Apostolic & Church Age' }
] as const;

type EraKey = typeof eras[number]['id'];

const eraEvents: Record<EraKey, EraData> = {
  creation: {
    title: 'Creation & Fall',
    timeframe: 'Genesis 1 – 3',
    events: []
  },
  preflood: {
    title: 'Pre-Flood Age',
    timeframe: 'Genesis 4 – 6',
    events: []
  },
  patriarchal: {
    title: 'Patriarchal Age',
    timeframe: 'c. 2100 – 1800 BC',
    events: [
      { id: 'ur', date: 'c. 2090 BC', title: 'The Call of Abram', loc: 'Ur of the Chaldeans', coords: { x: 900, y: 480 }, desc: 'God calls Abram out of Ur, establishing the unconditional covenant of grace promising a land, a seed, and a blessing to all nations.', scripture: 'Genesis 12:1-3', theme: 'Covenant of Grace' },
      { id: 'canaan', date: 'c. 2075 BC', title: 'Arrival in Canaan', loc: 'Shechem', coords: { x: 750, y: 450 }, desc: 'Abram builds an altar at the oak of Moreh. God promises this land to his offspring.', scripture: 'Genesis 12:6-7', theme: 'Promised Land' },
      { id: 'moriah', date: 'c. 2050 BC', title: 'Binding of Isaac', loc: 'Mount Moriah', coords: { x: 740, y: 470 }, desc: 'Abraham’s faith is tested. A ram is provided as a substitute, foreshadowing the substitutionary atonement of Christ.', scripture: 'Genesis 22:1-14', theme: 'Substitutionary Atonement' },
      { id: 'egypt', date: 'c. 1876 BC', title: 'Descent into Egypt', loc: 'Goshen', coords: { x: 650, y: 550 }, desc: 'Jacob and his family move to Egypt to survive the famine, setting the stage for the Exodus.', scripture: 'Genesis 46:1-7', theme: 'Providence' }
    ]
  },
  mosaic: {
    title: 'Exodus & Conquest',
    timeframe: 'c. 1446 – 1350 BC',
    events: [
      { id: 'exodus', date: 'c. 1446 BC', title: 'The Exodus', loc: 'Rameses, Egypt', coords: { x: 640, y: 560 }, desc: 'God delivers Israel from slavery in Egypt through ten plagues and the crossing of the Red Sea.', scripture: 'Exodus 12:33-42', theme: 'Redemption' },
      { id: 'sinai', date: 'c. 1446 BC', title: 'Covenant at Sinai', loc: 'Mount Sinai', coords: { x: 680, y: 620 }, desc: 'God gives the Law to Moses, establishing the Mosaic Covenant and the sacrificial system.', scripture: 'Exodus 19-20', theme: 'The Law' },
      { id: 'jordan', date: 'c. 1406 BC', title: 'Crossing the Jordan', loc: 'Gilgal', coords: { x: 750, y: 460 }, desc: 'Joshua leads the new generation of Israelites into the Promised Land.', scripture: 'Joshua 3:14-17', theme: 'Fulfillment of Promise' }
    ]
  },
  kingdom: {
    title: 'The Kingdom Era',
    timeframe: 'c. 1050 – 586 BC',
    events: []
  },
  exile: {
    title: 'Exile & Return',
    timeframe: '586 – 400 BC',
    events: []
  },
  church: {
    title: 'Apostolic & Church Age',
    timeframe: '33 AD – Present',
    events: [
      { id: 'pentecost', date: 'c. 33 AD', title: 'Pentecost', loc: 'Jerusalem', coords: { x: 750, y: 460 }, desc: 'The Holy Spirit is poured out on the disciples, empowering them to preach the gospel to all nations.', scripture: 'Acts 2:1-4', theme: 'New Covenant' },
      { id: 'antioch', date: 'c. 49 AD', title: 'Missions from Antioch', loc: 'Antioch', coords: { x: 800, y: 350 }, desc: 'The church at Antioch commissions Paul and Barnabas. It becomes the launchpad for Gentile missions.', scripture: 'Acts 13:1-3', theme: 'Gentile Inclusion' },
      { id: 'athens', date: 'c. 51 AD', title: 'Paul at the Areopagus', loc: 'Athens, Achaia', coords: { x: 350, y: 300 }, desc: 'Paul delivers a masterclass in apologetics, using their altar "To the unknown god" to declare the sovereign Creator.', scripture: 'Acts 17:22-31', theme: 'General Revelation' },
      { id: 'rome', date: 'c. 60 AD', title: 'Paul in Rome', loc: 'Rome', coords: { x: 100, y: 150 }, desc: 'Paul arrives in Rome as a prisoner, preaching the kingdom of God with all boldness and without hindrance.', scripture: 'Acts 28:30-31', theme: 'Gospel Advance' }
    ]
  }
};

export default function AtlasAndTimeline() {
  const [activeEra, setActiveEra] = useState<EraKey>('church');
  const [activeEventId, setActiveEventId] = useState('athens');

  const eraData = eraEvents[activeEra] ?? { title: 'Era Under Construction', timeframe: 'TBD', events: [] };
  const activeEvent = eraData.events.find((event: EraEvent) => event.id === activeEventId) ?? eraData.events[0];

  return (
    <div className="workspace">
      <aside className="left-sidebar">
        <div className="section-heading" style={{ padding: '24px 24px 16px' }}>Redemptive Epochs</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {eras.map((era: { id: EraKey; label: string }) => {
            const isActive = era.id === activeEra;
            return (
              <button
                key={era.id}
                type="button"
                className="nav-pill"
                style={{
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '16px 24px',
                  backgroundColor: isActive ? 'white' : 'transparent',
                  color: isActive ? 'var(--accent-geo)' : 'var(--text-secondary)',
                  borderLeft: isActive ? '4px solid var(--accent-geo)' : '4px solid transparent',
                  borderBottom: '1px solid var(--border-soft)'
                }}
                onClick={() => {
                  setActiveEra(era.id);
                  const nextEvents = eraEvents[era.id]?.events;
                  setActiveEventId(nextEvents?.[0]?.id ?? '');
                }}
              >
                <span>{era.label}</span>
                {isActive && <ChevronRight size={16} />}
              </button>
            );
          })}
        </div>
      </aside>

      <div className="geo-timeline-container" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div className="map-view">
          <svg viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%' }}>
            <path d="M 0 0 L 1000 0 L 1000 600 L 800 600 Q 750 400 600 450 Q 550 500 500 400 Q 450 350 350 450 Q 250 500 200 400 Q 150 200 0 250 Z" fill="var(--map-land)" stroke="var(--map-border)" strokeWidth="1.5" />
            <path d="M 1000 100 Q 800 150 750 250 Q 700 350 850 450 Q 900 550 1000 600" fill="var(--map-land)" stroke="var(--map-border)" strokeWidth="1.5" />
            <path d="M 0 0 L 500 0 Q 450 150 350 250 Q 300 400 400 500 Q 300 550 200 600 L 0 600 Z" fill="var(--map-land)" stroke="var(--map-border)" strokeWidth="1.5" />
            <path d="M 950 400 Q 850 300 700 200 Q 550 100 450 150 Q 350 300 300 400" fill="none" stroke="var(--map-route)" strokeWidth="3" strokeDasharray="8 6" opacity={activeEra === 'church' ? 1 : 0} style={{ transition: 'opacity 0.3s' }} />

            {eraData.events.map((event: EraEvent) => {
              const isActive = event.id === activeEventId;
              return (
                <g key={event.id} transform={`translate(${event.coords.x}, ${event.coords.y})`} onClick={() => setActiveEventId(event.id)} style={{ cursor: 'pointer' }}>
                  {isActive && <circle cx="0" cy="0" r="16" className="pulse-ring" />}
                  <circle cx="0" cy="0" r={isActive ? 8 : 6} fill={isActive ? 'var(--accent-gold)' : 'var(--accent-geo)'} stroke={isActive ? 'white' : 'transparent'} strokeWidth="3" />
                  <text x={isActive ? 15 : -15} y={isActive ? 5 : 20} fontFamily="var(--font-sans)" fontWeight="700" fontSize="12px" fill="var(--text-primary)" textAnchor={isActive ? 'start' : 'end'} style={{ textShadow: '1px 1px 0 white, -1px -1px 0 white' }}>
                    {event.loc}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="bottom-timeline">
          <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border-soft)', backgroundColor: 'var(--bg-subtle)', display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.1rem', fontWeight: 600 }}>{eraData.title}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{eraData.timeframe}</div>
          </div>
          <div style={{ flex: 1, position: 'relative', padding: '20px 40px', display: 'flex', alignItems: 'center' }}>
            {eraData.events.length > 0 ? (
              <>
                <div style={{ position: 'absolute', top: '50%', left: 40, right: 40, height: 4, backgroundColor: 'var(--bg-sidebar)', transform: 'translateY(-50%)', zIndex: 1, borderRadius: 2 }} />
                <div style={{ position: 'absolute', top: '50%', left: 40, width: `${((eraData.events.findIndex((event: EraEvent) => event.id === activeEventId) || 0) / Math.max(eraData.events.length - 1, 1)) * 100}%`, height: 4, backgroundColor: 'var(--accent-gold)', transform: 'translateY(-50%)', zIndex: 1, borderRadius: 2, transition: 'width 0.3s ease' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', position: 'relative', zIndex: 2 }}>
                  {eraData.events.map((event: EraEvent, index: number) => {
                    const isActive = event.id === activeEventId;
                    const isPast = eraData.events.findIndex((current: EraEvent) => current.id === activeEventId) >= index;
                    return (
                      <button key={event.id} type="button" onClick={() => setActiveEventId(event.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: 8, fontWeight: 600 }}>{event.date}</div>
                        <div style={{ width: 16, height: 16, borderRadius: '50%', border: `3px solid ${isActive || isPast ? 'var(--accent-gold)' : 'var(--text-tertiary)'}`, backgroundColor: isActive ? 'var(--accent-gold)' : 'var(--bg-surface)', boxShadow: isActive ? '0 0 0 4px var(--accent-gold-light)' : 'none', transform: isActive ? 'scale(1.2)' : 'none', transition: 'all 0.2s' }} />
                        <div style={{ marginTop: 12, fontSize: '0.85rem', fontWeight: 700, color: isActive ? 'var(--accent-gold)' : 'var(--text-secondary)', textAlign: 'center', maxWidth: 120 }}>{event.title}</div>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div style={{ width: '100%', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.9rem', fontStyle: 'italic' }}>Historical data for this era is currently being compiled.</div>
            )}
          </div>
        </div>
      </div>

      <aside className="right-sidebar">
        {activeEvent ? (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24, height: '100%', overflowY: 'auto' }}>
            <div style={{ padding: '32px 24px 20px', borderBottom: '1px solid var(--border-soft)', backgroundColor: 'var(--bg-subtle)' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', backgroundColor: 'var(--bg-geo-light)', color: 'var(--accent-geo)', borderRadius: 16, fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 12 }}>
                <MapIcon size={12} /> {activeEvent.loc}
              </div>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.8rem', fontWeight: 400, marginBottom: 8 }}>{activeEvent.title}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                <Clock size={14} /> {activeEvent.date}
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-lg)', padding: 20, boxShadow: 'var(--shadow-card)' }}>
              <p style={{ fontFamily: 'var(--font-serif)', fontSize: '1.05rem', lineHeight: 1.6 }}>{activeEvent.desc}</p>
            </div>

            {activeEvent.scripture && (
              <div style={{ backgroundColor: 'var(--bg-subtle)', borderLeft: '3px solid var(--accent-gold)', padding: 16, borderRadius: '0 var(--radius-md) var(--radius-md) 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--accent-gold)', fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: 8 }}>
                  <BookOpen size={14} /> Scripture Context
                </div>
                <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{activeEvent.scripture}</div>
              </div>
            )}

            {activeEvent.theme && (
              <div style={{ backgroundColor: 'var(--accent-gold-light)', border: '1px solid var(--border-gold)', borderRadius: 'var(--radius-md)', padding: 16 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-gold)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>
                  Theological Connection
                </div>
                <div style={{ fontSize: '0.95rem', color: 'var(--text-warm)', fontWeight: 600 }}>{activeEvent.theme}</div>
              </div>
            )}

            <button className="action-button" type="button">
              <BookOpen size={18} /> Read Full Passage
            </button>
          </div>
        ) : (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontStyle: 'italic', fontSize: '0.95rem' }}>
            Select an era with compiled events to explore its historical and theological insights.
          </div>
        )}
      </aside>
    </div>
  );
}
