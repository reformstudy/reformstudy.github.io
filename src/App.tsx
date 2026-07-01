import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Search, BookOpen, Map as MapIcon, Library, Scale, AlertCircle } from 'lucide-react';
import AtlasAndTimeline from './components/AtlasAndTimeline';
import GlobalSearch from './components/GlobalSearch';
import ScriptureReader from './components/ScriptureReader';
import TheologyExplorer from './components/TheologyExplorer';
import ConfessionalArchive from './components/ConfessionalArchive';
import { ResourceProvider, useResources } from './context/ResourceContext';

const navItems = [
  { id: 'search',   label: 'Global Search',       icon: <Search size={16} />,   path: '/search' },
  { id: 'reader',   label: 'Scripture Reader',     icon: <BookOpen size={16} />, path: '/reader' },
  { id: 'atlas',    label: 'Atlas & Timeline',     icon: <MapIcon size={16} />,  path: '/atlas' },
  { id: 'archive',  label: 'Confessional Archive', icon: <Library size={16} />,  path: '/archive' },
  { id: 'theology', label: 'Theology Explorer',    icon: <Scale size={16} />,    path: '/theology' },
];

function LoadingState() {
  return (
    <div className="workspace" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '600px' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 16 }}>
          Loading resources...
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
          Initializing Bible, confessions, and study materials
        </div>
      </div>
    </div>
  );
}

function ErrorState({ error }: { error: Error }) {
  return (
    <div className="workspace" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '600px' }}>
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <AlertCircle size={32} color="var(--accent-exe)" />
        <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          Failed to Load Resources
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: 400 }}>
          {error.message}
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            marginTop: 12,
            padding: '8px 16px',
            borderRadius: 8,
            backgroundColor: 'var(--accent-exe)',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Retry
        </button>
      </div>
    </div>
  );
}

function AppContent() {
  const { isLoading, error, ensureResourceLoaded } = useResources();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    ensureResourceLoaded('kjv');
    ensureResourceLoaded('wcf');
  }, [ensureResourceLoaded]);

  const activeModule = location.pathname.split('/')[1] || 'reader';

  return (
    <div className="app-shell">
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="brand-mark">
            <BookOpen size={20} />
          </div>
          <div className="brand-title">ReformStudy</div>
        </div>

        <div className="search-bar">
          <Search size={18} color="var(--text-tertiary)" />
          <input type="text" placeholder="Search scriptures, keywords, or references..." />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span className="user-label">My Study</span>
          <div className="user-avatar">JB</div>
        </div>
      </header>

      <div className="sub-nav">
        {navItems.map(item => (
          <button
            key={item.id}
            type="button"
            className={`nav-pill ${activeModule === item.id ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            {item.icon}
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </div>

      {isLoading ? <LoadingState /> : error ? <ErrorState error={error} /> : (
        <Routes>
          <Route path="/" element={<Navigate to="/reader" replace />} />
          <Route path="/search" element={<GlobalSearch />} />
          <Route path="/reader" element={<ScriptureReader />} />
          <Route path="/reader/:book/:chapter" element={<ScriptureReader />} />
          <Route path="/atlas" element={<AtlasAndTimeline />} />
          <Route path="/atlas/:eraId" element={<AtlasAndTimeline />} />
          <Route path="/theology" element={<TheologyExplorer />} />
          <Route path="/theology/doctrine/:id" element={<TheologyExplorer />} />
          <Route path="/theology/heresy/:id" element={<TheologyExplorer />} />
          <Route path="/archive" element={<ConfessionalArchive />} />
          <Route path="/archive/:confessionId/:chapter" element={<ConfessionalArchive />} />
          <Route path="*" element={<Navigate to="/reader" replace />} />
        </Routes>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ResourceProvider>
      <AppContent />
    </ResourceProvider>
  );
}
