import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Map as MapIcon, BookOpen, Clock, ChevronRight, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

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

// Geographic coordinate system:
// viewBox: 0 0 1200 750
// Longitude -10° to 60° → x = (lon + 10) / 70 * 1200
// Latitude  50° to 15° → y = (50 - lat) / 35 * 750
//
// Quick reference:
//   Rome       12.5°E 41.9°N → (386, 174)
//   Athens     23.7°E 37.9°N → (578, 259)
//   Antioch    36.2°E 36.2°N → (792, 299)
//   Jerusalem  35.2°E 31.8°N → (776, 391)
//   Goshen     31.5°E 30.8°N → (711, 413)
//   Mt Sinai   33.9°E 28.5°N → (753, 457)
//   Shechem    35.3°E 32.2°N → (777, 383)
//   Ur         46.1°E 30.9°N → (973, 410)

const defaultEraEvents: Record<EraKey, EraData> = {
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
      { id: 'ur', date: 'c. 2090 BC', title: 'The Call of Abram', loc: 'Ur of the Chaldeans', coords: { x: 973, y: 410 }, desc: 'God calls Abram out of Ur, establishing the unconditional covenant of grace promising a land, a seed, and a blessing to all nations.', scripture: 'Genesis 12:1-3', theme: 'Covenant of Grace' },
      { id: 'canaan', date: 'c. 2075 BC', title: 'Arrival in Canaan', loc: 'Shechem', coords: { x: 777, y: 383 }, desc: 'Abram builds an altar at the oak of Moreh. God promises this land to his offspring.', scripture: 'Genesis 12:6-7', theme: 'Promised Land' },
      { id: 'moriah', date: 'c. 2050 BC', title: 'Binding of Isaac', loc: 'Mount Moriah', coords: { x: 776, y: 391 }, desc: 'Abraham\'s faith is tested. A ram is provided as a substitute, foreshadowing the substitutionary atonement of Christ.', scripture: 'Genesis 22:1-14', theme: 'Substitutionary Atonement' },
      { id: 'egypt', date: 'c. 1876 BC', title: 'Descent into Egypt', loc: 'Goshen', coords: { x: 711, y: 413 }, desc: 'Jacob and his family move to Egypt to survive the famine, setting the stage for the Exodus.', scripture: 'Genesis 46:1-7', theme: 'Providence' }
    ]
  },
  mosaic: {
    title: 'Exodus & Conquest',
    timeframe: 'c. 1446 – 1350 BC',
    events: [
      { id: 'exodus', date: 'c. 1446 BC', title: 'The Exodus', loc: 'Rameses, Egypt', coords: { x: 717, y: 413 }, desc: 'God delivers Israel from slavery in Egypt through ten plagues and the crossing of the Red Sea.', scripture: 'Exodus 12:33-42', theme: 'Redemption' },
      { id: 'sinai', date: 'c. 1446 BC', title: 'Covenant at Sinai', loc: 'Mount Sinai', coords: { x: 753, y: 457 }, desc: 'God gives the Law to Moses, establishing the Mosaic Covenant and the sacrificial system.', scripture: 'Exodus 19-20', theme: 'The Law' },
      { id: 'jordan', date: 'c. 1406 BC', title: 'Crossing the Jordan', loc: 'Gilgal', coords: { x: 781, y: 390 }, desc: 'Joshua leads the new generation of Israelites into the Promised Land.', scripture: 'Joshua 3:14-17', theme: 'Fulfillment of Promise' }
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
      { id: 'pentecost', date: 'c. 33 AD', title: 'Pentecost', loc: 'Jerusalem', coords: { x: 776, y: 391 }, desc: 'The Holy Spirit is poured out on the disciples, empowering them to preach the gospel to all nations.', scripture: 'Acts 2:1-4', theme: 'New Covenant' },
      { id: 'antioch', date: 'c. 49 AD', title: 'Missions from Antioch', loc: 'Antioch', coords: { x: 792, y: 299 }, desc: 'The church at Antioch commissions Paul and Barnabas. It becomes the launchpad for Gentile missions.', scripture: 'Acts 13:1-3', theme: 'Gentile Inclusion' },
      { id: 'athens', date: 'c. 51 AD', title: 'Paul at the Areopagus', loc: 'Athens, Achaia', coords: { x: 578, y: 259 }, desc: 'Paul delivers a masterclass in apologetics, using their altar "To the unknown god" to declare the sovereign Creator.', scripture: 'Acts 17:22-31', theme: 'General Revelation' },
      { id: 'rome', date: 'c. 60 AD', title: 'Paul in Rome', loc: 'Rome', coords: { x: 386, y: 174 }, desc: 'Paul arrives in Rome as a prisoner, preaching the kingdom of God with all boldness and without hindrance.', scripture: 'Acts 28:30-31', theme: 'Gospel Advance' }
    ]
  }
};

