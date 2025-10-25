import { useState, useEffect } from 'react';
import { 
  FolderOpen, Play, CheckCircle, AlertCircle, 
  Loader, Settings, Palette, Eye, Image, Move
} from 'lucide-react';

export default function WatermarkApplier() {
  const [folderPath, setFolderPath] = useState('');
  const [logoPath, setLogoPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState([]);
  
  // Settings configuration
  const [settings, setSettings] = useState({
    watermark_mode: 'logo',
    position: 'bottom-right',
    width_scale: 150,
    opacity: 0.5,
    margin: 20,
    output_subfolder: 'with_watermark'
  });

  // Media preview modal state
  const [previewVideo, setPreviewVideo] = useState(null);

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  // Poll for jobs on load and during active runs
  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 2500);
    return () => clearInterval(interval);
  }, []);

  const fetchJobs = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/watermark/jobs');
      if (res.ok) {
        const data = await res.json();
        setJobs(data.reverse());
      }
    } catch (err) {
      console.error("Error fetching watermark jobs:", err);
    }
  };

  const startProcessing = async () => {
    if (!folderPath) {
      alert("Please specify a video folder path!");
      return;
    }
    if (!logoPath) {
      alert("Please specify the path to your transparent logo/frame file!");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/watermark/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folder_path: folderPath,
          logo_path: logoPath,
          settings: settings
        })
      });
      
      if (!res.ok) {
        const errData = await res.json();
        alert(errData.detail || "Failed to start watermark process");
      }
    } catch (err) {
      alert("Failed to connect to backend server");
    } finally {
      setLoading(false);
    }
  };

  // Helper to compute CSS position styles for the interactive visual style preview
  const getPreviewPositionStyles = () => {
    if (settings.watermark_mode === 'frame') {
      return {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: settings.opacity,
        transition: 'all 0.3s ease'
      };
    }

    const pad = `${settings.margin / 2.5}px`;
    const base = {
      position: 'absolute',
      width: `${settings.width_scale / 3.5}px`,
      maxWidth: '80%',
      opacity: settings.opacity,
      transition: 'all 0.3s ease'
    };

    switch (settings.position) {
      case 'top-left':
        return { ...base, top: pad, left: pad };
      case 'top-right':
        return { ...base, top: pad, right: pad };
      case 'bottom-left':
        return { ...base, bottom: pad, left: pad };
      case 'center':
        return { ...base, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
      default: // bottom-right
        return { ...base, bottom: pad, right: pad };
    }
  };

  return (
    <div className="container">
      {/* ── Header ───────────────────────────────────── */}
      <header className="page-header">
        <div className="header-icon" style={{ background: 'var(--accent-gradient)' }}>
          <Image size={28} style={{ color: '#white' }} />
        </div>
        <div>
          <h1 className="page-title">Watermark Applier</h1>
          <p className="page-subtitle">Overlay a transparent brand logo or full-screen border frame onto your video reels in bulk</p>
        </div>
      </header>

      {/* ── Main Content Grid ────────────────────────── */}
      <div className="editor-grid">
        
        {/* Left Control Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Paths Settings */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 className="setting-title" style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FolderOpen size={18} /> File & Folder Settings
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
              <label>Logo or Frame File Path (.png/.jpg)</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. /Users/masi/Documents/frame.png"
                value={logoPath}
                onChange={e => setLogoPath(e.target.value)}
              />
              <span className="hint-text">Absolute path to your transparent brand logo or border frame on disk.</span>
            </div>
          </div>

          {/* Watermark Styling & Layout */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 className="setting-title" style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings size={18} /> Position & Overlay Settings
            </h3>

            {/* Mode Select */}
            <div className="input-group" style={{ marginTop: '1rem' }}>
              <label>Overlay Mode</label>
              <select
                className="input-field"
                value={settings.watermark_mode}
                onChange={e => updateSetting('watermark_mode', e.target.value)}
                style={{ background: 'var(--surface-dark)', cursor: 'pointer' }}
              >
                <option value="logo">Standard Logo (Corner Icon)</option>
                <option value="frame">Full Screen Frame (Border/Mask Overlay)</option>
              </select>
            </div>

            {settings.watermark_mode === 'logo' && (
              <>
                {/* Position Select */}
                <div className="input-group" style={{ marginTop: '1.25rem' }}>
                  <label>Logo Placement Position</label>
                  <select
                    className="input-field"
                    value={settings.position}
                    onChange={e => updateSetting('position', e.target.value)}
                    style={{ background: 'var(--surface-dark)', cursor: 'pointer' }}
                  >
                    <option value="bottom-right">Bottom Right (Default)</option>
                    <option value="bottom-left">Bottom Left</option>
                    <option value="top-right">Top Right</option>
                    <option value="top-left">Top Left</option>
                    <option value="center">Center Overlay</option>
                  </select>
                </div>

                {/* Scale Width */}
                <div className="input-group" style={{ marginTop: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <label>Logo Scaled Width</label>
                    <span style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', fontWeight: 600 }}>{settings.width_scale}px</span>
                  </div>
                  <input
                    type="range"
                    min={40}
                    max={400}
                    step={10}
                    value={settings.width_scale}
                    onChange={e => updateSetting('width_scale', parseInt(e.target.value))}
                    className="range-slider"
                  />
                </div>
              </>
            )}

            {/* Opacity */}
            <div className="input-group" style={{ marginTop: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <label>Overlay Opacity (Transparency)</label>
                <span style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', fontWeight: 600 }}>{Math.round(settings.opacity * 100)}%</span>
              </div>
              <input
                type="range"
                min={0.1}
                max={1.0}
                step={0.05}
                value={settings.opacity}
                onChange={e => updateSetting('opacity', parseFloat(e.target.value))}
                className="range-slider"
              />
            </div>

            {/* Margin padding & output subfolder */}
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.25rem' }}>
              {settings.watermark_mode === 'logo' && (
                <div className="input-group" style={{ flex: 1 }}>
                  <label>Border Margin (px)</label>
                  <input
                    type="number"
                    className="input-field"
                    min={0}
                    max={100}
                    value={settings.margin}
                    onChange={e => updateSetting('margin', parseInt(e.target.value) || 0)}
                  />
                </div>
              )}
              <div className="input-group" style={{ flex: 1 }}>
                <label>Subfolder</label>
                <input
                  type="text"
                  className="input-field"
                  value={settings.output_subfolder}
                  onChange={e => updateSetting('output_subfolder', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Interactive Layout Mockup Preview */}
          <div className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h4 style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Eye size={12} /> Placement Mockup Preview
            </h4>
            <div style={{
              position: 'relative', width: '100%', height: '140px', borderRadius: '8px', 
              background: 'linear-gradient(185deg, #1f2937, #0f172a)', overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px dashed rgba(255,255,255,0.08)'
            }}>
              <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.08)', fontWeight: 500 }}>REEL SCREEN MOCKUP</div>
              <div style={getPreviewPositionStyles()}>
                {settings.watermark_mode === 'frame' ? (
                  <div style={{
                    width: '100%', height: '100%', border: '6px solid var(--accent-primary)',
                    borderRadius: '8px', boxSizing: 'border-box', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)',
                    fontSize: '0.68rem', fontWeight: 700, background: 'rgba(139, 92, 246, 0.05)'
                  }}>
                    FULL SCREEN TRANSPARENT FRAME
                  </div>
                ) : (
                  <div style={{
                    padding: '6px 12px', border: '2px dashed var(--accent-primary)',
                    borderRadius: '6px', background: 'rgba(139, 92, 246, 0.2)',
                    color: 'white', fontWeight: 700, fontSize: '0.75rem', textAlign: 'center',
                    whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                  }}>
                    <Move size={12} /> BRAND LOGO
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Submit Process Button */}
          <button
            type="button"
            className="btn-primary"
            disabled={loading || !folderPath || !logoPath}
            onClick={startProcessing}
            style={{ height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            {loading ? (
              <>
                <Loader size={20} className="spin" /> Overlaying Logo...
              </>
            ) : (
              <>
                <Image size={20} /> Apply Watermark in Bulk
              </>
            )}
          </button>
        </div>

        {/* Right Side: Jobs List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          <div className="glass-panel" style={{ padding: '1.5rem', flex: 1, minHeight: '400px' }}>
            <h3 className="setting-title" style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
              <Image size={18} /> Watermarking Jobs Queue
            </h3>

            {jobs.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'var(--text-secondary)' }}>
                <Image size={40} style={{ opacity: 0.15, marginBottom: '1rem' }} />
                <span>No active or previous watermarking jobs found</span>
                <span style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Specify paths and apply watermark to start a job.</span>
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
                          <CheckCircle size={12} style={{ color: 'var(--success)' }} /> Finalized Reels:
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
