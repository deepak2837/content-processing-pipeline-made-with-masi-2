import { useState, useEffect, useRef } from 'react';
import { 
  Play, CheckCircle, AlertCircle, Loader, Settings, Send, 
  FolderOpen, Eye, Info, ChevronDown, ChevronUp, Download, Terminal, RefreshCw
} from 'lucide-react';

// Custom inline SVG components to support systems running older versions of lucide-react (< v0.300)
const InstagramIcon = ({ size = 20, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
  </svg>
);

const FacebookIcon = ({ size = 20, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
  </svg>
);

const YoutubeIcon = ({ size = 20, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"></path>
    <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"></polygon>
  </svg>
);

export default function AutomationPipeline() {
  const [handle, setHandle] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [selectedPlatforms, setSelectedPlatforms] = useState(['instagram']);
  const [loading, setLoading] = useState(false);
  const [runs, setRuns] = useState([]);
  const [selectedRun, setSelectedRun] = useState(null);
  
  // Settings panels states
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeStepTab, setActiveStepTab] = useState('step1');

  // Step Configurations
  const [config, setConfig] = useState({
    // Step 1: Scraper
    download_reels: true,
    download_posts: false,
    download_captions: true,
    local_folder_override: '',
    // Step 2: Voiceover
    voice: 'en-US-AriaNeural',
    audio_mode: 'replace',
    custom_prompt: 'Generate a short, engaging voiceover script describing what is happening.',
    rate: 0,
    volume: 0,
    // Step 3: Subtitles styling
    sub_font_size: 16,
    sub_font_color: '&H00FFFFFF',
    sub_outline_color: '&H00000000',
    sub_outline_width: 2,
    sub_alignment: 2,
    // Step 4: Watermark
    watermark_mode: 'logo',
    watermark_logo_path: '',
    watermark_position: 'bottom-right',
    watermark_width: 150,
    watermark_opacity: 0.5,
    watermark_margin: 20,
    // Step 5: Scheduler Credentials
    use_simulated: true,
    meta_access_token: localStorage.getItem('meta_access_token') || '',
    instagram_business_id: localStorage.getItem('instagram_business_id') || '',
    facebook_page_id: localStorage.getItem('facebook_page_id') || '',
    youtube_access_token: localStorage.getItem('youtube_access_token') || '',
    public_video_url: localStorage.getItem('public_video_url') || ''
  });

  const consoleEndRef = useRef(null);

  useEffect(() => {
    fetchRuns();
    const interval = setInterval(fetchRuns, 3000);
    return () => clearInterval(interval);
  }, []);

  // Poll active selected run logs
  useEffect(() => {
    if (!selectedRun) return;
    const active = runs.find(r => r.id === selectedRun.id);
    if (active) {
      setSelectedRun(active);
    }
  }, [runs]);

  // Auto-scroll terminal console to bottom
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedRun?.logs]);

  const fetchRuns = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/pipeline/jobs');
      if (res.ok) {
        const data = await res.json();
        setRuns(data.reverse()); // Latest first
      }
    } catch (err) {
      console.error("Error fetching pipeline runs:", err);
    }
  };

  const updateConfig = (key, val) => {
    setConfig(prev => ({ ...prev, [key]: val }));
  };

  const startPipeline = async () => {
    if (!handle) {
      alert("Please specify a target Instagram handle!");
      return;
    }
    if (!geminiApiKey) {
      alert("A Gemini API Key is required for the visual script analysis and transcription steps!");
      return;
    }

    setLoading(true);
    try {
      localStorage.setItem('gemini_api_key', geminiApiKey);
      const payload = {
        handle: handle,
        gemini_api_key: geminiApiKey,
        download_reels: config.download_reels,
        download_posts: config.download_posts,
        download_captions: config.download_captions,
        local_folder_override: config.local_folder_override,
        voice: config.voice,
        audio_mode: config.audio_mode,
        custom_prompt: config.custom_prompt,
        rate: config.rate,
        volume: config.volume,
        subtitles_styling: {
          font_size: config.sub_font_size,
          font_color: config.sub_font_color,
          outline_color: config.sub_outline_color,
          outline_width: config.sub_outline_width,
          alignment: config.sub_alignment
        },
        watermark_mode: config.watermark_mode,
        watermark_logo_path: config.watermark_logo_path,
        watermark_position: config.watermark_position,
        watermark_width: config.watermark_width,
        watermark_opacity: config.watermark_opacity,
        watermark_margin: config.watermark_margin,
        platforms: selectedPlatforms,
        use_simulated: config.use_simulated,
        meta_access_token: config.meta_access_token,
        instagram_business_id: config.instagram_business_id,
        facebook_page_id: config.facebook_page_id,
        youtube_access_token: config.youtube_access_token,
        public_video_url: config.public_video_url
      };

      const res = await fetch('http://localhost:8000/api/pipeline/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const runData = await res.json();
        setSelectedRun(runData);
        setHandle('');
        fetchRuns();
      } else {
        const errData = await res.json();
        alert(errData.detail || "Failed to start pipeline");
      }
    } catch (err) {
      alert("Error connecting to backend API");
    } finally {
      setLoading(false);
    }
  };

  const togglePlatform = (plat) => {
    setSelectedPlatforms(prev => 
      prev.includes(plat) ? prev.filter(p => p !== plat) : [...prev, plat]
    );
  };

  // Helper to color code console lines
  const getConsoleLineStyle = (line) => {
    if (line.includes("❌") || line.includes("failed") || line.includes("CRASHED")) return { color: '#ef4444' };
    if (line.includes("✅") || line.includes("COMPLETE") || line.includes("SUCCESS")) return { color: '#10b981' };
    if (line.includes("🚀") || line.includes("STEP") || line.includes("🎉")) return { color: '#c084fc', fontWeight: 600 };
    if (line.includes("⚠️")) return { color: '#fbbf24' };
    return { color: '#e5e7eb' };
  };

  const getStepProgressIndex = (step) => {
    const steps = ["downloader", "narration", "subtitles", "watermark", "scheduler", "finished"];
    return steps.indexOf(step);
  };

  const currentStepIndex = selectedRun ? getStepProgressIndex(selectedRun.current_step) : -1;

  return (
    <div className="container">
      {/* ── Header ───────────────────────────────────── */}
      <header className="page-header">
        <div className="header-icon" style={{ background: 'var(--accent-gradient)' }}>
          <RefreshCw size={28} style={{ color: '#white' }} />
        </div>
        <div>
          <h1 className="page-title">Automation Pipeline</h1>
          <p className="page-subtitle">Batch-process reels from scraper downloading to AI narration, subtitle burning, framing, and final social scheduling</p>
        </div>
      </header>

      {/* ── Main Content Grid ────────────────────────── */}
      <div className="editor-grid" style={{ gridTemplateColumns: '1.2fr 1fr' }}>
        
        {/* Left Side: Setup Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 className="setting-title" style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Play size={18} /> Run New Pipeline
            </h3>
            
            <div className="input-group" style={{ marginTop: '1rem' }}>
              <label>Target Instagram Handle</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. ayogi_gamer"
                value={handle}
                onChange={e => setHandle(e.target.value)}
              />
            </div>

            <div className="input-group" style={{ marginTop: '1rem' }}>
              <label>Gemini API Key</label>
              <input
                type="password"
                className="input-field"
                placeholder="AI API Key for visual analysis & captions..."
                value={geminiApiKey}
                onChange={e => {
                  setGeminiApiKey(e.target.value);
                  localStorage.setItem('gemini_api_key', e.target.value);
                }}
              />
            </div>

            {/* Target Social Platform Badges */}
            <div className="input-group" style={{ marginTop: '1rem' }}>
              <label style={{ marginBottom: '0.5rem', display: 'block' }}>Target Scheduler Channels</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => togglePlatform('instagram')}
                  style={{
                    flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid',
                    background: selectedPlatforms.includes('instagram') ? 'rgba(225, 48, 108, 0.12)' : 'var(--surface-dark)',
                    borderColor: selectedPlatforms.includes('instagram') ? '#E1306C' : 'rgba(255,255,255,0.06)',
                    color: selectedPlatforms.includes('instagram') ? '#fff' : 'var(--text-secondary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer',
                    fontSize: '0.78rem', fontWeight: 600, transition: 'all 0.2s ease'
                  }}
                >
                  <InstagramIcon size={14} style={{ color: '#E1306C' }} /> Instagram
                </button>

                <button
                  type="button"
                  onClick={() => togglePlatform('facebook')}
                  style={{
                    flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid',
                    background: selectedPlatforms.includes('facebook') ? 'rgba(24, 119, 242, 0.12)' : 'var(--surface-dark)',
                    borderColor: selectedPlatforms.includes('facebook') ? '#1877F2' : 'rgba(255,255,255,0.06)',
                    color: selectedPlatforms.includes('facebook') ? '#fff' : 'var(--text-secondary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer',
                    fontSize: '0.78rem', fontWeight: 600, transition: 'all 0.2s ease'
                  }}
                >
                  <FacebookIcon size={14} style={{ color: '#1877F2' }} /> Facebook
                </button>

                <button
                  type="button"
                  onClick={() => togglePlatform('youtube')}
                  style={{
                    flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid',
                    background: selectedPlatforms.includes('youtube') ? 'rgba(255, 0, 0, 0.12)' : 'var(--surface-dark)',
                    borderColor: selectedPlatforms.includes('youtube') ? '#FF0000' : 'rgba(255,255,255,0.06)',
                    color: selectedPlatforms.includes('youtube') ? '#fff' : 'var(--text-secondary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer',
                    fontSize: '0.78rem', fontWeight: 600, transition: 'all 0.2s ease'
                  }}
                >
                  <YoutubeIcon size={14} style={{ color: '#FF0000' }} /> YouTube
                </button>
              </div>
            </div>
          </div>

          {/* Advanced Step presets (collapsible accordion) */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{
                width: '100%', background: 'none', border: 'none', color: 'var(--text-primary)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer',
                fontWeight: 600, fontSize: '0.88rem', padding: 0
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Settings size={16} /> Configure Pipeline Steps Settings</span>
              {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showAdvanced && (
              <div style={{ marginTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                {/* Horizontal tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', gap: '4px', marginBottom: '1rem', overflowX: 'auto', paddingBottom: '4px' }}>
                  {['step1', 'step2', 'step3', 'step4', 'step5'].map(tab => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveStepTab(tab)}
                      style={{
                        padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer',
                        fontSize: '0.75rem', fontWeight: activeStepTab === tab ? 700 : 500,
                        background: activeStepTab === tab ? 'var(--accent-primary)' : 'transparent',
                        color: activeStepTab === tab ? '#white' : 'var(--text-secondary)',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {tab === 'step1' && "1. Scraper"}
                      {tab === 'step2' && "2. Voiceover"}
                      {tab === 'step3' && "3. Subtitles"}
                      {tab === 'step4' && "4. Watermark"}
                      {tab === 'step5' && "5. Credentials"}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                {activeStepTab === 'step1' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    <div style={{ display: 'flex', gap: '15px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={config.download_reels} onChange={e => updateConfig('download_reels', e.target.checked)} /> Reels & Videos
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={config.download_posts} onChange={e => updateConfig('download_posts', e.target.checked)} /> Photos
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={config.download_captions} onChange={e => updateConfig('download_captions', e.target.checked)} /> Captions JSON
                      </label>
                    </div>
                    <div className="input-group" style={{ marginTop: '0.5rem' }}>
                      <label style={{ fontSize: '0.72rem' }}>Local Folder Override (Bypasses scraper download step)</label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="e.g. /Users/masi/Documents/newreels"
                        value={config.local_folder_override}
                        onChange={e => updateConfig('local_folder_override', e.target.value)}
                        style={{ height: '34px', fontSize: '0.78rem' }}
                      />
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>
                        If provided, the pipeline skips downloading and processes the local files directly. If left blank, it will crawl the handle, falling back automatically to <code>/Users/masi/Documents/newreels</code> on scrape failure.
                      </span>
                    </div>
                  </div>
                )}

                {activeStepTab === 'step2' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    <div className="input-group">
                      <label style={{ fontSize: '0.72rem' }}>Narrator Voice (edge-tts)</label>
                      <select className="input-field" value={config.voice} onChange={e => updateConfig('voice', e.target.value)} style={{ fontSize: '0.78rem', height: '34px' }}>
                        <option value="en-US-AriaNeural">Aria (Female US)</option>
                        <option value="en-US-GuyNeural">Guy (Male US)</option>
                        <option value="en-GB-SoniaNeural">Sonia (Female UK)</option>
                        <option value="en-IN-PrabhatNeural">Prabhat (Male India)</option>
                      </select>
                    </div>
                    <div className="input-group">
                      <label style={{ fontSize: '0.72rem' }}>AI Prompt Guidelines</label>
                      <input type="text" className="input-field" value={config.custom_prompt} onChange={e => updateConfig('custom_prompt', e.target.value)} style={{ fontSize: '0.78rem', height: '34px' }} />
                    </div>
                  </div>
                )}

                {activeStepTab === 'step3' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <div className="input-group" style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.72rem' }}>Font Size</label>
                        <input type="number" className="input-field" value={config.sub_font_size} onChange={e => updateConfig('sub_font_size', parseInt(e.target.value) || 16)} style={{ fontSize: '0.78rem', height: '34px' }} />
                      </div>
                      <div className="input-group" style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.72rem' }}>Color (ASS format)</label>
                        <input type="text" className="input-field" value={config.sub_font_color} onChange={e => updateConfig('sub_font_color', e.target.value)} style={{ fontSize: '0.78rem', height: '34px' }} />
                      </div>
                    </div>
                  </div>
                )}

                {activeStepTab === 'step4' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    <div className="input-group">
                      <label style={{ fontSize: '0.72rem' }}>Overlay Mode</label>
                      <select className="input-field" value={config.watermark_mode} onChange={e => updateConfig('watermark_mode', e.target.value)} style={{ fontSize: '0.78rem', height: '34px' }}>
                        <option value="logo">Standard Logo (Corner)</option>
                        <option value="frame">Full Screen Frame (Border/Template)</option>
                      </select>
                    </div>
                    <div className="input-group">
                      <label style={{ fontSize: '0.72rem' }}>Logo/Frame Image Path</label>
                      <input type="text" className="input-field" placeholder="e.g. /Users/masi/Documents/logo.png" value={config.watermark_logo_path} onChange={e => updateConfig('watermark_logo_path', e.target.value)} style={{ fontSize: '0.78rem', height: '34px' }} />
                    </div>
                  </div>
                )}

                {activeStepTab === 'step5' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-primary)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={config.use_simulated} onChange={e => updateConfig('use_simulated', e.target.checked)} /> Use Simulated Social Posting
                    </label>
                    {!config.use_simulated && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: '2px solid rgba(255,255,255,0.06)', paddingLeft: '8px', marginTop: '4px' }}>
                        <div className="input-group">
                          <label style={{ fontSize: '0.65rem' }}>Meta Access Token</label>
                          <input type="password" className="input-field" value={config.meta_access_token} onChange={e => updateConfig('meta_access_token', e.target.value)} style={{ height: '28px', fontSize: '0.75rem' }} />
                        </div>
                        <div className="input-group">
                          <label style={{ fontSize: '0.65rem' }}>YouTube Access Token</label>
                          <input type="password" className="input-field" value={config.youtube_access_token} onChange={e => updateConfig('youtube_access_token', e.target.value)} style={{ height: '28px', fontSize: '0.75rem' }} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            className="btn-primary"
            disabled={loading || !handle || !geminiApiKey}
            onClick={startPipeline}
            style={{ height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            {loading ? (
              <>
                <Loader size={20} className="spin" /> Triggering Scraper...
              </>
            ) : (
              <>
                <Play size={20} fill="currentColor" /> Launch Automation Pipeline
              </>
            )}
          </button>
        </div>

        {/* Right Side: Live Visual Flow & Scrolling Terminal logs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Visual Step Progress Flow Node Diagram */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <h4 style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.85rem' }}>
              Pipeline Step Flow
            </h4>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', padding: '0 8px' }}>
              
              {/* Connection progress lines */}
              <div style={{
                position: 'absolute', top: '15px', left: '20px', right: '20px', height: '2px',
                background: 'rgba(255, 255, 255, 0.05)', zIndex: 1
              }} />
              {selectedRun && currentStepIndex >= 0 && (
                <div style={{
                  position: 'absolute', top: '15px', left: '20px', 
                  width: `${Math.min(100, (currentStepIndex / 5) * 100)}%`,
                  height: '2px', background: 'var(--accent-gradient)', zIndex: 2,
                  transition: 'width 0.5s ease-out'
                }} />
              )}

              {/* Node items */}
              {[
                { name: 'Scrape', step: 'downloader' },
                { name: 'Narrate', step: 'narration' },
                { name: 'Subtitles', step: 'subtitles' },
                { name: 'Branding', step: 'watermark' },
                { name: 'Schedule', step: 'scheduler' }
              ].map((n, idx) => {
                const isPassed = currentStepIndex > idx || (selectedRun?.status === 'completed');
                const isActive = selectedRun?.status === 'running' && selectedRun?.current_step === n.step;
                
                return (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', zIndex: 5 }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '999px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.75rem', fontWeight: 700,
                      background: isPassed 
                        ? 'var(--accent-gradient)' 
                        : isActive 
                          ? 'rgba(139, 92, 246, 0.15)' 
                          : 'var(--surface-dark)',
                      border: isPassed 
                        ? 'none' 
                        : isActive 
                          ? '2px solid var(--accent-primary)' 
                          : '2px solid rgba(255,255,255,0.06)',
                      boxShadow: isActive ? '0 0 10px rgba(139, 92, 246, 0.5)' : 'none',
                      color: isPassed || isActive ? '#fff' : 'var(--text-secondary)',
                      transition: 'all 0.3s ease-out',
                      animation: isActive ? 'pulse 1.5s infinite alternate' : 'none'
                    }}>
                      {isPassed ? "✓" : idx + 1}
                    </div>
                    <span style={{
                      fontSize: '0.68rem', fontWeight: isActive ? 700 : 500,
                      color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)'
                    }}>
                      {n.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Scrolling Stdout Terminal Console */}
          <div className="glass-panel" style={{
            padding: '1.25rem', display: 'flex', flexDirection: 'column', flex: 1,
            background: '#070a13', border: '1px solid rgba(139,92,246,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h4 style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Terminal size={14} /> Pipeline Console Outputs
              </h4>
              {selectedRun && (
                <div style={{ fontSize: '0.72rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                  RUN: {selectedRun.id.substring(0, 8)}... ({selectedRun.progress}%)
                </div>
              )}
            </div>

            {/* Terminal Window content */}
            <div style={{
              flex: 1, minHeight: '300px', maxHeight: '350px', overflowY: 'auto',
              background: '#03050b', border: '1px solid rgba(255,255,255,0.02)',
              borderRadius: '6px', padding: '1rem', fontFamily: 'monospace', fontSize: '0.78rem',
              lineHeight: '1.5', display: 'flex', flexDirection: 'column', gap: '6px'
            }}>
              {!selectedRun ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.15)' }}>
                  <Terminal size={32} style={{ marginBottom: '0.5rem' }} />
                  <span>No pipeline active. Configure details and launch to stream output logs.</span>
                </div>
              ) : (
                <>
                  {selectedRun.logs.map((log, idx) => (
                    <div key={idx} style={getConsoleLineStyle(log)}>
                      {log}
                    </div>
                  ))}
                  <div ref={consoleEndRef} />
                </>
              )}
            </div>
          </div>

          {/* Job History list */}
          <div className="glass-panel" style={{ padding: '1.25rem', maxHeight: '180px', overflowY: 'auto' }}>
            <h4 style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
              Pipeline Executions History
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {runs.map(run => (
                <div
                  key={run.id}
                  onClick={() => setSelectedRun(run)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: selectedRun?.id === run.id ? 'rgba(139, 92, 246, 0.08)' : 'rgba(255,255,255,0.01)',
                    padding: '8px 12px', borderRadius: '6px', border: '1px solid',
                    borderColor: selectedRun?.id === run.id ? 'var(--accent-primary)' : 'rgba(255,255,255,0.03)',
                    cursor: 'pointer', transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>@{run.handle}</span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {new Date(run.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className={`status-badge status-${run.status}`} style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '4px' }}>
                      {run.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
