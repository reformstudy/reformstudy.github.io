import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Map as MapIcon, BookOpen, Clock, ChevronRight, ZoomIn, ZoomOut, RotateCcw,
  List, X, Pencil, Save, Plus, Trash2, Route, Palette, Move,
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { ReferenceCard } from './ReferenceCard';
import { parseScriptureRef } from '../utils/parseScriptureRef';

// ── Types ──────────────────────────────────────────────────────────────────

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

interface MapRoute {
  id: string;
  name: string;
  color: string;
  dash: boolean;
  visibleEras: string[];
  waypoints: { x: number; y: number }[];
}

interface MapStyle {
  water: string;
  land: string;
  border: string;
}

interface MapPath {
  id: string;
  label: string;
  fill: 'land' | 'water';
  stroke: boolean;
  strokeWidth: number;
  points: { x: number; y: number }[];
}

interface MapEllipse {
  id: string;
  label: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

interface MapGeometry {
  paths: MapPath[];
  ellipses: MapEllipse[];
}

interface DraggingVertex {
  pathId: string;   // '__ellipse__<id>' for ellipses
  ptIdx: number;
  startMx: number;
  startMy: number;
  startX: number;
  startY: number;
}

type CmsTab = 'event' | 'routes' | 'map' | 'shape';

// ── Static era list ────────────────────────────────────────────────────────

const eras = [
  { id: 'creation',    label: 'Creation & Fall' },
  { id: 'preflood',   label: 'Pre-Flood Age' },
  { id: 'patriarchal', label: 'Patriarchal Age' },
  { id: 'mosaic',     label: 'Exodus & Conquest' },
  { id: 'kingdom',    label: 'The Kingdom Era' },
  { id: 'exile',      label: 'Exile & Return' },
  { id: 'church',     label: 'Apostolic & Church Age' },
] as const;

type EraKey = typeof eras[number]['id'];

// ── Default era events ─────────────────────────────────────────────────────

const defaultEraEvents: Record<EraKey, EraData> = {
  creation:    { title: 'Creation & Fall',       timeframe: 'Genesis 1 – 3',       events: [] },
  preflood:    { title: 'Pre-Flood Age',          timeframe: 'Genesis 4 – 6',       events: [] },
  patriarchal: {
    title: 'Patriarchal Age', timeframe: 'c. 2100 – 1800 BC',
    events: [
      { id: 'ur',     date: 'c. 2090 BC', title: 'The Call of Abram',    loc: 'Ur of the Chaldeans', coords: { x: 973, y: 410 }, desc: 'God calls Abram out of Ur, establishing the unconditional covenant of grace promising a land, a seed, and a blessing to all nations.', scripture: 'Genesis 12:1-3',  theme: 'Covenant of Grace' },
      { id: 'canaan', date: 'c. 2075 BC', title: 'Arrival in Canaan',    loc: 'Shechem',             coords: { x: 777, y: 383 }, desc: 'Abram builds an altar at the oak of Moreh. God promises this land to his offspring.',                                                   scripture: 'Genesis 12:6-7',  theme: 'Promised Land' },
      { id: 'moriah', date: 'c. 2050 BC', title: 'Binding of Isaac',     loc: 'Mount Moriah',        coords: { x: 776, y: 391 }, desc: 'Abraham\'s faith is tested. A ram is provided as a substitute, foreshadowing the substitutionary atonement of Christ.',               scripture: 'Genesis 22:1-14', theme: 'Substitutionary Atonement' },
      { id: 'egypt',  date: 'c. 1876 BC', title: 'Descent into Egypt',   loc: 'Goshen',              coords: { x: 711, y: 413 }, desc: 'Jacob and his family move to Egypt to survive the famine, setting the stage for the Exodus.',                                        scripture: 'Genesis 46:1-7',  theme: 'Providence' },
    ],
  },
  mosaic: {
    title: 'Exodus & Conquest', timeframe: 'c. 1446 – 1350 BC',
    events: [
      { id: 'exodus', date: 'c. 1446 BC', title: 'The Exodus',           loc: 'Rameses, Egypt',  coords: { x: 717, y: 413 }, desc: 'God delivers Israel from slavery in Egypt through ten plagues and the crossing of the Red Sea.',   scripture: 'Exodus 12:33-42', theme: 'Redemption' },
      { id: 'sinai',  date: 'c. 1446 BC', title: 'Covenant at Sinai',    loc: 'Mount Sinai',     coords: { x: 753, y: 457 }, desc: 'God gives the Law to Moses, establishing the Mosaic Covenant and the sacrificial system.',          scripture: 'Exodus 19-20',    theme: 'The Law' },
      { id: 'jordan', date: 'c. 1406 BC', title: 'Crossing the Jordan',  loc: 'Gilgal',          coords: { x: 781, y: 390 }, desc: 'Joshua leads the new generation of Israelites into the Promised Land.',                           scripture: 'Joshua 3:14-17',  theme: 'Fulfillment of Promise' },
    ],
  },
  kingdom: { title: 'The Kingdom Era',    timeframe: 'c. 1050 – 586 BC', events: [] },
  exile:   { title: 'Exile & Return',     timeframe: '586 – 400 BC',     events: [] },
  church: {
    title: 'Apostolic & Church Age', timeframe: '33 AD – Present',
    events: [
      { id: 'pentecost', date: 'c. 33 AD', title: 'Pentecost',              loc: 'Jerusalem',      coords: { x: 776, y: 391 }, desc: 'The Holy Spirit is poured out on the disciples, empowering them to preach the gospel to all nations.', scripture: 'Acts 2:1-4',    theme: 'New Covenant' },
      { id: 'antioch',   date: 'c. 49 AD', title: 'Missions from Antioch', loc: 'Antioch',        coords: { x: 792, y: 299 }, desc: 'The church at Antioch commissions Paul and Barnabas. It becomes the launchpad for Gentile missions.',  scripture: 'Acts 13:1-3',   theme: 'Gentile Inclusion' },
      { id: 'athens',    date: 'c. 51 AD', title: 'Paul at the Areopagus', loc: 'Athens, Achaia', coords: { x: 578, y: 259 }, desc: 'Paul delivers a masterclass in apologetics, using their altar "To the unknown god" to declare the sovereign Creator.', scripture: 'Acts 17:22-31', theme: 'General Revelation' },
      { id: 'rome',      date: 'c. 60 AD', title: 'Paul in Rome',           loc: 'Rome',           coords: { x: 386, y: 174 }, desc: 'Paul arrives in Rome as a prisoner, preaching the kingdom of God with all boldness and without hindrance.', scripture: 'Acts 28:30-31', theme: 'Gospel Advance' },
    ],
  },
};

// ── Default routes ─────────────────────────────────────────────────────────

const DEFAULT_ROUTES: MapRoute[] = [
  {
    id: 'paul-missionary',
    name: "Paul's Missionary Route",
    color: '#D4A373',
    dash: true,
    visibleEras: ['church'],
    waypoints: [
      { x: 776, y: 391 }, { x: 792, y: 299 }, { x: 724, y: 285 },
      { x: 636, y: 210 }, { x: 578, y: 259 }, { x: 557, y: 237 },
      { x: 480, y: 215 }, { x: 386, y: 174 },
    ],
  },
];

// ── Default map style ──────────────────────────────────────────────────────

const DEFAULT_MAP_STYLE: MapStyle = { water: '#E8F0F2', land: '#F3EFE8', border: '#D8D2C4' };

const MAP_PRESETS = [
  { name: 'Default',   water: '#E8F0F2', land: '#F3EFE8', border: '#D8D2C4' },
  { name: 'Parchment', water: '#B8966E', land: '#EAD8A8', border: '#9A7840' },
  { name: 'Dusk',      water: '#2C3E50', land: '#3D5040', border: '#4A6050' },
  { name: 'Verdant',   water: '#5BA4CF', land: '#95B56A', border: '#6A8040' },
];

// ── Default map geometry ───────────────────────────────────────────────────
// Paths are ordered for correct SVG painter-model rendering
// (water cutouts appear after the land they cut into).

const DEFAULT_MAP_GEOMETRY: MapGeometry = {
  paths: [
    // Background land fills (no stroke — just fill the canvas)
    { id: 'northern-europe', label: 'Northern Europe',    fill: 'land',  stroke: false, strokeWidth: 0,   points: [{x:230,y:0},{x:1200,y:0},{x:1200,y:260},{x:1155,y:278},{x:1072,y:262},{x:990,y:280},{x:910,y:262},{x:872,y:158},{x:800,y:148},{x:700,y:144},{x:642,y:168},{x:600,y:178},{x:540,y:188},{x:450,y:178},{x:380,y:82},{x:340,y:72},{x:295,y:28}] },
    { id: 'far-east',        label: 'Far East Fill',      fill: 'land',  stroke: false, strokeWidth: 0,   points: [{x:1155,y:278},{x:1200,y:260},{x:1200,y:750},{x:1040,y:750},{x:1060,y:644},{x:1007,y:644},{x:1045,y:574},{x:1060,y:500},{x:1038,y:478},{x:1060,y:484},{x:1090,y:460},{x:1140,y:434},{x:1175,y:364}] },

    // Western Europe
    { id: 'western-europe',  label: 'Western Europe',     fill: 'land',  stroke: true,  strokeWidth: 0.6, points: [{x:0,y:0},{x:230,y:0},{x:295,y:28},{x:340,y:72},{x:320,y:90},{x:310,y:108},{x:292,y:172},{x:268,y:230},{x:238,y:272},{x:205,y:305},{x:170,y:348},{x:128,y:388},{x:85,y:415},{x:48,y:432},{x:0,y:440}] },

    // Italian peninsula & islands
    { id: 'italy',           label: 'Italy',              fill: 'land',  stroke: true,  strokeWidth: 0.8, points: [{x:310,y:108},{x:387,y:82},{x:415,y:92},{x:448,y:122},{x:490,y:200},{x:440,y:258},{x:416,y:254},{x:428,y:222},{x:386,y:185},{x:344,y:188},{x:314,y:156}] },
    { id: 'sicily',          label: 'Sicily',             fill: 'land',  stroke: true,  strokeWidth: 0.8, points: [{x:386,y:256},{x:446,y:250},{x:456,y:272},{x:427,y:287},{x:390,y:278}] },
    { id: 'sardinia',        label: 'Sardinia',           fill: 'land',  stroke: true,  strokeWidth: 0.6, points: [{x:326,y:220},{x:348,y:208},{x:360,y:228},{x:354,y:258},{x:334,y:260}] },
    { id: 'corsica',         label: 'Corsica',            fill: 'land',  stroke: true,  strokeWidth: 0.6, points: [{x:344,y:192},{x:359,y:182},{x:367,y:200},{x:361,y:218},{x:346,y:215}] },

    // Greece
    { id: 'greece',          label: 'Greek Mainland',     fill: 'land',  stroke: true,  strokeWidth: 0.8, points: [{x:531,y:185},{x:618,y:178},{x:660,y:196},{x:668,y:242},{x:624,y:268},{x:596,y:286},{x:567,y:270},{x:537,y:236}] },
    { id: 'peloponnese',     label: 'Peloponnese',        fill: 'land',  stroke: true,  strokeWidth: 0.7, points: [{x:546,y:262},{x:612,y:260},{x:620,y:280},{x:584,y:298},{x:547,y:282}] },
    { id: 'crete',           label: 'Crete',              fill: 'land',  stroke: true,  strokeWidth: 0.6, points: [{x:586,y:324},{x:652,y:317},{x:668,y:328},{x:645,y:340},{x:587,y:337}] },

    // Anatolia (Turkey)
    { id: 'anatolia',        label: 'Anatolia / Turkey',  fill: 'land',  stroke: true,  strokeWidth: 0.8, points: [{x:638,y:168},{x:872,y:158},{x:910,y:178},{x:912,y:215},{x:878,y:258},{x:838,y:275},{x:800,y:288},{x:762,y:292},{x:722,y:284},{x:688,y:266},{x:657,y:242},{x:638,y:210}] },

    // Black Sea — water cutout over Anatolia/Europe junction
    { id: 'black-sea',       label: 'Black Sea',          fill: 'water', stroke: false, strokeWidth: 0,   points: [{x:640,y:144},{x:700,y:138},{x:795,y:140},{x:872,y:158},{x:840,y:172},{x:760,y:165},{x:700,y:162},{x:658,y:168}] },

    // Eastern Mediterranean
    { id: 'cyprus',          label: 'Cyprus',             fill: 'land',  stroke: true,  strokeWidth: 0.5, points: [{x:743,y:316},{x:770,y:309},{x:788,y:318},{x:784,y:330},{x:760,y:336},{x:741,y:328}] },
    { id: 'levant',          label: 'Levant (Syria/Lebanon/Israel)', fill: 'land', stroke: true, strokeWidth: 0.8, points: [{x:792,y:285},{x:832,y:278},{x:844,y:308},{x:840,y:350},{x:819,y:390},{x:796,y:424},{x:772,y:449},{x:757,y:446},{x:753,y:396},{x:760,y:350},{x:772,y:310}] },
    { id: 'transjordan',     label: 'Transjordan Plateau',fill: 'land',  stroke: true,  strokeWidth: 0.6, points: [{x:796,y:424},{x:820,y:390},{x:844,y:392},{x:852,y:428},{x:835,y:455},{x:814,y:452}] },

    // North Africa
    { id: 'north-africa',    label: 'North Africa',       fill: 'land',  stroke: true,  strokeWidth: 0.8, points: [{x:0,y:440},{x:48,y:432},{x:85,y:415},{x:128,y:388},{x:170,y:348},{x:205,y:305},{x:238,y:272},{x:284,y:282},{x:350,y:276},{x:400,y:370},{x:464,y:396},{x:516,y:384},{x:600,y:396},{x:684,y:402},{x:726,y:399},{x:726,y:412},{x:730,y:430},{x:728,y:462},{x:718,y:482},{x:706,y:534},{x:688,y:600},{x:668,y:660},{x:635,y:718},{x:0,y:750}] },

    // Water notches into North Africa
    { id: 'gulf-syrte',      label: 'Gulf of Syrte',      fill: 'water', stroke: false, strokeWidth: 0,   points: [{x:400,y:370},{x:432,y:370},{x:464,y:396},{x:432,y:388}] },
    { id: 'gulf-suez',       label: 'Gulf of Suez',       fill: 'water', stroke: false, strokeWidth: 0,   points: [{x:726,y:399},{x:752,y:393},{x:752,y:438},{x:748,y:466},{x:728,y:462},{x:726,y:412}] },

    // Sinai
    { id: 'sinai',           label: 'Sinai Peninsula',    fill: 'land',  stroke: true,  strokeWidth: 0.7, points: [{x:752,y:393},{x:790,y:388},{x:802,y:418},{x:798,y:450},{x:773,y:484},{x:756,y:490},{x:745,y:468},{x:748,y:438},{x:752,y:418}] },
    { id: 'gulf-aqaba',      label: 'Gulf of Aqaba',      fill: 'water', stroke: false, strokeWidth: 0,   points: [{x:790,y:388},{x:815,y:378},{x:828,y:400},{x:824,y:446},{x:803,y:464},{x:798,y:450},{x:802,y:418}] },

    // Arabian Peninsula
    { id: 'arabia',          label: 'Arabian Peninsula',  fill: 'land',  stroke: true,  strokeWidth: 0.8, points: [{x:772,y:449},{x:796,y:424},{x:814,y:452},{x:835,y:455},{x:852,y:428},{x:844,y:392},{x:866,y:370},{x:928,y:368},{x:994,y:388},{x:1038,y:432},{x:1060,y:500},{x:1045,y:574},{x:1007,y:644},{x:940,y:704},{x:858,y:740},{x:782,y:750},{x:756,y:692},{x:761,y:622},{x:785,y:558},{x:800,y:498},{x:803,y:464},{x:824,y:446},{x:828,y:400},{x:815,y:378},{x:797,y:374},{x:773,y:385},{x:757,y:446}] },

    // Red Sea
    { id: 'red-sea',         label: 'Red Sea',            fill: 'water', stroke: false, strokeWidth: 0,   points: [{x:718,y:482},{x:728,y:462},{x:748,y:466},{x:745,y:468},{x:756,y:490},{x:773,y:484},{x:800,y:498},{x:785,y:558},{x:761,y:622},{x:756,y:692},{x:730,y:720},{x:700,y:692},{x:678,y:640},{x:666,y:588},{x:678,y:538},{x:695,y:484},{x:708,y:454}] },

    // Mesopotamia & Persian Gulf
    { id: 'mesopotamia',     label: 'Mesopotamia / Iraq', fill: 'land',  stroke: true,  strokeWidth: 0.8, points: [{x:843,y:278},{x:910,y:262},{x:990,y:280},{x:1038,y:334},{x:1038,y:432},{x:994,y:388},{x:928,y:368},{x:866,y:370},{x:844,y:350},{x:830,y:310}] },
    { id: 'persian-gulf',    label: 'Persian Gulf',       fill: 'water', stroke: false, strokeWidth: 0,   points: [{x:994,y:388},{x:1040,y:376},{x:1090,y:390},{x:1110,y:428},{x:1096,y:468},{x:1060,y:484},{x:1038,y:478},{x:1038,y:432}] },

    // Persia (Iran)
    { id: 'persia',          label: 'Persia / Iran',      fill: 'land',  stroke: true,  strokeWidth: 0.7, points: [{x:990,y:280},{x:1072,y:262},{x:1155,y:278},{x:1175,y:364},{x:1140,y:434},{x:1090,y:460},{x:1060,y:484},{x:1096,y:468},{x:1110,y:428},{x:1090,y:390},{x:1040,y:376},{x:994,y:388},{x:1038,y:432},{x:1038,y:334}] },
  ],
  ellipses: [
    { id: 'dead-sea',       label: 'Dead Sea',        cx: 778, cy: 412, rx: 5,  ry: 10 },
    { id: 'sea-of-galilee', label: 'Sea of Galilee',  cx: 776, cy: 368, rx: 4,  ry: 6  },
  ],
};

// ── Shared CMS input styles ────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 9px', borderRadius: 7,
  border: '1px solid var(--border-soft)', background: 'var(--bg-surface)',
  fontSize: '0.85rem', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)',
  boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 3 };
