import { useState, useEffect } from 'react';
import {
  Film, FolderOpen, Play, Search, FileVideo, Palette, Maximize, Sparkles,
  CheckCircle, AlertCircle, Loader, Settings, Scissors, Gauge, Clock,
  Volume2, VolumeX, Sun, Type, RotateCw, FlipHorizontal, FlipVertical,
  ChevronDown, ChevronRight, Scaling, Crop, Shrink, XSquare
} from 'lucide-react';

const PRESETS = [
  { label: '9:16 Reels', width: 1080, height: 1920 },
  { label: '1:1 Square', width: 1080, height: 1080 },
  { label: '16:9 Wide', width: 1920, height: 1080 },
  { label: '4:5 Portrait', width: 1080, height: 1350 },
];

const RESIZE_MODES = [
  { value: 'fill',     label: 'Fill',     icon: Scaling, desc: 'Fit inside + color bars' },
  { value: 'cut',      label: 'Cut',      icon: Crop,    desc: 'Crop center to fit' },
  { value: 'compress', label: 'Compress',  icon: Shrink,  desc: 'Stretch to fit' },
];

const QUALITY_OPTIONS = [
  { label: 'Low', value: 'low', desc: 'Smallest file' },
  { label: 'Medium', value: 'medium', desc: 'Balanced' },
  { label: 'High', value: 'high', desc: 'Great quality' },
  { label: 'Ultra', value: 'ultra', desc: 'Maximum' },
];

const COLOR_PRESETS = [
  { label: 'White', value: '#FFFFFF' },
  { label: 'Black', value: '#000000' },
  { label: 'Gray', value: '#808080' },
];

const BAR_POSITIONS = [
  { label: 'Top & Bottom', value: 'both' },
  { label: 'Top Only', value: 'top' },
  { label: 'Bottom Only', value: 'bottom' },
  { label: 'Sides', value: 'sides' },
];

const WATERMARK_POSITIONS = [
  { label: 'Top Left', value: 'top_left' },
  { label: 'Top Right', value: 'top_right' },
  { label: 'Bottom Left', value: 'bottom_left' },
  { label: 'Bottom Right', value: 'bottom_right' },
  { label: 'Center', value: 'center' },
];

const SPEED_PRESETS = [
  { label: '0.25x', value: 0.25 },
  { label: '0.5x', value: 0.5 },
  { label: '0.75x', value: 0.75 },
  { label: '1x', value: 1.0 },
  { label: '1.5x', value: 1.5 },
  { label: '2x', value: 2.0 },
  { label: '4x', value: 4.0 },
];

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