// Paul's missionary route (approximate waypoints in geographic coords)
const paulRoute = [
  { x: 776, y: 391 }, // Jerusalem
  { x: 792, y: 299 }, // Antioch
  { x: 724, y: 285 }, // Tarsus / S. Anatolia
  { x: 636, y: 210 }, // Izmir / Ephesus area
  { x: 578, y: 259 }, // Athens
  { x: 557, y: 237 }, // Corinth
  { x: 480, y: 215 }, // Adriatic crossing
  { x: 386, y: 174 }, // Rome
];

function MapGeography({ activeEra }: { activeEra: EraKey }) {
  const showRoute = activeEra === 'church';
  const routeD = paulRoute.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');

  return (
    <g>
      {/* === WATER BACKGROUND === */}
      <rect width="1200" height="750" fill="var(--map-water)" />

      {/* === LAND MASSES === */}

      {/* Western Europe backdrop (Spain, France, Alps, Central Europe) */}
      <path fill="var(--map-land)" stroke="var(--map-border)" strokeWidth="0.6" d="
        M 0,0 L 230,0 L 295,28 L 340,72 L 320,90
        L 310,108 L 292,172 L 268,230 L 238,272
        L 205,305 L 170,348 L 128,388 L 85,415
        L 48,432 L 0,440 Z
      " />

      {/* Northern Europe strip (fills top of SVG so there's no water gap) */}
      <path fill="var(--map-land)" d="
        M 230,0 L 1200,0 L 1200,260 L 1155,278 L 1072,262
        L 990,280 L 910,262 L 872,158
        L 800,148 L 700,144 L 642,168
        L 600,178 L 540,188 L 450,178 L 380,82
        L 340,72 L 295,28 Z
      " />

      {/* Italy */}
      <path fill="var(--map-land)" stroke="var(--map-border)" strokeWidth="0.8" d="
        M 310,108 L 387,82 L 415,92
        L 448,122 L 490,200
        L 440,258 L 416,254
        L 428,222 L 386,185
        L 344,188 L 314,156 Z
      " />

      {/* Sicily */}
      <path fill="var(--map-land)" stroke="var(--map-border)" strokeWidth="0.8" d="
        M 386,256 L 446,250 L 456,272 L 427,287 L 390,278 Z
      " />

      {/* Sardinia */}
      <path fill="var(--map-land)" stroke="var(--map-border)" strokeWidth="0.6" d="
        M 326,220 L 348,208 L 360,228 L 354,258 L 334,260 Z
      " />

      {/* Corsica */}
      <path fill="var(--map-land)" stroke="var(--map-border)" strokeWidth="0.6" d="
        M 344,192 L 359,182 L 367,200 L 361,218 L 346,215 Z
      " />

      {/* Greek mainland */}
      <path fill="var(--map-land)" stroke="var(--map-border)" strokeWidth="0.8" d="
        M 531,185 L 618,178 L 660,196 L 668,242
        L 624,268 L 596,286 L 567,270 L 537,236 Z
      " />

      {/* Peloponnese */}
      <path fill="var(--map-land)" stroke="var(--map-border)" strokeWidth="0.7" d="
        M 546,262 L 612,260 L 620,280 L 584,298 L 547,282 Z
      " />

      {/* Crete */}
      <path fill="var(--map-land)" stroke="var(--map-border)" strokeWidth="0.6" d="
        M 586,324 L 652,317 L 668,328 L 645,340 L 587,337 Z
      " />

      {/* Anatolia / Turkey */}
      <path fill="var(--map-land)" stroke="var(--map-border)" strokeWidth="0.8" d="
        M 638,168 L 872,158 L 910,178 L 912,215
        L 878,258 L 838,275 L 800,288 L 762,292
        L 722,284 L 688,266 L 657,242 L 638,210 Z
      " />

      {/* Black Sea (water cut over Anatolia/Europe top) */}
      <path fill="var(--map-water)" d="
        M 640,144 L 700,138 L 795,140 L 872,158
        L 840,172 L 760,165 L 700,162 L 658,168 Z
      " />

      {/* Cyprus */}
      <path fill="var(--map-land)" stroke="var(--map-border)" strokeWidth="0.5" d="
        M 743,316 L 770,309 L 788,318 L 784,330 L 760,336 L 741,328 Z
      " />

      {/* Levant coast: Syria, Lebanon, Israel */}
      <path fill="var(--map-land)" stroke="var(--map-border)" strokeWidth="0.8" d="
        M 792,285 L 832,278 L 844,308
        L 840,350 L 819,390
        L 796,424 L 772,449
        L 757,446 L 753,396
        L 760,350 L 772,310 Z
      " />

      {/* Transjordan plateau */}
      <path fill="var(--map-land)" stroke="var(--map-border)" strokeWidth="0.6" d="
        M 796,424 L 820,390 L 844,392 L 852,428
        L 835,455 L 814,452 Z
      " />

      {/* North Africa – main body */}
      <path fill="var(--map-land)" stroke="var(--map-border)" strokeWidth="0.8" d="
        M 0,440 L 48,432 L 85,415 L 128,388 L 170,348
        L 205,305 L 238,272 L 284,282
        L 350,276 L 400,370 L 464,396 L 516,384
        L 600,396 L 684,402 L 726,399 L 726,412
        L 730,430 L 728,462 L 718,482
        L 706,534 L 688,600 L 668,660
        L 635,718 L 0,750 Z
      " />

      {/* Gulf of Syrte (water notch into Libya coast) */}
      <path fill="var(--map-water)" d="
        M 400,370 L 432,370 L 464,396 L 432,388 Z
      " />

      {/* Gulf of Suez (water between Egypt and Sinai) */}
      <path fill="var(--map-water)" d="
        M 726,399 L 752,393 L 752,438 L 748,466 L 728,462 L 726,412 Z
      " />

      {/* Sinai Peninsula */}
      <path fill="var(--map-land)" stroke="var(--map-border)" strokeWidth="0.7" d="
        M 752,393 L 790,388 L 802,418
        L 798,450 L 773,484 L 756,490
        L 745,468 L 748,438 L 752,418 Z
      " />

      {/* Gulf of Aqaba (water east of Sinai) */}
      <path fill="var(--map-water)" d="
        M 790,388 L 815,378 L 828,400 L 824,446
        L 803,464 L 798,450 L 802,418 Z
      " />

      {/* Arabia */}
      <path fill="var(--map-land)" stroke="var(--map-border)" strokeWidth="0.8" d="
        M 772,449 L 796,424 L 814,452 L 835,455
        L 852,428 L 844,392 L 866,370 L 928,368
        L 994,388 L 1038,432 L 1060,500 L 1045,574
        L 1007,644 L 940,704 L 858,740 L 782,750
        L 756,692 L 761,622 L 785,558 L 800,498
        L 803,464 L 824,446 L 828,400 L 815,378
        L 797,374 L 773,385 L 757,446 Z
      " />

      {/* Red Sea (water between Africa and Arabia) */}
      <path fill="var(--map-water)" d="
        M 718,482 L 728,462 L 748,466
        L 745,468 L 756,490 L 773,484
        L 800,498 L 785,558 L 761,622
        L 756,692 L 730,720 L 700,692
        L 678,640 L 666,588 L 678,538
        L 695,484 L 708,454 Z
      " />

      {/* Mesopotamia / Iraq */}
      <path fill="var(--map-land)" stroke="var(--map-border)" strokeWidth="0.8" d="
        M 843,278 L 910,262 L 990,280 L 1038,334
        L 1038,432 L 994,388 L 928,368
        L 866,370 L 844,350 L 830,310 Z
      " />

      {/* Persian Gulf (water) */}
      <path fill="var(--map-water)" d="
        M 994,388 L 1040,376 L 1090,390 L 1110,428
        L 1096,468 L 1060,484 L 1038,478 L 1038,432 Z
      " />

      {/* Persia / Iran (partial) */}
      <path fill="var(--map-land)" stroke="var(--map-border)" strokeWidth="0.7" d="
        M 990,280 L 1072,262 L 1155,278 L 1175,364
        L 1140,434 L 1090,460 L 1060,484
        L 1096,468 L 1110,428 L 1090,390
        L 1040,376 L 994,388 L 1038,432 L 1038,334 Z
      " />

      {/* Far right fill (eastern Iran / Pakistan edge) */}
      <path fill="var(--map-land)" d="
        M 1155,278 L 1200,260 L 1200,750
        L 1040,750 L 1060,644 L 1007,644
        L 1045,574 L 1060,500 L 1038,478
        L 1060,484 L 1090,460 L 1140,434
        L 1175,364 Z
      " />

      {/* === RIVERS === */}

      {/* Nile – runs north through Egypt */}
      <path
        fill="none"
        stroke="var(--map-water)"
        strokeWidth="2.5"
        strokeLinecap="round"
        d="M 640,640 L 660,580 L 675,520 L 684,460 L 692,420 L 700,400 L 710,390 L 720,380 L 726,370"
      />

      {/* Euphrates – runs SE from Turkey through Mesopotamia */}
      <path
        fill="none"
        stroke="var(--map-water)"
        strokeWidth="2"
        strokeLinecap="round"
        d="M 800,230 L 820,268 L 850,308 L 870,345 L 890,378 L 920,400 L 950,410 L 980,415"
      />

      {/* Tigris – parallel to Euphrates */}
      <path
        fill="none"
        stroke="var(--map-water)"
        strokeWidth="2"
        strokeLinecap="round"
        d="M 830,240 L 860,280 L 892,315 L 920,360 L 950,385 L 973,400 L 985,420"
      />

      {/* Jordan River */}
      <path
        fill="none"
        stroke="var(--map-water)"
        strokeWidth="1.5"
        strokeLinecap="round"
        d="M 775,358 L 776,372 L 776,384 L 777,396 L 778,408"
      />

      {/* Dead Sea */}
      <ellipse cx="778" cy="412" rx="5" ry="10" fill="var(--map-water)" />

      {/* Sea of Galilee */}
      <ellipse cx="776" cy="368" rx="4" ry="6" fill="var(--map-water)" />

      {/* === SEA LABELS === */}
      <text x="268" y="340" fontFamily="var(--font-sans)" fontSize="11" fill="var(--accent-geo)" opacity="0.6" textAnchor="middle" fontStyle="italic">
        Mediterranean Sea
      </text>
      <text x="900" y="210" fontFamily="var(--font-sans)" fontSize="9" fill="var(--accent-geo)" opacity="0.5" textAnchor="middle" fontStyle="italic">
        Black Sea
      </text>
      <text x="820" y="600" fontFamily="var(--font-sans)" fontSize="9" fill="var(--accent-geo)" opacity="0.5" textAnchor="middle" fontStyle="italic">
        Red Sea
      </text>
      <text x="1065" y="432" fontFamily="var(--font-sans)" fontSize="9" fill="var(--accent-geo)" opacity="0.5" textAnchor="middle" fontStyle="italic">
        Persian Gulf
      </text>

      {/* === PAUL'S MISSIONARY ROUTE === */}
      <path
        d={routeD}
        fill="none"
        stroke="var(--map-route)"
        strokeWidth="2.5"
        strokeDasharray="8 5"
        strokeLinecap="round"
        opacity={showRoute ? 0.75 : 0}
        style={{ transition: 'opacity 0.4s' }}
      />
    </g>
  );
}

