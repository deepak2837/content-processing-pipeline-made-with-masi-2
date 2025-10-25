import { useState, useEffect } from 'react';
import { 
  Type, FolderOpen, Play, CheckCircle, AlertCircle, 
  Loader, Settings, Palette, Eye, Volume2, Sparkles,
  Maximize2
} from 'lucide-react';

export default function SubtitleGenerator() {
  const [folderPath, setFolderPath] = useState('');
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState([]);
  
  // Styling configuration
  const [styling, setStyling] = useState({
    font_size: 18,
    color: '#FFFFFF',
    outline_color: '#000000',
    alignment: 2, // 2 is bottom center
    margin_v: 20,
    output_subfolder: 'with_subtitles'
  });

  // Media preview modal state
  const [previewVideo, setPreviewVideo] = useState(null);

  // Auto-save API Key
  const handleApiKeyChange = (val) => {
    setApiKey(val);
    localStorage.setItem('gemini_api_key', val);
  };

  const updateStyle = (key, value) => {
    setStyling(prev => ({ ...prev, [key]: value }));
  };

  // Poll for jobs on load and during active runs
  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 2500);
    return () => clearInterval(interval);
  }, []);

  const fetchJobs = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/subtitles/jobs');
      if (res.ok) {
        const data = await res.json();
        setJobs(data.reverse());
      }
    } catch (err) {
      console.error("Error fetching subtitle jobs:", err);
    }
  };

  const startProcessing = async () => {
    if (!folderPath) {
      alert("Please specify a video folder path!");
      return;
    }
    if (!apiKey) {
      alert("Please provide a Gemini API Key to enable transcription!");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/subtitles/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folder_path: folderPath,
          api_key: apiKey,
          styling: styling
        })
      });
      
      if (!res.ok) {
        const errData = await res.json();
        alert(errData.detail || "Failed to start subtitle process");
      }
    } catch (err) {
      alert("Failed to connect to backend server");
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="container">
      {/* ── Header ───────────────────────────────────── */}
      <header className="page-header">
        <div className="header-icon" style={{ background: 'var(--accent-gradient)' }}>
          <Type size={28} style={{ color: '#white' }} />
        </div>
        <div>
          <h1 className="page-title">Subtitle Generator</h1>
          <p className="page-subtitle">Transcribe speech to subtitles using AI and hardcode them beautifully onto your videos</p>
        </div>
      </header>

      {/* ── Main Content Grid ────────────────────────── */}
      <div className="editor-grid">
        
        {/* Left Control Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Path & API Key Settings */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 className="setting-title" style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FolderOpen size={18} /> Folder & Key Settings
            </h3>
            
            <div className="input-group" style={{ marginTop: '1rem' }}>
              <label>Video Folder Path</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. /Users/masi/Documents/newreels"
                value={folderPath}
                onChange={e => setFolderPath(e.target.value)}
              />
            </div>

            <div className="input-group" style={{ marginTop: '1rem' }}>
              <label>Gemini API Key</label>
              <input
                type="password"
                className="input-field"
                placeholder="Enter Gemini API Key..."
                value={apiKey}
                onChange={e => handleApiKeyChange(e.target.value)}
              />
              <span className="hint-text">Required for Speech-to-Text translation.</span>
            </div>
          </div>

          {/* Subtitle Style Options */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 className="setting-title" style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Palette size={18} /> Subtitle Styling
            </h3>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <div className="input-group" style={{ flex: 1 }}>
                <label>Font Size (px)</label>
                <input
                  type="number"
                  className="input-field"
                  min={10}
                  max={48}
                  value={styling.font_size}
                  onChange={e => updateStyle('font_size', parseInt(e.target.value) || 16)}
                />
              </div>
              <div className="input-group" style={{ flex: 1 }}>
                <label>Vertical Position (Margin)</label>
                <input
                  type="number"
                  className="input-field"
                  min={5}
                  max={100}
                  value={styling.margin_v}
                  onChange={e => updateStyle('margin_v', parseInt(e.target.value) || 15)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <div className="input-group" style={{ flex: 1 }}>
                <label>Text Color</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="color"
                    className="input-field"
                    style={{ width: '42px', height: '42px', padding: '2px', cursor: 'pointer' }}
                    value={styling.color}
                    onChange={e => updateStyle('color', e.target.value)}
                  />
                  <input
                    type="text"
                    className="input-field"
                    style={{ fontSize: '0.85rem' }}
                    value={styling.color}
                    onChange={e => updateStyle('color', e.target.value)}
                  />
                </div>
              </div>

              <div className="input-group" style={{ flex: 1 }}>
                <label>Outline Color</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="color"
                    className="input-field"
                    style={{ width: '42px', height: '42px', padding: '2px', cursor: 'pointer' }}
                    value={styling.outline_color}
                    onChange={e => updateStyle('outline_color', e.target.value)}
                  />
                  <input
                    type="text"
                    className="input-field"
                    style={{ fontSize: '0.85rem' }}
                    value={styling.outline_color}
                    onChange={e => updateStyle('outline_color', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Subfolder Name */}
            <div className="input-group" style={{ marginTop: '1.25rem' }}>
              <label>Output Subfolder Name</label>
              <input
                type="text"
                className="input-field"
                value={styling.output_subfolder}
                onChange={e => updateStyle('output_subfolder', e.target.value)}
                placeholder="with_subtitles"
              />
            </div>
          </div>

          {/* Subtitles Preview Mockup */}
          <div className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h4 style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Style Preview</h4>
            <div style={{
              position: 'relative', width: '100%', height: '120px', borderRadius: '8px', 
              background: 'linear-gradient(180deg, #1f2937, #111827)', overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Sparkles size={16} style={{ position: 'absolute', top: '10px', right: '10px', color: 'rgba(255,255,255,0.1)' }} />
              <div style={{
                position: 'absolute',
                bottom: `${styling.margin_v / 2}px`,
                fontSize: `${styling.font_size * 0.7}px`,
                color: styling.color,
                fontWeight: 700,
                textAlign: 'center',
                textShadow: `
                  -1px -1px 0 ${styling.outline_color},  
                   1px -1px 0 ${styling.outline_color},
                  -1px  1px 0 ${styling.outline_color},
                   1px  1px 0 ${styling.outline_color}
                `
              }}>
                Beautiful AI Subtitles Applied Live!
              </div>
            </div>
          </div>

          {/* Submit Process Button */}
          <button
            type="button"
            className="btn-primary"
            disabled={loading || !folderPath || !apiKey}
            onClick={startProcessing}
            style={{ height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            {loading ? (
              <>
                <Loader size={20} className="spin" /> Generating...
              </>
            ) : (
              <>
                <Type size={20} /> Generate & Burn Subtitles
              </>
            )}
          </button>
        </div>

        {/* Right Side: Jobs List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          <div className="glass-panel" style={{ padding: '1.5rem', flex: 1, minHeight: '400px' }}>
            <h3 className="setting-title" style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
              <Type size={18} /> Subtitle Jobs Queue
            </h3>

            {jobs.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'var(--text-secondary)' }}>
                <Type size={40} style={{ opacity: 0.15, marginBottom: '1rem' }} />
                <span>No active or previous subtitle jobs found</span>
                <span style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Start a job to see progress details here.</span>
              </div>
            ) : (
              <div className="jobs-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '550px', overflowY: 'auto' }}>
                {jobs.map(job => (
                  <div key={job.id} className="job-card glass-panel" style={{ padding: '1.25rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="job-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <div className="job-handle" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FolderOpen size={14} style={{ color: 'var(--accent-primary)' }} />
                        {job.folder_path}
                      </div>
                      <div className={`status-badge status-${job.status}`} style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '999px', textTransform: 'capitalize' }}>
                        {job.status}
                      </div>
                    </div>

                    {job.status === 'processing' && (
                      <div className="processing-bar-outer" style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '99px', overflow: 'hidden', marginBottom: '0.75rem' }}>
                        <div className="processing-bar-inner" style={{ 
                          height: '100%', 
                          background: 'var(--accent-gradient)',
                          width: job.total_files > 0 ? `${(job.processed_files / job.total_files) * 100}%` : '0%',
                          transition: 'width 0.4s ease'
                        }} />
                      </div>
                    )}

                    <div className="progress-text" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {job.status === 'processing' && <Loader size={12} className="spin" style={{ color: 'var(--accent-primary)' }} />}
                      {job.progress}
                    </div>

                    {job.current_file && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', marginTop: '4px' }}>
                        Active: {job.current_file} ({job.processed_files}/{job.total_files})
                      </div>
                    )}

                    {job.error && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <AlertCircle size={12} /> {job.error}
                      </div>
                    )}

                    {/* Finished Files List */}
                    {job.status === 'completed' && job.output_files && job.output_files.length > 0 && (
                      <div style={{ marginTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.5rem' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle size={12} style={{ color: 'var(--success)' }} /> Transcribed Reels:
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          {job.output_files.map((file, idx) => (
                            <div key={idx} style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              background: 'rgba(255,255,255,0.02)', padding: '0.4rem 0.6rem', borderRadius: '6px',
                              border: '1px solid rgba(255,255,255,0.04)'
                            }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                                {file.name}
                              </span>
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => setPreviewVideo({
                                  name: file.name,
                                  url: `http://localhost:8000/api/audio-gen/stream?path=${encodeURIComponent(file.path)}`
                                })}
                                style={{
                                  padding: '4px 8px', fontSize: '0.72rem', height: 'auto',
                                  display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(139, 92, 246, 0.12)',
                                  border: '1px solid rgba(139, 92, 246, 0.2)', color: 'var(--accent-primary)'
                                }}
                              >
                                <Play size={10} fill="currentColor" /> Preview
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Preview Modal ────────────────────────────── */}
      {previewVideo && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: '1rem',
          backdropFilter: 'blur(8px)'
        }}>
          <div className="glass-panel" style={{
            width: '100%', maxWidth: '420px', padding: '1.5rem',
            position: 'relative', background: 'rgba(13,17,28,0.92)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '0.98rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }}>
                {previewVideo.name}
              </h3>
              <button
                type="button"
                onClick={() => setPreviewVideo(null)}
                style={{
                  background: 'none', border: 'none', color: 'var(--text-secondary)',
                  cursor: 'pointer', fontSize: '1.25rem', padding: '4px'
                }}
              >
                &times;
              </button>
            </div>

            <div style={{ borderRadius: '12px', overflow: 'hidden', background: '#000', display: 'flex', justifyContent: 'center' }}>
              <video
                src={previewVideo.url}
                controls
                autoPlay
                style={{ width: '100%', height: 'auto', maxHeight: '500px' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