/* ── Collapsible Setting Section ─────────────────────────── */
function SettingSection({ icon: Icon, title, enabled, onToggle, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="glass-panel setting-card">
      <div className="setting-header" onClick={() => setOpen(o => !o)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 className="setting-title" style={{ marginBottom: 0 }}>
          <Icon size={18} /> {title}
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {onToggle !== undefined && (
            <label className="toggle-switch" onClick={e => e.stopPropagation()}>
              <input type="checkbox" checked={enabled} onChange={e => onToggle(e.target.checked)} />
              <span className="toggle-slider" />
            </label>
          )}
          {open ? <ChevronDown size={18} style={{ color: 'var(--text-secondary)' }} /> : <ChevronRight size={18} style={{ color: 'var(--text-secondary)' }} />}
        </div>
      </div>
      {open && <div style={{ marginTop: '1rem' }}>{children}</div>}
    </div>
  );
}

function VideoEditor() {
  const [folderPath, setFolderPath] = useState('');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [activePreset, setActivePreset] = useState(0);

  const [settings, setSettings] = useState({
    resize_enabled: true,
    target_width: 1080,
    target_height: 1920,
    resize_mode: 'fill',
    color_bars_enabled: true,
    bar_color: '#FFFFFF',
    bar_position: 'both',
    bar_opacity: 1.0,
    bar_top_height: 0,
    bar_bottom_height: 0,
    crop_enabled: false,
    crop_top: 0, crop_bottom: 0, crop_left: 0, crop_right: 0,
    speed_enabled: false,
    speed_factor: 1.0,
    trim_enabled: false,
    trim_mode: 'keep',
    trim_segments: [],
    trim_start: '00:00:00',
    trim_end: '',
    audio_enabled: true,
    audio_volume: 1.0,
    audio_fade_in: 0,
    audio_fade_out: 0,
    adjust_enabled: false,
    brightness: 0,
    contrast: 1.0,
    saturation: 1.0,
    sharpness: 0,
    hue: 0,
    watermark_enabled: false,
    watermark_text: '',
    watermark_position: 'bottom_right',
    watermark_font_size: 24,
    watermark_color: '#FFFFFF',
    watermark_opacity: 0.7,
    rotation: 0,
    flip_horizontal: false,
    flip_vertical: false,
    quality: 'high',
    output_subfolder: 'processed',
    output_format: 'mp4',
  });

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/video-editor/jobs');
        if (res.ok) { setJobs((await res.json()).reverse()); }
      } catch (err) { /* ignore */ }
    };
    fetchJobs();
    const interval = setInterval(fetchJobs, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (jobs.some(j => j.status === 'completed') && folderPath) scanFolder();
  }, [jobs.map(j => j.status).join(',')]);

  const scanFolder = async () => {
    if (!folderPath) return;
    setScanning(true);
    try {
      const res = await fetch('http://localhost:8000/api/video-editor/list-folder', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_path: folderPath }),
      });
      if (res.ok) setFiles(await res.json());
    } catch (err) { console.error('Failed to scan folder'); }
    finally { setScanning(false); }
  };

  const startProcessing = async () => {
    if (!folderPath) return;
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/video-editor/process', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_path: folderPath, settings }),
      });
      if (!res.ok) { const e = await res.json(); alert(e.detail || 'Failed'); }
    } catch (err) { alert('Error connecting to backend'); }
    finally { setLoading(false); }
  };

  const cancelJob = async (jobId) => {
    try {
      await fetch(`http://localhost:8000/api/video-editor/cancel/${jobId}`, {
        method: 'POST',
      });
    } catch (err) {
      console.error("Failed to cancel job", err);
    }
  };

  const applyPreset = (idx) => {
    const p = PRESETS[idx];
    setActivePreset(idx);
    setSettings(s => ({ ...s, target_width: p.width, target_height: p.height }));
  };

  const u = (key, value) => setSettings(s => ({ ...s, [key]: value }));

  const originalFiles = files.filter(f => !f.is_processed);
  const processedFiles = files.filter(f => f.is_processed);

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Video Editor</h1>
        <p>Batch process videos — resize, add color masks, adjust speed, and more</p>
      </div>

      {/* ── Folder Input ─────────────────────────────── */}
      <div className="glass-panel">
        <div className="input-group">
          <label><FolderOpen size={16} style={{ display: 'inline', marginBottom: '-3px', marginRight: '5px' }} /> Video Folder Path</label>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <input type="text" className="input-field" placeholder="/Users/username/Downloads/videos" value={folderPath} onChange={e => setFolderPath(e.target.value)} style={{ flex: 1 }} />
            <button type="button" className="btn-secondary" onClick={scanFolder} disabled={!folderPath || scanning}>
              <Search size={18} style={{ marginRight: '6px', marginBottom: '-3px' }} />
              {scanning ? 'Scanning...' : 'Scan'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Settings ─────────────────────────────────── */}
      <div className="settings-grid">

        {/* Resolution */}
        <SettingSection icon={Maximize} title="Resolution" enabled={settings.resize_enabled} onToggle={v => u('resize_enabled', v)} defaultOpen={true}>
          {settings.resize_enabled && (
            <>
              <div className="preset-buttons">
                {PRESETS.map((p, idx) => (
                  <button key={p.label} type="button" className={`preset-btn ${activePreset === idx ? 'active' : ''}`} onClick={() => applyPreset(idx)}>{p.label}</button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <div className="input-group" style={{ flex: 1 }}>
                  <label>Width</label>
                  <input type="number" className="input-field" value={settings.target_width} onChange={e => u('target_width', parseInt(e.target.value) || 0)} />
                </div>
                <div className="input-group" style={{ flex: 1 }}>
                  <label>Height</label>
                  <input type="number" className="input-field" value={settings.target_height} onChange={e => u('target_height', parseInt(e.target.value) || 0)} />
                </div>
              </div>

              {/* Resize Mode */}
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '1.25rem', marginBottom: '0.5rem', display: 'block' }}>Resize Mode</label>
              <div className="resize-mode-grid">
                {RESIZE_MODES.map(rm => {
                  const RmIcon = rm.icon;
                  return (
                    <button
                      key={rm.value}
                      type="button"
                      className={`resize-mode-btn ${settings.resize_mode === rm.value ? 'active' : ''}`}
                      onClick={() => u('resize_mode', rm.value)}
                    >
                      <RmIcon size={20} className="resize-mode-icon" />
                      <span className="resize-mode-label">{rm.label}</span>
                      <span className="resize-mode-desc">{rm.desc}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </SettingSection>

        {/* Color Bars — only visible in Fill mode */}
        {settings.resize_enabled && settings.resize_mode === 'fill' && (
        <SettingSection icon={Palette} title="Color Bars / Mask" enabled={settings.color_bars_enabled} onToggle={v => u('color_bars_enabled', v)} defaultOpen={true}>
          {settings.color_bars_enabled && (
            <>
              {/* Custom top/bottom mask height */}
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'block' }}>Mask Height (px)</label>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <div className="input-group" style={{ flex: 1 }}>
                  <label>Top</label>
                  <input type="number" className="input-field" value={settings.bar_top_height} onChange={e => u('bar_top_height', parseInt(e.target.value) || 0)} min="0" placeholder="0 = auto" />
                </div>
                <div className="input-group" style={{ flex: 1 }}>
                  <label>Bottom</label>
                  <input type="number" className="input-field" value={settings.bar_bottom_height} onChange={e => u('bar_bottom_height', parseInt(e.target.value) || 0)} min="0" placeholder="0 = auto" />
                </div>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.5 }}>
                {settings.bar_top_height > 0 || settings.bar_bottom_height > 0
                  ? <>Custom: <strong>{settings.bar_top_height}px</strong> top, <strong>{settings.bar_bottom_height}px</strong> bottom</>
                  : <>Set to 0 for auto (uses position preset below)</>}
              </p>

              {/* Position preset — only relevant when custom heights are both 0 */}
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'block', opacity: (settings.bar_top_height > 0 || settings.bar_bottom_height > 0) ? 0.4 : 1 }}>Position Preset</label>
              <div className="preset-buttons" style={{ marginBottom: '1rem', opacity: (settings.bar_top_height > 0 || settings.bar_bottom_height > 0) ? 0.4 : 1, pointerEvents: (settings.bar_top_height > 0 || settings.bar_bottom_height > 0) ? 'none' : 'auto' }}>
                {BAR_POSITIONS.map(bp => (
                  <button key={bp.value} type="button" className={`preset-btn ${settings.bar_position === bp.value ? 'active' : ''}`} onClick={() => u('bar_position', bp.value)}>{bp.label}</button>
                ))}
              </div>

              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'block' }}>Color</label>
              <div className="color-presets">
                {COLOR_PRESETS.map(c => (
                  <button key={c.value} type="button" className={`color-btn ${settings.bar_color === c.value ? 'active' : ''}`} onClick={() => u('bar_color', c.value)}>
                    <span className="color-swatch" style={{ background: c.value }} />{c.label}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem', alignItems: 'flex-end' }}>
                <div className="input-group" style={{ flex: 1 }}>
                  <label>Custom Hex</label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input type="color" value={settings.bar_color} onChange={e => u('bar_color', e.target.value)} style={{ width: '40px', height: '36px', border: 'none', cursor: 'pointer', borderRadius: '8px', background: 'transparent' }} />
                    <input type="text" className="input-field" value={settings.bar_color} onChange={e => u('bar_color', e.target.value)} style={{ flex: 1 }} />
                  </div>
                </div>
                <div className="input-group" style={{ width: '120px' }}>
                  <label>Opacity</label>
                  <input type="range" min="0" max="1" step="0.05" value={settings.bar_opacity} onChange={e => u('bar_opacity', parseFloat(e.target.value))} className="range-slider" />
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{Math.round(settings.bar_opacity * 100)}%</span>
                </div>
              </div>
            </>
          )}
        </SettingSection>
        )}

        {/* Crop */}
        <SettingSection icon={Scissors} title="Crop" enabled={settings.crop_enabled} onToggle={v => u('crop_enabled', v)}>
          {settings.crop_enabled && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {['top', 'bottom', 'left', 'right'].map(side => (
                <div key={side} className="input-group">
                  <label style={{ textTransform: 'capitalize' }}>{side} (px)</label>
                  <input type="number" className="input-field" value={settings[`crop_${side}`]} onChange={e => u(`crop_${side}`, parseInt(e.target.value) || 0)} min="0" />
                </div>
              ))}
            </div>
          )}
        </SettingSection>

        {/* Speed */}
        <SettingSection icon={Gauge} title="Speed" enabled={settings.speed_enabled} onToggle={v => u('speed_enabled', v)}>
          {settings.speed_enabled && (
            <>
              <div className="preset-buttons">
                {SPEED_PRESETS.map(sp => (
                  <button key={sp.value} type="button" className={`preset-btn ${settings.speed_factor === sp.value ? 'active' : ''}`} onClick={() => u('speed_factor', sp.value)}>{sp.label}</button>
                ))}
              </div>
              <div className="input-group" style={{ marginTop: '0.75rem' }}>
                <label>Custom Factor</label>
                <input type="number" className="input-field" value={settings.speed_factor} onChange={e => u('speed_factor', parseFloat(e.target.value) || 1)} min="0.1" max="10" step="0.1" />
              </div>
            </>
          )}
        </SettingSection>

        {/* Trim */}
        <SettingSection icon={Clock} title="Trim" enabled={settings.trim_enabled} onToggle={v => u('trim_enabled', v)}>
          {settings.trim_enabled && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="input-group">
                <label>Trim Mode</label>
                <select className="input-field" value={settings.trim_mode} onChange={e => u('trim_mode', e.target.value)}>
                  <option value="keep">Keep selected segments (Discard rest)</option>
                  <option value="cut">Cut selected segments (Keep rest)</option>
                </select>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Segments (HH:MM:SS or MM:SS)</label>
                {settings.trim_segments.map((seg, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input type="text" className="input-field" value={seg.start} onChange={e => {
                      const newSegs = [...settings.trim_segments];
                      newSegs[idx].start = e.target.value;
                      u('trim_segments', newSegs);
                    }} placeholder="Start" style={{ flex: 1 }} />
                    <span style={{ color: 'var(--text-secondary)' }}>-</span>
                    <input type="text" className="input-field" value={seg.end} onChange={e => {
                      const newSegs = [...settings.trim_segments];
                      newSegs[idx].end = e.target.value;
                      u('trim_segments', newSegs);
                    }} placeholder="End" style={{ flex: 1 }} />
                    <button type="button" className="btn-secondary" onClick={() => {
                      const newSegs = settings.trim_segments.filter((_, i) => i !== idx);
                      u('trim_segments', newSegs);
                    }} style={{ padding: '0.5rem', color: 'var(--error)', borderColor: 'var(--error)', minWidth: '36px' }}>
                      X
                    </button>
                  </div>
                ))}
                <button type="button" className="btn-secondary" onClick={() => {
                  u('trim_segments', [...settings.trim_segments, { start: '00:00:00', end: '00:00:10' }]);
                }} style={{ marginTop: '0.5rem', width: 'fit-content' }}>
                  + Add Segment
                </button>
              </div>

              {settings.trim_segments.length === 0 && (
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', padding: '1rem', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                  <div className="input-group" style={{ flex: 1 }}>
                    <label>Legacy Start</label>
                    <input type="text" className="input-field" value={settings.trim_start} onChange={e => u('trim_start', e.target.value)} placeholder="00:00:00" />
                  </div>
                  <div className="input-group" style={{ flex: 1 }}>
                    <label>Legacy End</label>
                    <input type="text" className="input-field" value={settings.trim_end} onChange={e => u('trim_end', e.target.value)} placeholder="End" />
                  </div>
                </div>
              )}
            </div>
          )}
        </SettingSection>

        {/* Audio */}
        <SettingSection icon={settings.audio_enabled ? Volume2 : VolumeX} title="Audio" enabled={settings.audio_enabled} onToggle={v => u('audio_enabled', v)}>
          {settings.audio_enabled && (
            <>
              <div className="input-group">
                <label>Volume ({Math.round(settings.audio_volume * 100)}%)</label>
                <input type="range" min="0" max="3" step="0.05" value={settings.audio_volume} onChange={e => u('audio_volume', parseFloat(e.target.value))} className="range-slider" />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem' }}>
                <div className="input-group" style={{ flex: 1 }}>
                  <label>Fade In (sec)</label>
                  <input type="number" className="input-field" value={settings.audio_fade_in} onChange={e => u('audio_fade_in', parseFloat(e.target.value) || 0)} min="0" step="0.5" />
                </div>
                <div className="input-group" style={{ flex: 1 }}>
                  <label>Fade Out (sec)</label>
                  <input type="number" className="input-field" value={settings.audio_fade_out} onChange={e => u('audio_fade_out', parseFloat(e.target.value) || 0)} min="0" step="0.5" />
                </div>
              </div>
            </>
          )}
        </SettingSection>

        {/* Brightness / Contrast */}
        <SettingSection icon={Sun} title="Brightness & Contrast" enabled={settings.adjust_enabled} onToggle={v => u('adjust_enabled', v)}>
          {settings.adjust_enabled && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="input-group">
                <label>Brightness ({settings.brightness > 0 ? '+' : ''}{settings.brightness})</label>
                <input type="range" min="-1" max="1" step="0.05" value={settings.brightness} onChange={e => u('brightness', parseFloat(e.target.value))} className="range-slider" />
              </div>
              <div className="input-group">
                <label>Contrast ({settings.contrast}x)</label>
                <input type="range" min="0" max="3" step="0.05" value={settings.contrast} onChange={e => u('contrast', parseFloat(e.target.value))} className="range-slider" />
              </div>
              <div className="input-group">
                <label>Saturation ({settings.saturation}x)</label>
                <input type="range" min="0" max="3" step="0.05" value={settings.saturation} onChange={e => u('saturation', parseFloat(e.target.value))} className="range-slider" />
              </div>
              <div className="input-group">
                <label>Sharpness ({settings.sharpness > 0 ? '+' : ''}{settings.sharpness})</label>
                <input type="range" min="-1.5" max="1.5" step="0.1" value={settings.sharpness} onChange={e => u('sharpness', parseFloat(e.target.value))} className="range-slider" />
              </div>
              <div className="input-group">
                <label>Hue Shift ({settings.hue > 0 ? '+' : ''}{settings.hue}°)</label>
                <input type="range" min="-180" max="180" step="1" value={settings.hue} onChange={e => u('hue', parseInt(e.target.value))} className="range-slider" />
              </div>
            </div>
          )}
        </SettingSection>

        {/* Watermark */}
        <SettingSection icon={Type} title="Watermark / Text" enabled={settings.watermark_enabled} onToggle={v => u('watermark_enabled', v)}>
          {settings.watermark_enabled && (
            <>
              <div className="input-group">
                <label>Text</label>
                <input type="text" className="input-field" value={settings.watermark_text} onChange={e => u('watermark_text', e.target.value)} placeholder="Your watermark text" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.75rem' }}>
                <div className="input-group">
                  <label>Position</label>
                  <select className="input-field" value={settings.watermark_position} onChange={e => u('watermark_position', e.target.value)}>
                    {WATERMARK_POSITIONS.map(wp => <option key={wp.value} value={wp.value}>{wp.label}</option>)}
                  </select>
                </div>
                <div className="input-group">
                  <label>Font Size</label>
                  <input type="number" className="input-field" value={settings.watermark_font_size} onChange={e => u('watermark_font_size', parseInt(e.target.value) || 24)} min="8" max="200" />
                </div>
                <div className="input-group">
                  <label>Color</label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input type="color" value={settings.watermark_color} onChange={e => u('watermark_color', e.target.value)} style={{ width: '36px', height: '32px', border: 'none', cursor: 'pointer', borderRadius: '6px', background: 'transparent' }} />
                    <input type="text" className="input-field" value={settings.watermark_color} onChange={e => u('watermark_color', e.target.value)} style={{ flex: 1 }} />
                  </div>
                </div>
                <div className="input-group">
                  <label>Opacity ({Math.round(settings.watermark_opacity * 100)}%)</label>
                  <input type="range" min="0" max="1" step="0.05" value={settings.watermark_opacity} onChange={e => u('watermark_opacity', parseFloat(e.target.value))} className="range-slider" />
                </div>
              </div>
            </>
          )}
        </SettingSection>

        {/* Rotation / Flip */}
        <SettingSection icon={RotateCw} title="Rotation & Flip">
          <div className="preset-buttons" style={{ marginBottom: '1rem' }}>
            {[0, 90, 180, 270].map(deg => (
              <button key={deg} type="button" className={`preset-btn ${settings.rotation === deg ? 'active' : ''}`} onClick={() => u('rotation', deg)}>{deg}°</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            <label className="checkbox-group">
              <input type="checkbox" checked={settings.flip_horizontal} onChange={e => u('flip_horizontal', e.target.checked)} />
              <span><FlipHorizontal size={16} style={{ display: 'inline', marginBottom: '-3px' }} /> Flip H</span>
            </label>
            <label className="checkbox-group">
              <input type="checkbox" checked={settings.flip_vertical} onChange={e => u('flip_vertical', e.target.checked)} />
              <span><FlipVertical size={16} style={{ display: 'inline', marginBottom: '-3px' }} /> Flip V</span>
            </label>
          </div>
        </SettingSection>

        {/* Quality */}
        <SettingSection icon={Sparkles} title="Quality" defaultOpen={true}>
          <div className="quality-options">
            {QUALITY_OPTIONS.map(q => (
              <button key={q.value} type="button" className={`quality-btn ${settings.quality === q.value ? 'active' : ''}`} onClick={() => u('quality', q.value)}>
                <span className="quality-label">{q.label}</span>
                <span className="quality-desc">{q.desc}</span>
              </button>
            ))}
          </div>
        </SettingSection>

        {/* Output */}
        <SettingSection icon={Settings} title="Output" defaultOpen={true}>
          <div className="input-group" style={{ marginBottom: '1rem' }}>
            <label>Output Format</label>
            <select className="input-field" value={settings.output_format} onChange={e => u('output_format', e.target.value)}>
              <option value="mp4">MP4 (H.264/AAC)</option>
              <option value="mov">MOV (H.264/AAC)</option>
              <option value="mkv">MKV (H.264/AAC)</option>
              <option value="webm">WebM (VP9)</option>
              <option value="gif">GIF</option>
            </select>
          </div>
          <div className="input-group">
            <label>Subfolder Name</label>
            <input type="text" className="input-field" value={settings.output_subfolder} onChange={e => u('output_subfolder', e.target.value)} placeholder="processed" />
          </div>
          <p className="hint-text">
            Saved to: <br /><code>{folderPath ? `${folderPath}/${settings.output_subfolder}/` : '...'}</code>
          </p>
        </SettingSection>
      </div>

      {/* ── Process Button ───────────────────────────── */}
      <button type="button" className="btn-primary" onClick={startProcessing} disabled={loading || !folderPath} style={{ marginTop: '0.5rem' }}>
        <Play size={20} style={{ display: 'inline', marginBottom: '-4px', marginRight: '8px' }} />
        {loading ? 'Starting...' : 'Process Videos'}
      </button>

      {/* ── Jobs ─────────────────────────────────────── */}
      {jobs.length > 0 && (
        <div className="reports-section">
          <h2 style={{ marginBottom: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Film size={24} /> Processing Jobs
          </h2>
          <div className="jobs-list">
            {jobs.map(job => (
              <div key={job.id} className="job-card glass-panel" style={{ padding: '1.5rem', marginTop: '1rem' }}>
                <div className="job-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="job-handle" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FolderOpen size={20} />{job.folder_path}
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div className={`status-badge status-${job.status}`}>{job.status}</div>
                    {job.status === 'processing' && (
                      <button type="button" onClick={() => cancelJob(job.id)} className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.8rem', borderColor: 'var(--error)', color: 'var(--error)' }}>
                        <XSquare size={14} style={{ marginRight: '4px', marginBottom: '-2px', display: 'inline' }} />
                        Stop
                      </button>
                    )}
                  </div>
                </div>
                {job.status === 'processing' && (
                  <div className="processing-bar-outer">
                    <div className="processing-bar-inner" style={{ width: job.total_files > 0 ? `${(job.processed_files / job.total_files) * 100}%` : '0%' }} />
                  </div>
                )}
                <div className="progress-text">
                  {job.status === 'processing' && <Loader size={14} className="spin" style={{ marginRight: '6px', display: 'inline' }} />}
                  {job.progress}
                </div>
                {job.current_file && (
                  <div className="progress-text" style={{ color: 'var(--accent-primary)' }}>
                    Current: {job.current_file} &bull; {job.processed_files}/{job.total_files}
                  </div>
                )}
                {job.error && (
                  <div className="progress-text" style={{ color: 'var(--error)' }}>
                    <AlertCircle size={14} style={{ marginRight: '4px', display: 'inline', marginBottom: '-2px' }} />{job.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Folder Contents ──────────────────────────── */}
      {files.length > 0 && (
        <div className="reports-section">
          <h2 style={{ marginBottom: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileVideo size={24} /> Folder Contents
            <span className="file-count-badge">{files.length} file(s)</span>
          </h2>
          {originalFiles.length > 0 && (
            <>
              <h3 className="file-section-label">Original Videos</h3>
              <div className="file-list">
                {originalFiles.map((f, i) => (
                  <div key={i} className="file-item">
                    <FileVideo size={18} className="file-icon" />
                    <span className="file-name">{f.name}</span>
                    <span className="file-size">{formatSize(f.size)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {processedFiles.length > 0 && (
            <>
              <h3 className="file-section-label" style={{ marginTop: '1.5rem' }}>
                <CheckCircle size={16} style={{ color: 'var(--success)', marginRight: '6px', display: 'inline', marginBottom: '-3px' }} />
                Processed Videos
              </h3>
              <div className="file-list">
                {processedFiles.map((f, i) => (
                  <div key={i} className="file-item file-item-processed">
                    <CheckCircle size={18} className="file-icon" style={{ color: 'var(--success)' }} />
                    <span className="file-name">{f.name}</span>
                    <span className="file-size">{formatSize(f.size)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default VideoEditor;
