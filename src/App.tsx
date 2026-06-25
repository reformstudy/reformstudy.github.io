import { useState } from 'react';
import { Search, BookOpen, Map as MapIcon, Library, Scale, Clock } from 'lucide-react';
import AtlasAndTimeline from './components/AtlasAndTimeline';
import GlobalSearch from './components/GlobalSearch';
import ScriptureReader from './components/ScriptureReader';
import GenericView from './components/GenericView';

const navItems = [
  { id: 'search', label: 'Global Search', icon: <Search size={16} /> },
  { id: 'reader', label: 'Scripture Reader', icon: <BookOpen size={16} /> },
  { id: 'atlas', label: 'Atlas & Timeline', icon: <MapIcon size={16} /> },
  { id: 'archive', label: 'Confessional Archive', icon: <Library size={16} /> },
  { id: 'theology', label: 'Theology Explorer', icon: <Scale size={16} /> }
];

export default function App() {
  const [activeModule, setActiveModule] = useState('atlas');

  const renderWorkspace = () => {
    switch (activeModule) {
      case 'search':
        return <GlobalSearch />;
      case 'reader':
        return <ScriptureReader />;
      case 'atlas':
        return <AtlasAndTimeline />;
      case 'archive':
        return <GenericView title="Confessional Archive" />;
      case 'theology':
        return <GenericView title="Theology Explorer" />;
      default:
        return <AtlasAndTimeline />;
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