export default function AtlasAndTimeline() {
  const [activeEra, setActiveEra] = useState<EraKey>('church');
  const [activeEventId, setActiveEventId] = useState('athens');
  const [eraEvents, setEraEvents] = useState<Record<EraKey, EraData>>(defaultEraEvents);

  // Pan / zoom state
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const isDragging = useRef(false);
  const dragOrigin = useRef({ mouseX: 0, mouseY: 0, panX: 0, panY: 0 });
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (async () => {
      try {
        const res = await fetch('http://localhost:4001/file/atlas/eraEvents.json');
        if (!res.ok) return;
        const json = await res.json();
        setEraEvents(prev => ({ ...(prev as Record<EraKey, EraData>), ...(json as Record<EraKey, EraData>) }));
      } catch {
        // fall back to defaults
      }
    })();
  }, []);

  const clampScale = (s: number) => Math.max(0.4, Math.min(10, s));

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    setScale(prev => {
      const next = clampScale(prev * factor);
      const rect = mapContainerRef.current?.getBoundingClientRect();
      if (!rect) return next;
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const scaleFactor = next / prev;
      setPan(p => ({
        x: cx - scaleFactor * (cx - p.x),
        y: cy - scaleFactor * (cy - p.y),
      }));
      return next;
    });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isDragging.current = true;
    dragOrigin.current = { mouseX: e.clientX, mouseY: e.clientY, panX: pan.x, panY: pan.y };
    (e.currentTarget as HTMLElement).style.cursor = 'grabbing';
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - dragOrigin.current.mouseX;
    const dy = e.clientY - dragOrigin.current.mouseY;
    setPan({ x: dragOrigin.current.panX + dx, y: dragOrigin.current.panY + dy });
  }, []);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    isDragging.current = false;
    (e.currentTarget as HTMLElement).style.cursor = 'grab';
  }, []);

  const handleMouseLeave = useCallback(() => {
    isDragging.current = false;
  }, []);

  const resetView = useCallback(() => {
    setPan({ x: 0, y: 0 });
    setScale(1);
  }, []);

  const zoomIn = useCallback(() => {
    setScale(prev => {
      const next = clampScale(prev * 1.3);
      const rect = mapContainerRef.current?.getBoundingClientRect();
      if (rect) {
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const f = next / prev;
        setPan(p => ({ x: cx - f * (cx - p.x), y: cy - f * (cy - p.y) }));
      }
      return next;
    });
  }, []);

  const zoomOut = useCallback(() => {
    setScale(prev => {
      const next = clampScale(prev / 1.3);
      const rect = mapContainerRef.current?.getBoundingClientRect();
      if (rect) {
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const f = next / prev;
        setPan(p => ({ x: cx - f * (cx - p.x), y: cy - f * (cy - p.y) }));
      }
      return next;
    });
  }, []);

  const eraData = eraEvents[activeEra] ?? { title: 'Era Under Construction', timeframe: 'TBD', events: [] };
  const activeEvent = eraData.events.find((e: EraEvent) => e.id === activeEventId) ?? eraData.events[0];

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

      <div className="geo-timeline-container" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <div
          className="map-view"
          ref={mapContainerRef}
          style={{ cursor: 'grab', userSelect: 'none', position: 'relative' }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        >
          <svg
            viewBox="0 0 1200 750"
            preserveAspectRatio="xMidYMid meet"
            style={{ width: '100%', height: '100%', display: 'block' }}
          >
            <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`} style={{ transformOrigin: '0 0' }}>
              <MapGeography activeEra={activeEra} />

              {/* Event markers */}
              {eraData.events.map((event: EraEvent) => {
                const isActive = event.id === activeEventId;
                return (
                  <g
                    key={event.id}
                    transform={`translate(${event.coords.x}, ${event.coords.y})`}
                    onClick={(e) => { e.stopPropagation(); setActiveEventId(event.id); }}
                    style={{ cursor: 'pointer' }}
                  >
                    {isActive && <circle cx="0" cy="0" r="16" className="pulse-ring" />}
                    <circle
                      cx="0" cy="0"
                      r={isActive ? 8 : 6}
                      fill={isActive ? 'var(--accent-gold)' : 'var(--accent-geo)'}
                      stroke="white"
                      strokeWidth={isActive ? 2.5 : 1.5}
                    />
                    <text
                      x={isActive ? 13 : 10}
                      y={isActive ? -10 : -8}
                      fontFamily="var(--font-sans)"
                      fontWeight="700"
                      fontSize={isActive ? '11px' : '10px'}
                      fill={isActive ? 'var(--accent-gold)' : 'var(--text-primary)'}
                      textAnchor="start"
                      style={{ textShadow: '1px 1px 0 white, -1px -1px 0 white, 1px -1px 0 white, -1px 1px 0 white' }}
                    >
                      {event.loc}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Map controls */}
          <div style={{
            position: 'absolute', top: 12, right: 12,
            display: 'flex', flexDirection: 'column', gap: 4,
            zIndex: 10,
          }}>
            {[
              { icon: <ZoomIn size={16} />, onClick: zoomIn, title: 'Zoom in' },
              { icon: <ZoomOut size={16} />, onClick: zoomOut, title: 'Zoom out' },
              { icon: <RotateCcw size={16} />, onClick: resetView, title: 'Reset view' },
            ].map(({ icon, onClick, title }) => (
              <button
                key={title}
                type="button"
                title={title}
                onClick={onClick}
                style={{
                  width: 32, height: 32,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-soft)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                {icon}
              </button>
            ))}
          </div>

          {/* Scale indicator */}
          {scale !== 1 && (
            <div style={{
              position: 'absolute', bottom: 10, right: 12,
              fontSize: '0.75rem', color: 'var(--text-tertiary)',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-soft)',
              borderRadius: 'var(--radius-sm)',
              padding: '2px 8px',
              boxShadow: 'var(--shadow-card)',
              zIndex: 10,
            }}>
              {Math.round(scale * 100)}%
            </div>
          )}
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
                <div style={{ position: 'absolute', top: '50%', left: 40, width: `${((eraData.events.findIndex((e: EraEvent) => e.id === activeEventId) || 0) / Math.max(eraData.events.length - 1, 1)) * 100}%`, height: 4, backgroundColor: 'var(--accent-gold)', transform: 'translateY(-50%)', zIndex: 1, borderRadius: 2, transition: 'width 0.3s ease' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', position: 'relative', zIndex: 2 }}>
                  {eraData.events.map((event: EraEvent, index: number) => {
                    const isActive = event.id === activeEventId;
                    const isPast = eraData.events.findIndex((e: EraEvent) => e.id === activeEventId) >= index;
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
