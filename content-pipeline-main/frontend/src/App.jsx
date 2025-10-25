import { useState } from 'react';
import { Download, Film, Volume2, ChevronRight, Type, Image, Calendar, RefreshCw } from 'lucide-react';
import InstagramDownloader from './pages/InstagramDownloader';
import VideoEditor from './pages/VideoEditor';
import AudioGenerator from './pages/AudioGenerator';
import SubtitleGenerator from './pages/SubtitleGenerator';
import WatermarkApplier from './pages/WatermarkApplier';
import SocialScheduler from './pages/SocialScheduler';
import AutomationPipeline from './pages/AutomationPipeline';
import './index.css';

const NAV_ITEMS = [
  { id: 'pipeline', label: 'Automation Pipeline', icon: RefreshCw },
  { id: 'downloader', label: 'Media Downloader', icon: Download },
  { id: 'video-editor', label: 'Video Editor', icon: Film },
  { id: 'audio-generator', label: 'Audio Generator', icon: Volume2 },
  { id: 'subtitles', label: 'Subtitle Generator', icon: Type },
  { id: 'watermark', label: 'Watermark Applier', icon: Image },
  { id: 'scheduler', label: 'Social Scheduler', icon: Calendar },
];

function App() {
  const [activePage, setActivePage] = useState('pipeline');

  const renderPage = () => {
    switch (activePage) {
      case 'pipeline':
        return <AutomationPipeline />;
      case 'downloader':
        return <InstagramDownloader />;
      case 'video-editor':
        return <VideoEditor />;
      case 'audio-generator':
        return <AudioGenerator />;
      case 'subtitles':
        return <SubtitleGenerator />;
      case 'watermark':
        return <WatermarkApplier />;
      case 'scheduler':
        return <SocialScheduler />;
      default:
        return <AutomationPipeline />;
    }
  };

  return (
    <div className="layout">
      {/* ── Sidebar ───────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon">⚡</div>
          <div>
            <h2 className="brand-title">InstaFlow</h2>
            <span className="brand-subtitle">Content Pipeline</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-label">Features</div>
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`nav-item ${activePage === item.id ? 'active' : ''}`}
              onClick={() => setActivePage(item.id)}
            >
              <item.icon size={20} className="nav-icon" />
              <span className="nav-text">{item.label}</span>
              <ChevronRight size={16} className="nav-arrow" />
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span>v1.0.0 — Built with ❤️</span>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────── */}
      <main className="main-content">
        {renderPage()}
      </main>
    </div>
  );
}

export default App;