const labelTextStyle: React.CSSProperties = {
  fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-tertiary)',
  textTransform: 'uppercase', letterSpacing: '0.05em',
};

// ── MapGeography ───────────────────────────────────────────────────────────

function MapGeography({
  activeEra, routes, mapStyle, geometry, cmsEdit, cmsActiveRouteId, onDeleteWaypoint,
}: {
  activeEra: EraKey;
  routes: MapRoute[];
  mapStyle: MapStyle;
  geometry: MapGeometry;
  cmsEdit?: boolean;
  cmsActiveRouteId?: string;
  onDeleteWaypoint?: (routeId: string, idx: number) => void;
}) {
  const { water: w, land: l, border: b } = mapStyle;
  const visibleRoutes = routes.filter(r => r.visibleEras.includes(activeEra));

  return (
    <g>
      {/* Water background */}
      <rect width="1200" height="750" fill={w} />

      {/* Land and water polygons — render order is significant */}
      {geometry.paths.map(path => {
        const d = path.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ') + ' Z';
        return (
          <path
            key={path.id}
            d={d}
            fill={path.fill === 'water' ? w : l}
            stroke={path.stroke ? b : 'none'}
            strokeWidth={path.strokeWidth}
          />
        );
      })}

      {/* Water ellipses */}
      {geometry.ellipses.map(el => (
        <ellipse key={el.id} cx={el.cx} cy={el.cy} rx={el.rx} ry={el.ry} fill={w} />
      ))}

      {/* Rivers (decorative, not vertex-editable) */}
      <path fill="none" stroke={w} strokeWidth="2.5" strokeLinecap="round"
        d="M 640,640 L 660,580 L 675,520 L 684,460 L 692,420 L 700,400 L 710,390 L 720,380 L 726,370" />
      <path fill="none" stroke={w} strokeWidth="2" strokeLinecap="round"
        d="M 800,230 L 820,268 L 850,308 L 870,345 L 890,378 L 920,400 L 950,410 L 980,415" />
      <path fill="none" stroke={w} strokeWidth="2" strokeLinecap="round"
        d="M 830,240 L 860,280 L 892,315 L 920,360 L 950,385 L 973,400 L 985,420" />
      <path fill="none" stroke={w} strokeWidth="1.5" strokeLinecap="round"
        d="M 775,358 L 776,372 L 776,384 L 777,396 L 778,408" />

      {/* Sea labels */}
      <text x="268" y="340" fontFamily="var(--font-sans)" fontSize="11" fill="#557799" opacity="0.55" textAnchor="middle" fontStyle="italic">Mediterranean Sea</text>
      <text x="900" y="210" fontFamily="var(--font-sans)" fontSize="9"  fill="#557799" opacity="0.45" textAnchor="middle" fontStyle="italic">Black Sea</text>
      <text x="820" y="600" fontFamily="var(--font-sans)" fontSize="9"  fill="#557799" opacity="0.45" textAnchor="middle" fontStyle="italic">Red Sea</text>
      <text x="1065" y="432" fontFamily="var(--font-sans)" fontSize="9" fill="#557799" opacity="0.45" textAnchor="middle" fontStyle="italic">Persian Gulf</text>

      {/* Routes */}
      {visibleRoutes.map(route => {
        const d = route.waypoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');
        const isActive = route.id === cmsActiveRouteId;
        return (
          <g key={route.id}>
            {route.waypoints.length > 1 && (
              <path d={d} fill="none" stroke={route.color} strokeWidth="2.5"
                strokeDasharray={route.dash ? '8 5' : 'none'} strokeLinecap="round" opacity={0.75} />
            )}
            {cmsEdit && isActive && route.waypoints.map((wp, i) => (
              <g key={i} transform={`translate(${wp.x},${wp.y})`} style={{ cursor: 'pointer' }}
                onClick={e => { e.stopPropagation(); onDeleteWaypoint?.(route.id, i); }}>
                <circle r={8} fill={route.color} stroke="white" strokeWidth={2} opacity={0.9} />
                <text textAnchor="middle" dominantBaseline="central" fontSize="9" fill="white" fontWeight="700" fontFamily="var(--font-sans)">{i + 1}</text>
              </g>
            ))}
          </g>
        );
      })}
    </g>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function AtlasAndTimeline() {
  const { eraId } = useParams<{ eraId?: string }>();
  const routerNavigate = useNavigate();

  const initialEra: EraKey = (eraId && eras.some(e => e.id === eraId) ? eraId : 'church') as EraKey;
  const [activeEra, setActiveEra]         = useState<EraKey>(initialEra);
  const [activeEventId, setActiveEventId] = useState('athens');
  const [eraEvents, setEraEvents]         = useState<Record<EraKey, EraData>>(defaultEraEvents);
  const [routes, setRoutes]               = useState<MapRoute[]>(DEFAULT_ROUTES);
  const [mapStyle, setMapStyle]           = useState<MapStyle>(DEFAULT_MAP_STYLE);
  const [mapGeometry, setMapGeometry]     = useState<MapGeometry>(DEFAULT_MAP_GEOMETRY);

  const isCmsMode = import.meta.env.VITE_CMS_MODE === 'true';
  const [cmsEditMode, setCmsEditMode]     = useState(false);
  const [cmsTab, setCmsTab]               = useState<CmsTab>('event');
  const [cmsSaving, setCmsSaving]         = useState(false);
  const [cmsSaveMsg, setCmsSaveMsg]       = useState('');
  const [activeRouteId, setActiveRouteId] = useState(DEFAULT_ROUTES[0]?.id ?? '');
  const [addingWaypoint, setAddingWaypoint] = useState(false);
  const [vertexEditMode, setVertexEditMode] = useState(false);
  const [activePathId, setActivePathId]     = useState<string | null>(null);

  interface DrawingPolygon { name: string; fill: 'land' | 'water'; points: { x: number; y: number }[]; }
  const [drawingPolygon, setDrawingPolygon] = useState<DrawingPolygon | null>(null);

  // Pan / zoom
  const [pan, setPan]     = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const isDragging        = useRef(false);
  const dragOrigin        = useRef({ mouseX: 0, mouseY: 0, panX: 0, panY: 0 });
  const mapContainerRef   = useRef<HTMLDivElement>(null);
  const lastPinchDistance = useRef<number | null>(null);
  const draggingVertex    = useRef<DraggingVertex | null>(null);
  const panRef            = useRef({ x: 0, y: 0 });
  const scaleRef          = useRef(1);
  const animFrameRef      = useRef<number | null>(null);
  panRef.current   = pan;
  scaleRef.current = scale;

  // Mobile drawer
  const [mobileSidebar, setMobileSidebar] = useState<'left' | 'right' | null>(null);
  const closeMobile = () => setMobileSidebar(null);

  // ── CMS data load ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!isCmsMode) return;
    (async () => {
      try {
        const res = await fetch('http://localhost:4001/file/atlas/eraEvents.json');
        if (!res.ok) return;
        const json = await res.json();
        if (json.eraEvents) {
          setEraEvents(prev => ({ ...prev, ...(json.eraEvents as Record<EraKey, EraData>) }));
          if (Array.isArray(json.routes))   setRoutes(json.routes as MapRoute[]);
          if (json.mapStyle)                setMapStyle(json.mapStyle as MapStyle);
          if (json.mapGeometry)             setMapGeometry(json.mapGeometry as MapGeometry);
        } else {
          setEraEvents(prev => ({ ...prev, ...(json as Record<EraKey, EraData>) }));
        }
      } catch { /* fall back to defaults */ }
    })();
  }, [isCmsMode]);

  // Escape key: exit any drawing/edit mode
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setAddingWaypoint(false);
      setVertexEditMode(false);
      setDrawingPolygon(null);
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────

  const clampScale = (s: number) => Math.max(0.4, Math.min(10, s));

  // Smooth animated pan/zoom to target — uses RAF with ease-in-out
  const animateTo = useCallback((toPan: { x: number; y: number }, toScale: number) => {
    if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current);
    const fromPan   = { ...panRef.current };
    const fromScale = scaleRef.current;
    const start     = performance.now();
    const duration  = 450;
    const ease = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    const step = (now: number) => {
      const t  = Math.min((now - start) / duration, 1);
      const et = ease(t);
      setPan({ x: fromPan.x + (toPan.x - fromPan.x) * et, y: fromPan.y + (toPan.y - fromPan.y) * et });
      setScale(fromScale + (toScale - fromScale) * et);
      if (t < 1) animFrameRef.current = requestAnimationFrame(step);
      else animFrameRef.current = null;
    };
    animFrameRef.current = requestAnimationFrame(step);
  }, []);

  // Compute pan/scale to fit a list of events into the visible map area
  const computeFitForEvents = useCallback((events: EraEvent[]): { pan: { x: number; y: number }; scale: number } | null => {
    const rect = mapContainerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    if (events.length === 0) return { pan: { x: 0, y: 0 }, scale: 1 };
    const xs = events.map(e => e.coords.x);
    const ys = events.map(e => e.coords.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const pad  = 110;
    const bboxW = Math.max(maxX - minX, 1) + pad * 2;
    const bboxH = Math.max(maxY - minY, 1) + pad * 2;
    const s = clampScale(Math.min(rect.width / bboxW, rect.height / bboxH));
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    return { scale: s, pan: { x: rect.width / 2 - cx * s, y: rect.height / 2 - cy * s } };
  }, []);

  // Focus tightly on a single event coord
  const focusOnCoords = useCallback((coords: { x: number; y: number }, targetScale = 3.5) => {
    const rect = mapContainerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const s = clampScale(targetScale);
    animateTo({ x: rect.width / 2 - coords.x * s, y: rect.height / 2 - coords.y * s }, s);
  }, [animateTo]);

  // Sync URL param → state when navigating via back/forward or a link
  useEffect(() => {
    if (eraId && eras.some(e => e.id === eraId) && eraId !== activeEra) {
      const key = eraId as EraKey;
      setActiveEra(key);
      setActiveEventId(eraEvents[key]?.events?.[0]?.id ?? '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eraId]);

  // Auto-focus when active era changes
  useEffect(() => {
    const events = eraEvents[activeEra]?.events ?? [];
    if (events.length === 0) { animateTo({ x: 0, y: 0 }, 1); return; }
    const target = computeFitForEvents(events);
    if (target) animateTo(target.pan, target.scale);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEra]);

  // Initial focus on mount
  useEffect(() => {
    requestAnimationFrame(() => {
      const events = eraEvents['church'].events;
      const target = computeFitForEvents(events);
      if (target) { setPan(target.pan); setScale(target.scale); }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchCmsTab = (tab: CmsTab) => {
    setCmsTab(tab);
    if (tab !== 'routes') setAddingWaypoint(false);
    if (tab !== 'shape')  { setVertexEditMode(false); setActivePathId(null); setDrawingPolygon(null); }
  };

  const updateEraField = (field: 'title' | 'timeframe', value: string) =>
    setEraEvents(prev => ({ ...prev, [activeEra]: { ...prev[activeEra], [field]: value } }));

  const updateActiveEventField = (field: keyof EraEvent | 'coords.x' | 'coords.y', value: string | number) => {
    setEraEvents(prev => ({
      ...prev,
      [activeEra]: {
        ...prev[activeEra],
        events: prev[activeEra].events.map(e => {
          if (e.id !== activeEventId) return e;
          if (field === 'coords.x') return { ...e, coords: { ...e.coords, x: Number(value) } };
          if (field === 'coords.y') return { ...e, coords: { ...e.coords, y: Number(value) } };
          return { ...e, [field]: value as string };
        }),
      },
    }));
  };

  const addEvent = () => {
    const id = `event-${Date.now()}`;
    const newEvent: EraEvent = { id, date: 'c. Year', title: 'New Event', loc: 'Location', coords: { x: 776, y: 391 }, desc: 'Description', scripture: 'Reference', theme: 'Theme' };
    setEraEvents(prev => ({ ...prev, [activeEra]: { ...prev[activeEra], events: [...prev[activeEra].events, newEvent] } }));
    setActiveEventId(id);
  };

  const deleteActiveEvent = () => {
    const remaining = eraEvents[activeEra].events.filter(e => e.id !== activeEventId);
    setEraEvents(prev => ({ ...prev, [activeEra]: { ...prev[activeEra], events: remaining } }));
    setActiveEventId(remaining[0]?.id ?? '');
  };

  const updateRoute = (routeId: string, patch: Partial<MapRoute>) =>
    setRoutes(prev => prev.map(r => r.id === routeId ? { ...r, ...patch } : r));

  const addRoute = () => {
    const id = `route-${Date.now()}`;
    setRoutes(prev => [...prev, { id, name: 'New Route', color: '#A0A0F0', dash: true, visibleEras: [activeEra], waypoints: [] }]);
    setActiveRouteId(id);
  };

  const deleteRoute = (routeId: string) => {
    setRoutes(prev => {
      const remaining = prev.filter(r => r.id !== routeId);
      if (activeRouteId === routeId) setActiveRouteId(remaining[0]?.id ?? '');
      return remaining;
    });
  };

  const deleteWaypoint = useCallback((routeId: string, idx: number) =>
    setRoutes(prev => prev.map(r => r.id === routeId ? { ...r, waypoints: r.waypoints.filter((_, i) => i !== idx) } : r))
  , []);

  const toggleEraForRoute = (routeId: string, eraId: string) => {
    const route = routes.find(r => r.id === routeId);
    if (!route) return;
    const has = route.visibleEras.includes(eraId);
    updateRoute(routeId, { visibleEras: has ? route.visibleEras.filter(e => e !== eraId) : [...route.visibleEras, eraId] });
  };

  const updateEllipse = (id: string, field: keyof MapEllipse, value: number) =>
    setMapGeometry(prev => ({
      ...prev,
      ellipses: prev.ellipses.map(el => el.id !== id ? el : { ...el, [field]: value }),
    }));

  const addEllipse = () => {
    const id = `ellipse-${Date.now()}`;
    setMapGeometry(prev => ({
      ...prev,
      ellipses: [...prev.ellipses, { id, label: 'New Water Body', cx: 600, cy: 375, rx: 10, ry: 16 }],
    }));
  };

  const deleteEllipse = (id: string) =>
    setMapGeometry(prev => ({ ...prev, ellipses: prev.ellipses.filter(el => el.id !== id) }));

  const deletePath = (id: string) => {
    setMapGeometry(prev => ({ ...prev, paths: prev.paths.filter(p => p.id !== id) }));
    if (activePathId === id) { setActivePathId(null); setVertexEditMode(false); }
  };

  const updatePath = (id: string, patch: Partial<MapPath>) =>
    setMapGeometry(prev => ({ ...prev, paths: prev.paths.map(p => p.id !== id ? p : { ...p, ...patch }) }));

  const commitDrawing = () => {
    if (!drawingPolygon || drawingPolygon.points.length < 3) return;
    const id = `path-${Date.now()}`;
    setMapGeometry(prev => ({
      ...prev,
      paths: [...prev.paths, {
        id,
        label: drawingPolygon.name || 'New Polygon',
        fill: drawingPolygon.fill,
        stroke: true,
        strokeWidth: 0.8,
        points: drawingPolygon.points,
      }],
    }));
    setActivePathId(id);
    setVertexEditMode(true);
    setDrawingPolygon(null);
  };

  const focusOnPath = useCallback((path: MapPath) => {
    if (path.points.length === 0) return;
    const xs = path.points.map(p => p.x);
    const ys = path.points.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const pad  = 80;
    const bboxW = Math.max(maxX - minX, 20) + pad * 2;
    const bboxH = Math.max(maxY - minY, 20) + pad * 2;
    const rect = mapContainerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const s  = clampScale(Math.min(rect.width / bboxW, rect.height / bboxH));
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    animateTo({ x: rect.width / 2 - cx * s, y: rect.height / 2 - cy * s }, s);
  }, [animateTo]);

  const saveToDisk = async () => {
    setCmsSaving(true); setCmsSaveMsg('');
    try {
      const res = await fetch('http://localhost:4001/file/atlas/eraEvents.json', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: JSON.stringify({ eraEvents, routes, mapStyle, mapGeometry }, null, 2) }),
      });
      if (!res.ok) throw new Error();
      setCmsSaveMsg('Saved!');
      setTimeout(() => setCmsSaveMsg(''), 2500);
    } catch { setCmsSaveMsg('Save failed'); }
    finally { setCmsSaving(false); }
  };

  // ── Pan / zoom / vertex-drag handlers ─────────────────────────────────

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    setScale(prev => {
      const next = clampScale(prev * factor);
      const rect = mapContainerRef.current?.getBoundingClientRect();
      if (!rect) return next;
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const sf = next / prev;
      setPan(p => ({ x: cx - sf * (cx - p.x), y: cy - sf * (cy - p.y) }));
      return next;
    });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (addingWaypoint || drawingPolygon) return;
    if (e.button !== 0) return;
    isDragging.current = true;
    dragOrigin.current = { mouseX: e.clientX, mouseY: e.clientY, panX: pan.x, panY: pan.y };
    (e.currentTarget as HTMLElement).style.cursor = 'grabbing';
  }, [pan, addingWaypoint, drawingPolygon]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const dv = draggingVertex.current;
    if (dv) {
      const dSvgX = (e.clientX - dv.startMx) / scale;
      const dSvgY = (e.clientY - dv.startMy) / scale;
      const nx = Math.round(dv.startX + dSvgX);
      const ny = Math.round(dv.startY + dSvgY);
      if (dv.pathId.startsWith('__el__')) {
        const elId = dv.pathId.slice(6);
        setMapGeometry(prev => ({ ...prev, ellipses: prev.ellipses.map(el => el.id !== elId ? el : { ...el, cx: nx, cy: ny }) }));
      } else {
        setMapGeometry(prev => ({
          ...prev,
          paths: prev.paths.map(p => p.id !== dv.pathId ? p : {
            ...p, points: p.points.map((pt, i) => i !== dv.ptIdx ? pt : { x: nx, y: ny }),
          }),
        }));
      }
      return;
    }
    if (!isDragging.current) return;
    setPan({ x: dragOrigin.current.panX + e.clientX - dragOrigin.current.mouseX, y: dragOrigin.current.panY + e.clientY - dragOrigin.current.mouseY });
  }, [scale]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    draggingVertex.current = null;
    isDragging.current = false;
    (e.currentTarget as HTMLElement).style.cursor = addingWaypoint ? 'crosshair' : 'grab';
  }, [addingWaypoint]);

  const handleMouseLeave = useCallback(() => {
    draggingVertex.current = null;
    isDragging.current = false;
  }, []);

  const handleMapClick = useCallback((e: React.MouseEvent) => {
    const rect = mapContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const svgX = Math.round((e.clientX - rect.left - pan.x) / scale);
    const svgY = Math.round((e.clientY - rect.top  - pan.y) / scale);
    if (drawingPolygon) {
      setDrawingPolygon(prev => prev ? { ...prev, points: [...prev.points, { x: svgX, y: svgY }] } : null);
      return;
    }
    if (!addingWaypoint || !activeRouteId) return;
    setRoutes(prev => prev.map(r => r.id !== activeRouteId ? r : { ...r, waypoints: [...r.waypoints, { x: svgX, y: svgY }] }));
  }, [drawingPolygon, addingWaypoint, activeRouteId, pan, scale]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (addingWaypoint) return;
    if (e.touches.length === 1) {
      isDragging.current = true;
      dragOrigin.current = { mouseX: e.touches[0].clientX, mouseY: e.touches[0].clientY, panX: pan.x, panY: pan.y };
    } else if (e.touches.length === 2) {
      isDragging.current = false;
      lastPinchDistance.current = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    }
  }, [pan, addingWaypoint]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1 && isDragging.current) {
      setPan({ x: dragOrigin.current.panX + e.touches[0].clientX - dragOrigin.current.mouseX, y: dragOrigin.current.panY + e.touches[0].clientY - dragOrigin.current.mouseY });
    } else if (e.touches.length === 2 && lastPinchDistance.current !== null) {
      const newDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const factor = newDist / lastPinchDistance.current;
      lastPinchDistance.current = newDist;
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      setScale(prev => {
        const next = clampScale(prev * factor);
        const rect = mapContainerRef.current?.getBoundingClientRect();
        if (!rect) return next;
        const cx = midX - rect.left; const cy = midY - rect.top;
        const sf = next / prev;
        setPan(p => ({ x: cx - sf * (cx - p.x), y: cy - sf * (cy - p.y) }));
        return next;
      });
    }
  }, []);

  const handleTouchEnd = useCallback(() => { isDragging.current = false; lastPinchDistance.current = null; }, []);

  const resetView = useCallback(() => { setPan({ x: 0, y: 0 }); setScale(1); }, []);

  const zoomStep = useCallback((dir: 1 | -1) => {
    setScale(prev => {
      const next = clampScale(dir === 1 ? prev * 1.3 : prev / 1.3);
      const rect = mapContainerRef.current?.getBoundingClientRect();
      if (rect) { const f = next / prev; const cx = rect.width / 2; const cy = rect.height / 2; setPan(p => ({ x: cx - f * (cx - p.x), y: cy - f * (cy - p.y) })); }
      return next;
    });
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────

  const eraData     = eraEvents[activeEra] ?? { title: 'Era', timeframe: '', events: [] };
  const activeEvent = eraData.events.find(e => e.id === activeEventId) ?? eraData.events[0];
  const activeRoute = routes.find(r => r.id === activeRouteId);

  const showVertices   = isCmsMode && cmsEditMode && cmsTab === 'shape' && vertexEditMode && !!activePathId;
  const activePath     = activePathId ? mapGeometry.paths.find(p => p.id === activePathId) ?? null : null;
  const mapCursor      = (addingWaypoint || drawingPolygon) ? 'crosshair' : showVertices ? 'default' : 'grab';

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <>
    <div className="mobile-overlay" style={{ opacity: mobileSidebar ? 1 : 0, pointerEvents: mobileSidebar ? 'auto' : 'none' }} onClick={closeMobile} />
    <div className="mobile-panel-bar mobile-only">
      <button className="mobile-panel-btn" onClick={() => setMobileSidebar('left')}><List size={15} /> Eras</button>
      <button className="mobile-panel-btn" onClick={() => setMobileSidebar('right')}><BookOpen size={15} /> Details</button>
    </div>

    <div className="workspace">
      {/* ── Left sidebar ── */}
      <aside className={`left-sidebar${mobileSidebar === 'left' ? ' mobile-open' : ''}`}>
        <div className="sidebar-close-row mobile-only">
          <button className="sidebar-close-btn" onClick={closeMobile}><X size={16} /> Close</button>
        </div>
        <div className="section-heading" style={{ padding: '24px 24px 16px' }}>Redemptive Epochs</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {eras.map(era => {
            const isActive = era.id === activeEra;
            return (
              <button key={era.id} type="button" className="nav-pill"
                style={{ justifyContent: 'space-between', width: '100%', padding: '16px 24px', backgroundColor: isActive ? 'white' : 'transparent', color: isActive ? 'var(--accent-geo)' : 'var(--text-secondary)', borderLeft: isActive ? '4px solid var(--accent-geo)' : '4px solid transparent', borderBottom: '1px solid var(--border-soft)' }}
                onClick={() => { setActiveEra(era.id); setActiveEventId(eraEvents[era.id]?.events?.[0]?.id ?? ''); closeMobile(); routerNavigate(`/atlas/${era.id}`); }}>
                <span>{era.label}</span>
                {isActive && <ChevronRight size={16} />}
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── Center: map + timeline ── */}
      <div className="geo-timeline-container" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

        <div className="map-view" ref={mapContainerRef}
          style={{ cursor: mapCursor, userSelect: 'none', position: 'relative', backgroundColor: mapStyle.water }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={handleMapClick}
        >
          <svg viewBox="0 0 1200 750" preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: '100%', display: 'block' }}>
            <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`} style={{ transformOrigin: '0 0' }}>
              <MapGeography
                activeEra={activeEra} routes={routes} mapStyle={mapStyle} geometry={mapGeometry}
                cmsEdit={isCmsMode && cmsEditMode && cmsTab === 'routes'}
                cmsActiveRouteId={activeRouteId}
                onDeleteWaypoint={deleteWaypoint}
              />

              {/* Event markers */}
              {eraData.events.map(event => {
                const isActive = event.id === activeEventId;
                return (
                  <g key={event.id} transform={`translate(${event.coords.x}, ${event.coords.y})`}
                    onClick={e => { e.stopPropagation(); setActiveEventId(event.id); focusOnCoords(event.coords); }} style={{ cursor: 'pointer' }}>
                    {isActive && <circle cx="0" cy="0" r="16" className="pulse-ring" />}
                    <circle cx="0" cy="0" r={isActive ? 8 : 6} fill={isActive ? 'var(--accent-gold)' : 'var(--accent-geo)'} stroke="white" strokeWidth={isActive ? 2.5 : 1.5} />
                    <text x={isActive ? 13 : 10} y={isActive ? -10 : -8} fontFamily="var(--font-sans)" fontWeight="700" fontSize={isActive ? '11px' : '10px'} fill={isActive ? 'var(--accent-gold)' : 'var(--text-primary)'} textAnchor="start"
                      style={{ textShadow: '1px 1px 0 white,-1px -1px 0 white,1px -1px 0 white,-1px 1px 0 white' }}>
                      {event.loc}
                    </text>
                  </g>
                );
              })}

              {/* ── Active polygon highlight ── */}
              {activePath && (() => {
                const d = activePath.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ') + ' Z';
                return <path d={d} fill="none" stroke="var(--accent-geo)" strokeWidth={2 / scale} strokeDasharray={`${6 / scale} ${3 / scale}`} opacity={0.8} />;
              })()}

              {/* ── In-progress polygon being drawn ── */}
              {drawingPolygon && drawingPolygon.points.length > 0 && (() => {
                const pts = drawingPolygon.points;
                const lineD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');
                const color = drawingPolygon.fill === 'water' ? '#4A90C8' : 'var(--accent-geo)';
                return (
                  <g>
                    {pts.length > 1 && <path d={lineD} fill="none" stroke={color} strokeWidth={2 / scale} strokeDasharray={`${5 / scale} ${3 / scale}`} opacity={0.9} />}
                    {pts.map((pt, i) => (
                      <g key={i}>
                        <circle cx={pt.x} cy={pt.y} r={5 / scale} fill="white" stroke={color} strokeWidth={1.5 / scale} />
                        <text x={pt.x} y={pt.y - 7 / scale} textAnchor="middle" fontSize={9 / scale} fill={color} fontFamily="var(--font-sans)" fontWeight="700">{i + 1}</text>
                      </g>
                    ))}
                  </g>
                );
              })()}

              {/* ── Vertex handles for active polygon ── */}
              {showVertices && activePath && activePath.points.map((pt, i) => (
                <circle
                  key={`vx-${i}`}
                  cx={pt.x} cy={pt.y}
                  r={5 / scale}
                  fill="rgba(255,255,255,0.95)"
                  stroke={activePath.fill === 'water' ? '#4A90C8' : 'var(--accent-geo)'}
                  strokeWidth={1.5 / scale}
                  style={{ cursor: 'move' }}
                  onMouseDown={e => {
                    e.stopPropagation();
                    draggingVertex.current = { pathId: activePath.id, ptIdx: i, startMx: e.clientX, startMy: e.clientY, startX: pt.x, startY: pt.y };
                  }}
                />
              ))}
              {/* Ellipse center handles (always shown in shape tab vertex mode regardless of active path) */}
              {isCmsMode && cmsEditMode && cmsTab === 'shape' && vertexEditMode && mapGeometry.ellipses.map(el => (
                <circle
                  key={`vx-el-${el.id}`}
                  cx={el.cx} cy={el.cy}
                  r={6 / scale}
                  fill="rgba(255,255,255,0.95)"
                  stroke="#4A90C8"
                  strokeWidth={1.5 / scale}
                  style={{ cursor: 'move' }}
                  onMouseDown={e => {
                    e.stopPropagation();
                    draggingVertex.current = { pathId: `__el__${el.id}`, ptIdx: 0, startMx: e.clientX, startMy: e.clientY, startX: el.cx, startY: el.cy };
                  }}
                />
              ))}
            </g>
          </svg>

          {/* Hints */}
          {addingWaypoint && (
            <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.62)', color: 'white', fontSize: '0.78rem', fontWeight: 600, padding: '5px 14px', borderRadius: 20, pointerEvents: 'none' }}>
              Click map to place waypoint · Esc to stop
            </div>
          )}
          {drawingPolygon && (
            <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.7)', color: 'white', fontSize: '0.78rem', fontWeight: 600, padding: '5px 14px', borderRadius: 20, pointerEvents: 'none', display: 'flex', gap: 10, alignItems: 'center' }}>
              <span>Click to place vertices ({drawingPolygon.points.length} placed)</span>
              {drawingPolygon.points.length >= 3 && <span style={{ opacity: 0.7 }}>· Click "Finish" in sidebar</span>}
              <span style={{ opacity: 0.55 }}>· Esc to cancel</span>
            </div>
          )}
          {showVertices && (
            <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.62)', color: 'white', fontSize: '0.78rem', fontWeight: 600, padding: '5px 14px', borderRadius: 20, pointerEvents: 'none' }}>
              Drag vertex handles to reshape · Esc to stop
            </div>
          )}

          {/* Map controls */}
          <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', flexDirection: 'column', gap: 4, zIndex: 10 }}>
            {[{ icon: <ZoomIn size={16} />, fn: () => zoomStep(1), title: 'Zoom in' }, { icon: <ZoomOut size={16} />, fn: () => zoomStep(-1), title: 'Zoom out' }, { icon: <RotateCcw size={16} />, fn: resetView, title: 'Reset view' }].map(({ icon, fn, title }) => (
              <button key={title} type="button" title={title} onClick={fn}
                style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-secondary)', boxShadow: 'var(--shadow-card)' }}>
                {icon}
              </button>
            ))}
          </div>
          {scale !== 1 && (
            <div style={{ position: 'absolute', bottom: 10, right: 12, fontSize: '0.75rem', color: 'var(--text-tertiary)', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-sm)', padding: '2px 8px', boxShadow: 'var(--shadow-card)', zIndex: 10 }}>
              {Math.round(scale * 100)}%
            </div>
          )}
        </div>

        {/* Timeline strip */}
        <div className="bottom-timeline">
          <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border-soft)', backgroundColor: 'var(--bg-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {isCmsMode && cmsEditMode ? (
              <div style={{ display: 'flex', gap: 10, flex: 1 }}>
                <input value={eraData.title} onChange={e => updateEraField('title', e.target.value)} style={{ ...inputStyle, flex: 1, fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '1rem' }} />
                <input value={eraData.timeframe} onChange={e => updateEraField('timeframe', e.target.value)} style={{ ...inputStyle, width: 160 }} />
              </div>
            ) : (
              <>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.1rem', fontWeight: 600 }}>{eraData.title}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{eraData.timeframe}</div>
              </>
            )}
          </div>
          <div style={{ flex: 1, position: 'relative', padding: '20px 40px', display: 'flex', alignItems: 'center' }}>
            {eraData.events.length > 0 ? (
              <>
                <div style={{ position: 'absolute', top: '50%', left: 40, right: 40, height: 4, backgroundColor: 'var(--bg-sidebar)', transform: 'translateY(-50%)', zIndex: 1, borderRadius: 2 }} />
                <div style={{ position: 'absolute', top: '50%', left: 40, width: `${((eraData.events.findIndex(e => e.id === activeEventId) || 0) / Math.max(eraData.events.length - 1, 1)) * 100}%`, height: 4, backgroundColor: 'var(--accent-gold)', transform: 'translateY(-50%)', zIndex: 1, borderRadius: 2, transition: 'width 0.3s ease' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', position: 'relative', zIndex: 2 }}>
                  {eraData.events.map((event, index) => {
                    const isActive = event.id === activeEventId;
                    const isPast = eraData.events.findIndex(e => e.id === activeEventId) >= index;
                    return (
                      <button key={event.id} type="button" onClick={() => { setActiveEventId(event.id); focusOnCoords(event.coords); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: 8, fontWeight: 600 }}>{event.date}</div>
                        <div style={{ width: 16, height: 16, borderRadius: '50%', border: `3px solid ${isActive || isPast ? 'var(--accent-gold)' : 'var(--text-tertiary)'}`, backgroundColor: isActive ? 'var(--accent-gold)' : 'var(--bg-surface)', boxShadow: isActive ? '0 0 0 4px var(--accent-gold-light)' : 'none', transform: isActive ? 'scale(1.2)' : 'none', transition: 'all 0.2s' }} />
                        <div style={{ marginTop: 12, fontSize: '0.85rem', fontWeight: 700, color: isActive ? 'var(--accent-gold)' : 'var(--text-secondary)', textAlign: 'center', maxWidth: 120 }}>{event.title}</div>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div style={{ width: '100%', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.9rem', fontStyle: 'italic' }}>
                {isCmsMode && cmsEditMode ? 'No events yet — use "Add Event" to create one.' : 'Historical data for this era is currently being compiled.'}
              </div>
            )}
          </div>
          {isCmsMode && cmsEditMode && cmsTab === 'event' && (
            <div style={{ padding: '8px 24px 12px', borderTop: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'center' }}>
              <button type="button" onClick={addEvent} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px', borderRadius: 20, border: '1px dashed var(--accent-geo)', background: 'transparent', cursor: 'pointer', color: 'var(--accent-geo)', fontSize: '0.82rem', fontWeight: 600 }}>
                <Plus size={13} /> Add Event to this Era
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Right sidebar ── */}
      <aside className={`right-sidebar${mobileSidebar === 'right' ? ' mobile-open' : ''}`} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="sidebar-close-row mobile-only">
          <button className="sidebar-close-btn" onClick={closeMobile}><X size={16} /> Close</button>
        </div>

        {/* CMS tab strip */}
        {isCmsMode && cmsEditMode && (
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-soft)', background: 'var(--bg-subtle)', flexShrink: 0 }}>
            {([
              ['event',  <BookOpen size={10} />],
              ['routes', <Route    size={10} />],
              ['map',    <Palette  size={10} />],
              ['shape',  <Move     size={10} />],
            ] as [CmsTab, React.ReactNode][]).map(([tab, icon]) => (
              <button key={tab} type="button" onClick={() => switchCmsTab(tab)}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '7px 2px', background: cmsTab === tab ? 'var(--bg-surface)' : 'transparent', border: 'none', borderBottom: cmsTab === tab ? '2px solid var(--accent-geo)' : '2px solid transparent', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 700, color: cmsTab === tab ? 'var(--accent-geo)' : 'var(--text-tertiary)', textTransform: 'capitalize' }}>
                {icon} {tab}
              </button>
            ))}
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {isCmsMode && cmsEditMode ? (
            <>
              {/* ── Event tab ── */}
              {cmsTab === 'event' && (
                activeEvent ? (
                  <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--accent-geo)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Edit Event</span>
                      <button type="button" onClick={deleteActiveEvent} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 8, border: 'none', background: 'var(--bg-sidebar)', color: '#d44', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                        <Trash2 size={11} /> Delete
                      </button>
                    </div>
                    <label style={labelStyle}><span style={labelTextStyle}>Title</span><input style={inputStyle} value={activeEvent.title} onChange={e => updateActiveEventField('title', e.target.value)} /></label>
                    <label style={labelStyle}><span style={labelTextStyle}>Date</span><input style={inputStyle} value={activeEvent.date} onChange={e => updateActiveEventField('date', e.target.value)} /></label>
                    <label style={labelStyle}><span style={labelTextStyle}>Location</span><input style={inputStyle} value={activeEvent.loc} onChange={e => updateActiveEventField('loc', e.target.value)} /></label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <label style={{ ...labelStyle, flex: 1 }}><span style={labelTextStyle}>Map X</span><input style={inputStyle} type="number" value={activeEvent.coords.x} onChange={e => updateActiveEventField('coords.x', e.target.value)} /></label>
                      <label style={{ ...labelStyle, flex: 1 }}><span style={labelTextStyle}>Map Y</span><input style={inputStyle} type="number" value={activeEvent.coords.y} onChange={e => updateActiveEventField('coords.y', e.target.value)} /></label>
                    </div>
                    <label style={labelStyle}><span style={labelTextStyle}>Description</span><textarea value={activeEvent.desc} onChange={e => updateActiveEventField('desc', e.target.value)} rows={4} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} /></label>
                    <label style={labelStyle}><span style={labelTextStyle}>Scripture</span><input style={inputStyle} value={activeEvent.scripture} onChange={e => updateActiveEventField('scripture', e.target.value)} /></label>
                    <label style={labelStyle}><span style={labelTextStyle}>Theme</span><input style={inputStyle} value={activeEvent.theme} onChange={e => updateActiveEventField('theme', e.target.value)} /></label>
                  </div>
                ) : (
                  <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.88rem' }}>
                    <div style={{ marginBottom: 12 }}>No events in this era.</div>
                    <button type="button" onClick={addEvent} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 20, border: '1px dashed var(--accent-geo)', background: 'transparent', cursor: 'pointer', color: 'var(--accent-geo)', fontSize: '0.82rem', fontWeight: 600 }}>
                      <Plus size={13} /> Add First Event
                    </button>
                  </div>
                )
              )}

              {/* ── Routes tab ── */}
              {cmsTab === 'routes' && (
                <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <select value={activeRouteId} onChange={e => setActiveRouteId(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                      {routes.length === 0 && <option value="">No routes</option>}
                      {routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                    <button type="button" onClick={addRoute} style={{ flexShrink: 0, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: '1px dashed var(--accent-geo)', background: 'transparent', cursor: 'pointer', color: 'var(--accent-geo)' }}><Plus size={14} /></button>
                    {activeRoute && <button type="button" onClick={() => deleteRoute(activeRouteId)} style={{ flexShrink: 0, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: 'none', background: 'var(--bg-sidebar)', cursor: 'pointer', color: '#d44' }}><Trash2 size={13} /></button>}
                  </div>

                  {activeRoute ? (
                    <>
                      <label style={labelStyle}><span style={labelTextStyle}>Name</span><input style={inputStyle} value={activeRoute.name} onChange={e => updateRoute(activeRouteId, { name: e.target.value })} /></label>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                        <label style={{ ...labelStyle, flex: 1 }}>
                          <span style={labelTextStyle}>Color</span>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input type="color" value={activeRoute.color.startsWith('#') ? activeRoute.color : '#D4A373'} onChange={e => updateRoute(activeRouteId, { color: e.target.value })} style={{ width: 34, height: 28, border: '1px solid var(--border-soft)', borderRadius: 6, padding: 2, cursor: 'pointer' }} />
                            <input style={{ ...inputStyle, flex: 1 }} value={activeRoute.color} onChange={e => updateRoute(activeRouteId, { color: e.target.value })} />
                          </div>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer', paddingBottom: 3 }}>
                          <input type="checkbox" checked={activeRoute.dash} onChange={e => updateRoute(activeRouteId, { dash: e.target.checked })} /> Dashed
                        </label>
                      </div>

                      <div>
                        <span style={labelTextStyle}>Show in eras</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 8px', marginTop: 6 }}>
                          {eras.map(era => (
                            <label key={era.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                              <input type="checkbox" checked={activeRoute.visibleEras.includes(era.id)} onChange={() => toggleEraForRoute(activeRouteId, era.id)} /> {era.label}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={labelTextStyle}>Waypoints ({activeRoute.waypoints.length})</span>
                          <button type="button" onClick={() => setAddingWaypoint(m => !m)}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 14, border: addingWaypoint ? 'none' : '1px dashed var(--accent-geo)', background: addingWaypoint ? 'var(--accent-geo)' : 'transparent', color: addingWaypoint ? 'white' : 'var(--accent-geo)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>
                            <Plus size={11} /> {addingWaypoint ? 'Stop adding' : 'Add by click'}
                          </button>
                        </div>
                        {activeRoute.waypoints.length === 0 ? (
                          <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.8rem', fontStyle: 'italic', padding: '10px 0' }}>No waypoints — click "Add by click" then click the map</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {activeRoute.waypoints.map((wp, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 6, background: 'var(--bg-subtle)', border: '1px solid var(--border-soft)' }}>
                                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-tertiary)', minWidth: 16, textAlign: 'center' }}>{i + 1}</span>
                                <input type="number" value={wp.x} onChange={e => updateRoute(activeRouteId, { waypoints: activeRoute.waypoints.map((w, j) => j === i ? { ...w, x: Number(e.target.value) } : w) })} style={{ ...inputStyle, width: 60 }} />
                                <input type="number" value={wp.y} onChange={e => updateRoute(activeRouteId, { waypoints: activeRoute.waypoints.map((w, j) => j === i ? { ...w, y: Number(e.target.value) } : w) })} style={{ ...inputStyle, width: 60 }} />
                                <button type="button" onClick={() => deleteWaypoint(activeRouteId, i)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 2, display: 'flex', borderRadius: 4 }}><Trash2 size={12} /></button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.85rem', fontStyle: 'italic' }}>No routes yet. Click + to add one.</div>
                  )}
                </div>
              )}

              {/* ── Map Style tab ── */}
              {cmsTab === 'map' && (
                <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--accent-geo)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Map Appearance</span>
                  <div>
                    <span style={labelTextStyle}>Presets</span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
                      {MAP_PRESETS.map(preset => {
                        const isActive = preset.water === mapStyle.water && preset.land === mapStyle.land;
                        return (
                          <button key={preset.name} type="button" onClick={() => setMapStyle({ water: preset.water, land: preset.land, border: preset.border })}
                            style={{ border: `2px solid ${isActive ? 'var(--accent-geo)' : 'var(--border-soft)'}`, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', background: 'none', padding: 0, display: 'flex', flexDirection: 'column' }}>
                            <div style={{ height: 32, display: 'flex' }}>
                              <div style={{ flex: 1, background: preset.water }} />
                              <div style={{ flex: 1, background: preset.land, borderLeft: `2px solid ${preset.border}` }} />
                            </div>
                            <div style={{ padding: '3px 6px', fontSize: '0.72rem', fontWeight: 600, color: isActive ? 'var(--accent-geo)' : 'var(--text-secondary)', background: 'var(--bg-surface)', textAlign: 'center' }}>{preset.name}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {([['water', 'Water / Sea'], ['land', 'Land'], ['border', 'Land Border']] as [keyof MapStyle, string][]).map(([key, lbl]) => (
                    <label key={key} style={labelStyle}>
                      <span style={labelTextStyle}>{lbl}</span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input type="color" value={mapStyle[key]} onChange={e => setMapStyle(prev => ({ ...prev, [key]: e.target.value }))} style={{ width: 36, height: 28, border: '1px solid var(--border-soft)', borderRadius: 6, padding: 2, cursor: 'pointer', flexShrink: 0 }} />
                        <input type="text" value={mapStyle[key]} onChange={e => setMapStyle(prev => ({ ...prev, [key]: e.target.value }))} style={{ ...inputStyle, flex: 1 }} />
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {/* ── Shape tab ── */}
              {cmsTab === 'shape' && (
                <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--accent-geo)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Geography Shape Editor</span>

                  {/* ── Drawing mode ── */}
                  {drawingPolygon ? (
                    <div style={{ padding: 12, borderRadius: 10, border: '2px solid var(--accent-geo)', background: 'var(--bg-geo-light)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-geo)' }}>Drawing New Polygon</div>
                      <label style={labelStyle}>
                        <span style={labelTextStyle}>Name</span>
                        <input style={inputStyle} value={drawingPolygon.name} onChange={e => setDrawingPolygon(prev => prev ? { ...prev, name: e.target.value } : null)} placeholder="e.g. Aegean Islands" />
                      </label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {(['land', 'water'] as const).map(f => (
                          <button key={f} type="button" onClick={() => setDrawingPolygon(prev => prev ? { ...prev, fill: f } : null)}
                            style={{ flex: 1, padding: '5px 0', borderRadius: 7, border: `1px solid ${drawingPolygon.fill === f ? (f === 'water' ? '#4A90C8' : 'var(--accent-geo)') : 'var(--border-soft)'}`, background: drawingPolygon.fill === f ? (f === 'water' ? '#4A90C8' : 'var(--accent-geo)') : 'var(--bg-surface)', color: drawingPolygon.fill === f ? 'white' : 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
                            {f}
                          </button>
                        ))}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{drawingPolygon.points.length} vertices placed — click the map to add more.</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button type="button" onClick={commitDrawing} disabled={drawingPolygon.points.length < 3}
                          style={{ flex: 1, padding: '6px 0', borderRadius: 8, border: 'none', background: drawingPolygon.points.length >= 3 ? 'var(--accent-geo)' : 'var(--bg-sidebar)', color: drawingPolygon.points.length >= 3 ? 'white' : 'var(--text-tertiary)', fontWeight: 700, fontSize: '0.8rem', cursor: drawingPolygon.points.length >= 3 ? 'pointer' : 'default' }}>
                          Finish Polygon
                        </button>
                        <button type="button" onClick={() => setDrawingPolygon(prev => prev && prev.points.length > 0 ? { ...prev, points: prev.points.slice(0, -1) } : prev)}
                          disabled={drawingPolygon.points.length === 0}
                          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-soft)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', fontSize: '0.78rem', cursor: 'pointer' }}>
                          Undo
                        </button>
                        <button type="button" onClick={() => setDrawingPolygon(null)}
                          style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: 'var(--bg-sidebar)', color: '#c55', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ── Normal shape editing UI ── */
                    <>
                      {/* Polygon list */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={labelTextStyle}>Map Polygons</span>
                          <button type="button"
                            onClick={() => setDrawingPolygon({ name: 'New Polygon', fill: 'land', points: [] })}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 12, border: '1px dashed var(--accent-geo)', background: 'transparent', color: 'var(--accent-geo)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>
                            <Plus size={10} /> New Polygon
                          </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 220, overflowY: 'auto' }}>
                          {mapGeometry.paths.map(path => {
                            const isSelected = path.id === activePathId;
                            return (
                              <button key={path.id} type="button"
                                onClick={() => {
                                  setActivePathId(path.id);
                                  setVertexEditMode(true);
                                  focusOnPath(path);
                                }}
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderRadius: 6, border: `1px solid ${isSelected ? 'var(--accent-geo)' : 'transparent'}`, background: isSelected ? 'var(--bg-geo-light)' : 'var(--bg-subtle)', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: path.fill === 'water' ? '#4A90C8' : 'var(--accent-geo)', flexShrink: 0 }} />
                                  <span style={{ fontSize: '0.78rem', color: isSelected ? 'var(--accent-geo)' : 'var(--text-primary)', fontWeight: isSelected ? 700 : 500 }}>{path.label}</span>
                                </div>
                                <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', flexShrink: 0 }}>{path.points.length} pts</span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Selected polygon controls */}
                        {activePath && (
                          <div style={{ marginTop: 8, padding: 10, borderRadius: 8, border: '1px solid var(--accent-geo)', background: 'var(--bg-geo-light)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent-geo)', textTransform: 'uppercase' }}>Selected Polygon</span>
                              <button type="button" onClick={() => deletePath(activePath.id)}
                                style={{ display: 'flex', alignItems: 'center', gap: 4, border: 'none', background: 'none', color: '#c55', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}>
                                <Trash2 size={11} /> Delete
                              </button>
                            </div>
                            <label style={labelStyle}>
                              <span style={labelTextStyle}>Label</span>
                              <input style={inputStyle} value={activePath.label} onChange={e => updatePath(activePath.id, { label: e.target.value })} />
                            </label>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {(['land', 'water'] as const).map(f => (
                                <button key={f} type="button" onClick={() => updatePath(activePath.id, { fill: f })}
                                  style={{ flex: 1, padding: '5px 0', borderRadius: 7, border: `1px solid ${activePath.fill === f ? (f === 'water' ? '#4A90C8' : 'var(--accent-geo)') : 'var(--border-soft)'}`, background: activePath.fill === f ? (f === 'water' ? '#4A90C8' : 'var(--accent-geo)') : 'var(--bg-surface)', color: activePath.fill === f ? 'white' : 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
                                  {f}
                                </button>
                              ))}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Vertex editing</span>
                              <button type="button" onClick={() => setVertexEditMode(m => !m)}
                                style={{ padding: '3px 12px', borderRadius: 12, border: 'none', cursor: 'pointer', background: vertexEditMode ? 'var(--accent-geo)' : 'var(--bg-sidebar)', color: vertexEditMode ? 'white' : 'var(--text-secondary)', fontWeight: 700, fontSize: '0.75rem' }}>
                                {vertexEditMode ? 'ON' : 'OFF'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* New polygon quick-start name/fill form */}

                      {/* Small water bodies */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={labelTextStyle}>Small Water Bodies</span>
                          <button type="button" onClick={addEllipse}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 12, border: '1px dashed #4A90C8', background: 'transparent', color: '#4A90C8', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>
                            <Plus size={10} /> Add
                          </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {mapGeometry.ellipses.map(el => (
                            <div key={el.id} style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border-soft)', background: 'var(--bg-subtle)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <input value={el.label} onChange={e => setMapGeometry(prev => ({ ...prev, ellipses: prev.ellipses.map(x => x.id !== el.id ? x : { ...x, label: e.target.value }) }))}
                                  style={{ ...inputStyle, fontWeight: 700, fontSize: '0.78rem' }} />
                                <button type="button" onClick={() => deleteEllipse(el.id)}
                                  style={{ border: 'none', background: 'none', color: '#c55', cursor: 'pointer', padding: '0 0 0 6px', flexShrink: 0 }}><Trash2 size={12} /></button>
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                                {(['cx', 'cy', 'rx', 'ry'] as const).map(field => (
                                  <label key={field} style={labelStyle}>
                                    <span style={labelTextStyle}>{field}</span>
                                    <input type="number" value={el[field]} onChange={e => updateEllipse(el.id, field, Number(e.target.value))} style={{ ...inputStyle, padding: '4px 6px' }} />
                                  </label>
                                ))}
                              </div>
                            </div>
                          ))}
                          {mapGeometry.ellipses.length === 0 && (
                            <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.8rem', fontStyle: 'italic', padding: '8px 0' }}>No small water bodies. Click Add to create one.</div>
                          )}
                        </div>
                      </div>

                      {/* Reset */}
                      <button type="button" onClick={() => { setMapGeometry(DEFAULT_MAP_GEOMETRY); setActivePathId(null); setVertexEditMode(false); }}
                        style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #c55', background: 'transparent', color: '#c55', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', marginTop: 4 }}>
                        Reset geometry to defaults
                      </button>
                    </>
                  )}
                </div>
              )}
            </>
          ) : (
            /* ── Normal read view ── */
            activeEvent ? (
              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
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
                {activeEvent.scripture && (() => {
                  const parsed = parseScriptureRef(activeEvent.scripture);
                  const to = parsed ? `/reader/${parsed.bookId}/${parsed.chapter}` : undefined;
                  return (
                    <ReferenceCard
                      variant="scripture"
                      title={activeEvent.scripture}
                      subtitle={activeEvent.theme || undefined}
                      excerpt={activeEvent.desc}
                      to={to}
                    />
                  );
                })()}
              </div>
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontStyle: 'italic', fontSize: '0.95rem' }}>
                Select an era with compiled events to explore its historical and theological insights.
              </div>
            )
          )}
        </div>
      </aside>
    </div>

    {/* CMS floating toolbar */}
    {isCmsMode && (
      <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 1000, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-surface)', border: '1px solid var(--border-soft)', borderRadius: 24, padding: '8px 14px', boxShadow: '0 4px 20px rgba(0,0,0,0.14)' }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>CMS</span>
        <button type="button" onClick={() => setCmsEditMode(m => !m)}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 16, border: 'none', cursor: 'pointer', background: cmsEditMode ? 'var(--accent-geo)' : 'var(--bg-sidebar)', color: cmsEditMode ? 'white' : 'var(--text-secondary)', fontWeight: 600, fontSize: '0.82rem' }}>
          <Pencil size={12} /> {cmsEditMode ? 'Editing' : 'Edit'}
        </button>
        {cmsEditMode && (
          <>
            {cmsSaveMsg && <span style={{ fontSize: '0.78rem', fontWeight: 600, color: cmsSaveMsg === 'Saved!' ? 'green' : '#c00' }}>{cmsSaveMsg}</span>}
            <button type="button" onClick={saveToDisk} disabled={cmsSaving}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 16, border: 'none', cursor: cmsSaving ? 'default' : 'pointer', background: 'var(--accent-exe)', color: 'white', fontWeight: 600, fontSize: '0.82rem', opacity: cmsSaving ? 0.7 : 1 }}>
              <Save size={12} /> {cmsSaving ? 'Saving…' : 'Save'}
            </button>
          </>
        )}
      </div>
    )}
    </>
  );
}
