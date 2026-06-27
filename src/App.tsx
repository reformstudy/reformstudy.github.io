import { useState, useEffect } from 'react';
import { Search, BookOpen, Map as MapIcon, Library, Scale, Clock, AlertCircle } from 'lucide-react';
import AtlasAndTimeline from './components/AtlasAndTimeline';
import GlobalSearch from './components/GlobalSearch';
import ScriptureReader from './components/ScriptureReader';
import GenericView from './components/GenericView';
import ContentEditor from './components/ContentEditor';
import TheologyExplorer from './components/TheologyExplorer';
import ConfessionalArchive from './components/ConfessionalArchive';
import { ResourceProvider, useResources } from './context/ResourceContext';

const navItems = [
  { id: 'search', label: 'Global Search', icon: <Search size={16} /> },
  { id: 'reader', label: 'Scripture Reader', icon: <BookOpen size={16} /> },
  { id: 'atlas', label: 'Atlas & Timeline', icon: <MapIcon size={16} /> },
  { id: 'archive', label: 'Confessional Archive', icon: <Library size={16} /> },
  { id: 'theology', label: 'Theology Explorer', icon: <Scale size={16} /> },
  { id: 'admin', label: 'Content Editor', icon: <Clock size={16} /> }
];

function AppContent() {
  const [activeModule, setActiveModule] = useState('reader');
  const { isLoading, error, ensureResourceLoaded } = useResources();

  // Pre-load default resources when app initializes
  useEffect(() => {
    ensureResourceLoaded('kjv');
    ensureResourceLoaded('wcf');
  }, [ensureResourceLoaded]);

  const renderWorkspace = () => {
    if (isLoading) {
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

    if (error) {
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
                fontWeight: 600
              }}
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    switch (activeModule) {
      case 'search':
        return <GlobalSearch />;
      case 'reader':
        return <ScriptureReader />;
      case 'atlas':
        return <AtlasAndTimeline />;
      case 'archive':
        return <ConfessionalArchive />;
      case 'theology':
        return <TheologyExplorer />;
      case 'admin':
        return <ContentEditor />;
      default:
        return <ScriptureReader />;
    }
  };

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
            onClick={() => setActiveModule(item.id)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {renderWorkspace()}
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
