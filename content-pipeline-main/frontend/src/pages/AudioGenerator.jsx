import { useState, useEffect } from 'react';
import {
  Mic, FolderOpen, Play, Search, FileVideo, Volume2,
  CheckCircle, AlertCircle, Loader, Settings,
  ChevronDown, ChevronRight, Music, Headphones, Languages, X
} from 'lucide-react';

const AUDIO_MODES = [
  { label: 'Replace Audio', value: 'replace', desc: 'Remove original audio, use only TTS' },
  { label: 'Mix Together', value: 'mix', desc: 'Blend TTS with original audio' },
  { label: 'TTS Primary', value: 'background', desc: 'TTS loud, original audio as background' },
];

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function SettingSection({ icon: Icon, title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="glass-panel setting-card">
      <div className="setting-header" onClick={() => setOpen(o => !o)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 className="setting-title" style={{ marginBottom: 0 }}>
          <Icon size={18} /> {title}
        </h3>
        {open ? <ChevronDown size={18} style={{ color: 'var(--text-secondary)' }} /> : <ChevronRight size={18} style={{ color: 'var(--text-secondary)' }} />}
      </div>
      {open && <div style={{ marginTop: '1rem' }}>{children}</div>}
    </div>
  );
}

function AudioGenerator() {
  const [folderPath, setFolderPath] = useState('');
  const [files, setFiles] = useState([]);
  const [activeVideo, setActiveVideo] = useState(null);
  const [voices, setVoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [voiceFilter, setVoiceFilter] = useState('');
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [customPrompt, setCustomPrompt] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  const [settings, setSettings] = useState({
    text: '',
    per_video_texts: {},
    voice: 'en-US-AriaNeural',
    rate: 0,
    tts_volume: 0,
    audio_mode: 'replace',
    audio_volume: 1.0,
    original_volume: 0.3,
    output_subfolder: 'with_audio',
  });

  // Fetch voices on mount
  useEffect(() => {
    fetch('http://localhost:8000/api/audio-gen/voices')
      .then(r => r.ok ? r.json() : [])
      .then(setVoices)
      .catch(() => {});
  }, []);

  // Poll jobs
  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/audio-gen/jobs');
        if (res.ok) setJobs((await res.json()).reverse());
      } catch (err) { /* ignore */ }
    };
    fetchJobs();
    const interval = setInterval(fetchJobs, 2000);
    return () => clearInterval(interval);
  }, []);

  const scanFolder = async () => {
    if (!folderPath) return;
    setScanning(true);
    try {
      const res = await fetch('http://localhost:8000/api/audio-gen/list-folder', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_path: folderPath }),
      });
      if (res.ok) setFiles(await res.json());
    } catch (err) { console.error('Failed to scan folder'); }
    finally { setScanning(false); }
  };

  const startProcessing = async () => {
    const isAuto = settings.auto_generate_scripts;
    if (!folderPath || (!isAuto && !settings.text && Object.keys(settings.per_video_texts).length === 0)) return;
    setLoading(true);
    const settingsWithAI = {
      ...settings,
      gemini_api_key: apiKey || null,
      custom_prompt: customPrompt || null
    };
    try {
      const res = await fetch('http://localhost:8000/api/audio-gen/process', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_path: folderPath, settings: settingsWithAI }),
      });
      if (!res.ok) { const e = await res.json(); alert(e.detail || 'Failed'); }
    } catch (err) { alert('Error connecting to backend'); }
    finally { setLoading(false); }
  };

  const handleAutoAnalyze = async () => {
    if (!folderPath) return;
    setAnalyzing(true);
    if (apiKey) {
      localStorage.setItem('gemini_api_key', apiKey);
    } else {
      localStorage.removeItem('gemini_api_key');
    }

    try {
      const res = await fetch('http://localhost:8000/api/audio-gen/auto-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folder_path: folderPath,
          api_key: apiKey || null,
          custom_prompt: customPrompt || null
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.scripts) {
          // Check if the API returned an error string
          let apiError = null;
          for (const key in data.scripts) {
            const val = data.scripts[key];
            if (val.includes('API Error:') || val.includes('Error during AI analysis:')) {
              apiError = val;
              break;
            }
          }

          if (apiError) {
            // Friendly warning detailing the Google API error and troubleshooting advice
            alert(
              `⚠️ Gemini API Key Issue Detected:\n\n` +
              `Google API returned the following error:\n` +
              `"${apiError.split('Fallback:')[0].trim()}"\n\n` +
              `How to fix:\n` +
              `1. Ensure you have enabled the "Generative Language API" inside Google Cloud Platform Console for this project/key.\n` +
              `2. Alternatively, get a free, instantly active API key from Google AI Studio (aistudio.google.com).\n\n` +
              `🔄 We have automatically triggered local metadata analysis to generate scripts for you anyway!`
            );

            // Fetch fallback heuristic scripts
            const fallbackRes = await fetch('http://localhost:8000/api/audio-gen/auto-analyze', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                folder_path: folderPath,
                api_key: null,
                custom_prompt: customPrompt || null
              })
            });

            if (fallbackRes.ok) {
              const fallbackData = await fallbackRes.json();
              if (fallbackData.scripts) {
                setSettings(s => ({
                  ...s,
                  per_video_texts: { ...s.per_video_texts, ...fallbackData.scripts },
                  text: ''
                }));
              }
            }
          } else {
            setSettings(s => ({
              ...s,
              per_video_texts: { ...s.per_video_texts, ...data.scripts },
              text: ''
            }));
            alert('Successfully generated custom scripts for ' + Object.keys(data.scripts).length + ' video(s)! Check "Per-Video Text" below.');
          }

          if (files.length === 0) {
            await scanFolder();
          }
        }
      } else {
        const err = await res.json();
        alert('Analysis failed: ' + (err.detail || 'Unknown error'));
      }
    } catch (e) {
      alert('Error connecting to backend: ' + e.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const u = (key, value) => setSettings(s => ({ ...s, [key]: value }));

  const setPerVideoText = (filename, text) => {
    setSettings(s => ({
      ...s,
      per_video_texts: { ...s.per_video_texts, [filename]: text }
    }));
  };

  const selectedVoice = voices.find(v => v.id === settings.voice);
  const filteredVoices = voices.filter(v =>
    !voiceFilter || v.name.toLowerCase().includes(voiceFilter.toLowerCase()) ||
    v.lang.toLowerCase().includes(voiceFilter.toLowerCase()) ||
    v.gender.toLowerCase().includes(voiceFilter.toLowerCase())
  );

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Audio Generator</h1>
        <p>Generate AI voiceovers and attach them to your videos</p>
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

      {/* ── Text Input ───────────────────────────────── */}
      <div className="glass-panel">
        <h3 className="setting-title"><Mic size={18} /> Narration Text</h3>
        <div className="input-group">
          <label>Global Text (applies to all videos)</label>
          <textarea
            className="input-field"
            rows={5}
            placeholder="Enter the text you want the AI to speak over your videos..."
            value={settings.text}
            onChange={e => u('text', e.target.value)}
            style={{ resize: 'vertical', minHeight: '100px', lineHeight: '1.6' }}
          />
        </div>
        <p className="hint-text" style={{ marginTop: '0.5rem' }}>
          This text will be converted to speech and attached to all videos. You can also set per-video text below after scanning.
        </p>

        {/* ── ✨ AI Script Auto-Generator ────────────────── */}
        <div style={{
          marginTop: '1.5rem', paddingTop: '1.25rem',
          borderTop: '1px solid rgba(255,255,255,0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h4 style={{ margin: 0, fontSize: '0.92rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              ✨ AI Script Auto-Generator
            </h4>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Powered by Gemini / Heuristics</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="input-group">
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Gemini API Key (Optional — for visual video frame analysis)</label>
              <input
                type="password"
                className="input-field"
                placeholder="Paste Gemini API Key here..."
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                style={{ fontSize: '0.85rem' }}
              />
              <span className="hint-text">Leave blank to use metadata / local text heuristics analysis.</span>
            </div>

            <div className="input-group">
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Custom Prompt / Style (Optional)</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Write a funny, high-energy gaming voiceover script"
                value={customPrompt}
                onChange={e => setCustomPrompt(e.target.value)}
                style={{ fontSize: '0.85rem' }}
              />
            </div>

            <button
              type="button"
              className="btn-secondary"
              disabled={analyzing || !folderPath}
              onClick={handleAutoAnalyze}
              style={{
                background: 'rgba(139, 92, 246, 0.15)', border: '1px solid rgba(139, 92, 246, 0.3)',
                color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                marginTop: '0.5rem', fontWeight: 600
              }}
            >
              {analyzing ? (
                <>
                  <Loader size={14} className="spin" /> Generating AI Scripts...
                </>
              ) : (
                <>
                  ✨ Auto-Analyze & Generate Scripts
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Settings ─────────────────────────────────── */}
      <div className="settings-grid">

        {/* Voice Selection */}
        <SettingSection icon={Languages} title="Voice" defaultOpen={true}>
          {selectedVoice && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.75rem 1rem', borderRadius: '12px',
              background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.25)',
              marginBottom: '1rem'
            }}>
              <Headphones size={20} style={{ color: 'var(--accent-primary)' }} />
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedVoice.name}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{selectedVoice.lang} • {selectedVoice.gender}</div>
              </div>
            </div>
          )}
          <div className="input-group" style={{ marginBottom: '0.75rem' }}>
            <input
              type="text"
              className="input-field"
              placeholder="Search voices..."
              value={voiceFilter}
              onChange={e => setVoiceFilter(e.target.value)}
              style={{ fontSize: '0.85rem' }}
            />
          </div>
          <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {filteredVoices.map(v => (
              <button
                key={v.id}
                type="button"
                className={`voice-option ${settings.voice === v.id ? 'active' : ''}`}
                onClick={() => u('voice', v.id)}
              >
                <span className="voice-name">{v.name}</span>
                <span className="voice-meta">{v.lang} • {v.gender}</span>
              </button>
            ))}
          </div>
        </SettingSection>

        {/* Audio Mode */}
        <SettingSection icon={Music} title="Audio Mode" defaultOpen={true}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {AUDIO_MODES.map(m => (
              <button
                key={m.value}
                type="button"
                className={`quality-btn ${settings.audio_mode === m.value ? 'active' : ''}`}
                onClick={() => u('audio_mode', m.value)}
                style={{ flexDirection: 'row', gap: '0.75rem', alignItems: 'center' }}
              >
                <span className="quality-label">{m.label}</span>
                <span className="quality-desc" style={{ marginTop: 0 }}>{m.desc}</span>
              </button>
            ))}
          </div>

          {settings.audio_mode !== 'replace' && (
            <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
              <div className="input-group" style={{ flex: 1 }}>
                <label>TTS Volume ({Math.round(settings.audio_volume * 100)}%)</label>
                <input type="range" min="0" max="2" step="0.05" value={settings.audio_volume} onChange={e => u('audio_volume', parseFloat(e.target.value))} className="range-slider" />
              </div>
              <div className="input-group" style={{ flex: 1 }}>
                <label>Original Vol ({Math.round(settings.original_volume * 100)}%)</label>
                <input type="range" min="0" max="1" step="0.05" value={settings.original_volume} onChange={e => u('original_volume', parseFloat(e.target.value))} className="range-slider" />
              </div>
            </div>
          )}
        </SettingSection>

        {/* Speed & Volume */}
        <SettingSection icon={Volume2} title="Voice Speed & Volume">
          <div className="input-group">
            <label>Speed ({settings.rate >= 0 ? '+' : ''}{settings.rate}%)</label>
            <input type="range" min="-50" max="100" step="5" value={settings.rate} onChange={e => u('rate', parseInt(e.target.value))} className="range-slider" />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              <span>Slower</span><span>Normal</span><span>Faster</span>
            </div>
          </div>
          <div className="input-group" style={{ marginTop: '1rem' }}>
            <label>Volume ({settings.tts_volume >= 0 ? '+' : ''}{settings.tts_volume}%)</label>
            <input type="range" min="-50" max="50" step="5" value={settings.tts_volume} onChange={e => u('tts_volume', parseInt(e.target.value))} className="range-slider" />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              <span>Quieter</span><span>Normal</span><span>Louder</span>
            </div>
          </div>
        </SettingSection>

        {/* Output */}
        <SettingSection icon={Settings} title="Output" defaultOpen={true}>
          <div className="input-group">
            <label>Subfolder Name</label>
            <input type="text" className="input-field" value={settings.output_subfolder} onChange={e => u('output_subfolder', e.target.value)} placeholder="with_audio" />
          </div>
          <p className="hint-text">
            Saved to: <br /><code>{folderPath ? `${folderPath}/${settings.output_subfolder}/` : '...'}</code>
          </p>
        </SettingSection>
      </div>

      {/* ── Per-Video Text (shows after scan) ─────────── */}
      {files.length > 0 && (
        <div className="glass-panel">
          <h3 className="setting-title"><FileVideo size={18} /> Per-Video Text (Optional)</h3>
          <p className="hint-text" style={{ marginBottom: '1rem' }}>
            Override the global text for specific videos. Leave blank to use the global text above.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {files.map(f => (
              <div key={f.name} style={{
                padding: '0.75rem 1rem', borderRadius: '12px',
                background: 'rgba(10, 14, 26, 0.4)', border: '1px solid var(--surface-border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <FileVideo size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.88rem', fontWeight: 500 }}>{f.name}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>{formatSize(f.size)}</span>
                </div>
                <textarea
                  className="input-field"
                  rows={2}
                  placeholder="Use global text"
                  value={settings.per_video_texts[f.name] || ''}
                  onChange={e => setPerVideoText(f.name, e.target.value)}
                  style={{ resize: 'vertical', fontSize: '0.85rem', lineHeight: '1.5' }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ✨ AI Automation Options ────────────────── */}
      <div className="glass-panel" style={{ marginTop: '1rem', border: '1px solid rgba(139, 92, 246, 0.25)', background: 'rgba(139, 92, 246, 0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <input
            type="checkbox"
            id="auto_generate_scripts"
            checked={settings.auto_generate_scripts || false}
            onChange={e => u('auto_generate_scripts', e.target.checked)}
            style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
          />
          <label htmlFor="auto_generate_scripts" style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', flexDirection: 'column' }}>
            <span>⚡ Direct End-to-End AI Narration</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              Automatically visual-analyzes videos, writes content-tailored scripts, and merges AI voiceovers in one click.
            </span>
          </label>
        </div>
      </div>

      {/* ── Process Button ───────────────────────────── */}
      <button
        type="button"
        className="btn-primary"
        onClick={startProcessing}
        disabled={loading || !folderPath || (!settings.auto_generate_scripts && !settings.text && Object.keys(settings.per_video_texts).length === 0)}
        style={{ marginTop: '1rem' }}
      >
        <Play size={20} style={{ display: 'inline', marginBottom: '-4px', marginRight: '8px' }} />
        {loading ? 'Starting...' : 'Generate & Attach Audio'}
      </button>

      {/* ── Jobs ─────────────────────────────────────── */}
      {jobs.length > 0 && (
        <div className="reports-section">
          <h2 style={{ marginBottom: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Music size={24} /> Audio Jobs
          </h2>
          <div className="jobs-list">
            {jobs.map(job => (
              <div key={job.id} className="job-card glass-panel" style={{ padding: '1.5rem', marginTop: '1rem' }}>
                <div className="job-header">
                  <div className="job-handle"><FolderOpen size={20} />{job.folder_path}</div>
                  <div className={`status-badge status-${job.status}`}>{job.status}</div>
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

                {/* Generated Videos List for Completed Job */}
                {job.status === 'completed' && job.output_files && job.output_files.length > 0 && (
                  <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.75rem' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle size={14} style={{ color: 'var(--success)' }} /> Generated Videos:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {job.output_files.map((f, idx) => (
                        <div key={idx} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)',
                          borderRadius: '8px', padding: '0.5rem 0.75rem'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                            <FileVideo size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{f.name}</span>
                          </div>
                          <button
                            type="button"
                            className="btn-primary"
                            style={{
                              padding: '0.35rem 0.7rem', fontSize: '0.75rem', height: 'auto',
                              background: 'var(--accent-gradient)', border: 'none', display: 'flex', alignItems: 'center', gap: '4px'
                            }}
                            onClick={() => setActiveVideo({ name: f.name, path: f.path })}
                          >
                            <Play size={10} /> Listen Video
                          </button>
                        </div>
                      ))}
                    </div>
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
            <FileVideo size={24} /> Videos in Folder
            <span className="file-count-badge">{files.length} file(s)</span>
          </h2>
          <div className="file-list">
            {files.map((f, i) => (
              <div key={i} className="file-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, overflow: 'hidden' }}>
                  <FileVideo size={18} className="file-icon" />
                  <span className="file-name" style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{f.name}</span>
                  <span className="file-size">{formatSize(f.size)}</span>
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', height: 'auto', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}
                  onClick={() => setActiveVideo({ name: f.name, path: f.path })}
                >
                  <Play size={12} /> Play Original
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Video Player Modal Overlay ───────────────── */}
      {activeVideo && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(10, 14, 26, 0.85)', backdropFilter: 'blur(12px)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem', animation: 'fadeIn 0.2s ease'
        }} onClick={() => setActiveVideo(null)}>
          <div className="glass-panel" style={{
            width: '100%', maxWidth: '800px', background: 'rgba(18, 24, 46, 0.95)',
            border: '1px solid rgba(139, 92, 246, 0.25)', borderRadius: '16px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)', overflow: 'hidden'
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Headphones size={18} style={{ color: 'var(--accent-primary)' }} />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Listen & Preview: {activeVideo.name}</h3>
              </div>
              <button
                type="button"
                style={{
                  background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '50%',
                  width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'var(--text-secondary)', transition: 'all 0.2s'
                }}
                onClick={() => setActiveVideo(null)}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '1.5rem', background: '#0a0e1a', display: 'flex', justifyContent: 'center' }}>
              <video
                controls
                autoPlay
                src={`http://localhost:8000/api/audio-gen/stream?file_path=${encodeURIComponent(activeVideo.path)}`}
                style={{ width: '100%', maxHeight: '60vh', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
              />
            </div>
            <div style={{
              padding: '1rem 1.5rem', background: 'rgba(18, 24, 46, 0.4)',
              borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem'
            }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>File location: <code>{activeVideo.path}</code></span>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', height: 'auto', flexShrink: 0 }}
                onClick={() => setActiveVideo(null)}
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AudioGenerator;
