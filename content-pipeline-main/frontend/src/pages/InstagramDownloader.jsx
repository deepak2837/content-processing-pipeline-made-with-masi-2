import { useState, useEffect } from 'react';
import {
  Download, Hash, Folder, FileVideo, Image as ImageIcon,
  FileText, Calendar, Activity, Tag, Play, Camera,
  Link, Film, Captions, Info, ChevronDown
} from 'lucide-react';

const PLATFORM_TABS = [
  { id: 'instagram', label: 'Instagram', icon: Camera, accent: '#E1306C' },
  { id: 'youtube',   label: 'YouTube Shorts', icon: Play,   accent: '#FF0000' },
];

function InstagramDownloader() {
  const [activeTab, setActiveTab] = useState('instagram');

  // ── Instagram form state ──────────────────────────────────
  const [instaForm, setInstaForm] = useState({
    handle: '',
    download_path: '',
    download_reels: true,
    download_posts: true,
    download_metadata: true,
    download_captions: false,
    date_from: '',
    date_to: '',
    last_upload_only: false
  });

  // ── YouTube form state ────────────────────────────────────
  const [ytForm, setYtForm] = useState({
    source_url: '',
    download_path: '',
    max_videos: 5,
    download_captions: true,
    download_description: true,
    download_metadata: true,
  });

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);

  // ── Poll jobs ─────────────────────────────────────────────
  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/downloads');
        if (res.ok) {
          const data = await res.json();
          setJobs(data.reverse());
        }
      } catch (err) {
        console.error("Failed to fetch jobs");
      }
    };

    fetchJobs();
    const interval = setInterval(fetchJobs, 2000);
    return () => clearInterval(interval);
  }, []);

  // ── Handlers ──────────────────────────────────────────────
  const handleInstaChange = (e) => {
    const { name, value, type, checked } = e.target;
    setInstaForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleYtChange = (e) => {
    const { name, value, type, checked } = e.target;
    setYtForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (type === 'number' ? parseInt(value, 10) || 0 : value)
    }));
  };

  // ── Instagram submit ──────────────────────────────────────
  const handleInstaSubmit = async (e) => {
    e.preventDefault();
    if (!instaForm.handle || !instaForm.download_path) return;

    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...instaForm,
          date_from: instaForm.date_from || null,
          date_to: instaForm.date_to || null
        })
      });

      if (!res.ok) {
        const error = await res.json();
        alert(error.detail || "Failed to start download");
      } else {
        setInstaForm(prev => ({ ...prev, handle: '' }));
      }
    } catch (err) {
      alert("Error connecting to backend");
    } finally {
      setLoading(false);
    }
  };

  // ── YouTube submit ────────────────────────────────────────
  const handleYtSubmit = async (e) => {
    e.preventDefault();
    if (!ytForm.source_url || !ytForm.download_path) return;

    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/youtube/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ytForm)
      });

      if (!res.ok) {
        const error = await res.json();
        alert(error.detail || "Failed to start download");
      } else {
        setYtForm(prev => ({ ...prev, source_url: '' }));
      }
    } catch (err) {
      alert("Error connecting to backend");
    } finally {
      setLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Media Downloader</h1>
        <p>Download content from Instagram and YouTube Shorts</p>
      </div>

      {/* ── Platform Tabs ─────────────────────────────────── */}
      <div className="downloader-tabs">
        {PLATFORM_TABS.map(tab => (
          <button
            key={tab.id}
            className={`downloader-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            style={{
              '--tab-accent': tab.accent,
            }}
          >
            <tab.icon size={20} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── Instagram Form ────────────────────────────────── */}
      {activeTab === 'instagram' && (
        <div className="glass-panel" style={{ animation: 'fadeIn 0.4s ease-out' }}>
          <form onSubmit={handleInstaSubmit} className="form-grid">
            <div className="input-group">
              <label><Hash size={16} style={{display:'inline', marginBottom:'-3px', marginRight:'5px'}}/> Instagram Handle or URL</label>
              <input
                type="text"
                name="handle"
                className="input-field"
                placeholder="e.g. medical_facts_official_ or full URL"
                value={instaForm.handle}
                onChange={handleInstaChange}
                required
              />
            </div>

            <div className="input-group">
              <label><Folder size={16} style={{display:'inline', marginBottom:'-3px', marginRight:'5px'}}/> Download Path (Absolute)</label>
              <input
                type="text"
                name="download_path"
                className="input-field"
                placeholder="/Users/username/Downloads/insta"
                value={instaForm.download_path}
                onChange={handleInstaChange}
                required
              />
            </div>

            <div className="input-group">
              <label><Calendar size={16} style={{display:'inline', marginBottom:'-3px', marginRight:'5px'}}/> From Date (Optional)</label>
              <input
                type="date"
                name="date_from"
                className="input-field"
                value={instaForm.date_from}
                onChange={handleInstaChange}
              />
            </div>

            <div className="input-group">
              <label><Calendar size={16} style={{display:'inline', marginBottom:'-3px', marginRight:'5px'}}/> To Date (Optional)</label>
              <input
                type="date"
                name="date_to"
                className="input-field"
                value={instaForm.date_to}
                onChange={handleInstaChange}
              />
            </div>

            <div className="input-group" style={{gridColumn: '1 / -1', display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '1.5rem', marginTop: '1rem'}}>
              <label className="checkbox-group">
                <input type="checkbox" name="download_reels" checked={instaForm.download_reels} onChange={handleInstaChange} />
                <span><FileVideo size={16} style={{display:'inline', marginBottom:'-3px'}}/> Reels</span>
              </label>

              <label className="checkbox-group">
                <input type="checkbox" name="download_posts" checked={instaForm.download_posts} onChange={handleInstaChange} />
                <span><ImageIcon size={16} style={{display:'inline', marginBottom:'-3px'}}/> Posts</span>
              </label>

              <label className="checkbox-group">
                <input type="checkbox" name="download_metadata" checked={instaForm.download_metadata} onChange={handleInstaChange} />
                <span><FileText size={16} style={{display:'inline', marginBottom:'-3px'}}/> Thumbnails</span>
              </label>

              <label className="checkbox-group">
                <input type="checkbox" name="last_upload_only" checked={instaForm.last_upload_only} onChange={handleInstaChange} />
                <span><Activity size={16} style={{display:'inline', marginBottom:'-3px'}}/> Last Upload Only</span>
              </label>

              <label className="checkbox-group">
                <input type="checkbox" name="download_captions" checked={instaForm.download_captions} onChange={handleInstaChange} />
                <span><Tag size={16} style={{display:'inline', marginBottom:'-3px'}}/> Captions & Tags</span>
              </label>
            </div>

            <div style={{gridColumn: '1 / -1'}}>
              <button type="submit" className="btn-primary" disabled={loading || !instaForm.handle || !instaForm.download_path}>
                <Download size={20} style={{display:'inline', marginBottom:'-4px', marginRight:'8px'}}/>
                {loading ? 'Starting...' : 'Download from Instagram'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── YouTube Shorts Form ───────────────────────────── */}
      {activeTab === 'youtube' && (
        <div className="glass-panel" style={{ animation: 'fadeIn 0.4s ease-out' }}>
          <form onSubmit={handleYtSubmit} className="form-grid">
            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
              <label><Link size={16} style={{display:'inline', marginBottom:'-3px', marginRight:'5px'}}/> YouTube URL</label>
              <input
                type="text"
                name="source_url"
                className="input-field"
                placeholder="Channel URL, e.g. https://youtube.com/@handle or a single short URL"
                value={ytForm.source_url}
                onChange={handleYtChange}
                required
              />
              <span className="hint-text" style={{ marginTop: '0.35rem' }}>
                Paste a <code>channel URL</code> to batch-download shorts, or a single <code>/shorts/</code> link.
              </span>
            </div>

            <div className="input-group">
              <label><Folder size={16} style={{display:'inline', marginBottom:'-3px', marginRight:'5px'}}/> Download Path (Absolute)</label>
              <input
                type="text"
                name="download_path"
                className="input-field"
                placeholder="/Users/username/Downloads/yt-shorts"
                value={ytForm.download_path}
                onChange={handleYtChange}
                required
              />
            </div>

            <div className="input-group">
              <label><Film size={16} style={{display:'inline', marginBottom:'-3px', marginRight:'5px'}}/> Max Videos</label>
              <input
                type="number"
                name="max_videos"
                className="input-field"
                min={1}
                max={100}
                value={ytForm.max_videos}
                onChange={handleYtChange}
              />
            </div>

            <div className="input-group" style={{gridColumn: '1 / -1', display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '1.5rem', marginTop: '1rem'}}>
              <label className="checkbox-group">
                <input type="checkbox" name="download_captions" checked={ytForm.download_captions} onChange={handleYtChange} />
                <span><Captions size={16} style={{display:'inline', marginBottom:'-3px'}}/> Captions / Subtitles</span>
              </label>

              <label className="checkbox-group">
                <input type="checkbox" name="download_description" checked={ytForm.download_description} onChange={handleYtChange} />
                <span><FileText size={16} style={{display:'inline', marginBottom:'-3px'}}/> Description</span>
              </label>

              <label className="checkbox-group">
                <input type="checkbox" name="download_metadata" checked={ytForm.download_metadata} onChange={handleYtChange} />
                <span><Info size={16} style={{display:'inline', marginBottom:'-3px'}}/> JSON Metadata</span>
              </label>
            </div>

            <div style={{gridColumn: '1 / -1'}}>
              <button
                type="submit"
                className="btn-primary btn-youtube"
                disabled={loading || !ytForm.source_url || !ytForm.download_path}
              >
                <Download size={20} style={{display:'inline', marginBottom:'-4px', marginRight:'8px'}}/>
                {loading ? 'Starting...' : 'Download YouTube Shorts'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Activity Reports ──────────────────────────────── */}
      {jobs.length > 0 && (
        <div className="reports-section">
          <h2 style={{marginBottom: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
            <Activity size={24} /> Activity Reports
          </h2>

          <div className="jobs-list">
            {jobs.map(job => {
              const isYt = job.handle && (job.handle.includes('youtube.com') || job.handle.includes('youtu.be'));
              return (
                <div key={job.id} className="job-card glass-panel" style={{padding: '1.5rem', marginTop: '1rem'}}>
                  <div className="job-header">
                    <div className="job-handle">
                      {isYt ? (
                        <Play size={20} style={{ color: '#FF0000' }} />
                      ) : (
                        <Hash size={20} className="text-accent-primary" />
                      )}
                      <span style={{ wordBreak: 'break-all' }}>
                        {isYt ? job.handle : `@${job.handle}`}
                      </span>
                    </div>
                    <div className={`status-badge status-${job.status}`}>
                      {job.status}
                    </div>
                  </div>
                  <div className="progress-text">
                    {job.progress}
                  </div>
                  {job.error && (
                    <div className="progress-text" style={{color: 'var(--error)'}}>
                      Error: {job.error}
                    </div>
                  )}
                  {job.captions_path && (
                    <div className="progress-text" style={{color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.25rem'}}>
                      <Tag size={14} />
                      Captions saved: {job.captions_path}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default InstagramDownloader;
