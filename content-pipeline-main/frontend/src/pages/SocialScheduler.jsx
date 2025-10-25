import { useState, useEffect } from 'react';
import { 
  Calendar, Clock, FolderOpen, Play, CheckCircle, AlertCircle, 
  Loader, Settings, Send, Share2, X, Info
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

export default function SocialScheduler() {
  const [videoPath, setVideoPath] = useState('');
  const [caption, setCaption] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState(['instagram']);
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState([]);
  
  // Credentials setup
  const [useSimulated, setUseSimulated] = useState(true);
  const [metaAccessToken, setMetaAccessToken] = useState(localStorage.getItem('meta_access_token') || '');
  const [igBusinessId, setIgBusinessId] = useState(localStorage.getItem('instagram_business_id') || '');
  const [fbPageId, setFbPageId] = useState(localStorage.getItem('facebook_page_id') || '');
  const [publicVideoUrl, setPublicVideoUrl] = useState(localStorage.getItem('public_video_url') || '');
  const [youtubeAccessToken, setYoutubeAccessToken] = useState(localStorage.getItem('youtube_access_token') || '');

  // Auto-save local credentials
  const saveCredential = (key, val, setter) => {
    setter(val);
    localStorage.setItem(key, val);
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 2500);
    return () => clearInterval(interval);
  }, []);

  const fetchJobs = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/scheduler/queue');
      if (res.ok) {
        const data = await res.json();
        setJobs(data.reverse()); // latest first
      }
    } catch (err) {
      console.error("Error fetching scheduler queue:", err);
    }
  };

  const togglePlatform = (plat) => {
    setSelectedPlatforms(prev => 
      prev.includes(plat) ? prev.filter(p => p !== plat) : [...prev, plat]
    );
  };

  const handleSchedule = async () => {
    if (!videoPath) {
      alert("Please specify the absolute video file path!");
      return;
    }
    if (selectedPlatforms.length === 0) {
      alert("Please select at least one social media channel!");
      return;
    }
    if (!scheduledTime) {
      alert("Please select a valid scheduled posting date & time!");
      return;
    }

    setLoading(true);
    try {
      const formattedTime = new Date(scheduledTime).toISOString();
      const res = await fetch('http://localhost:8000/api/scheduler/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_path: videoPath,
          caption: caption,
          scheduled_time: formattedTime,
          platforms: selectedPlatforms,
          credentials: {
            use_simulated: useSimulated,
            meta_access_token: metaAccessToken,
            instagram_business_id: igBusinessId,
            facebook_page_id: fbPageId,
            public_video_url: publicVideoUrl,
            youtube_access_token: youtubeAccessToken
          }
        })
      });

      if (res.ok) {
        setVideoPath('');
        setCaption('');
        setScheduledTime('');
        fetchJobs();
      } else {
        const errData = await res.json();
        alert(errData.detail || "Failed to schedule video post");
      }
    } catch (err) {
      alert("Error connecting to backend scheduler service");
    } finally {
      setLoading(false);
    }
  };

  const cancelPost = async (jobId) => {
    try {
      const res = await fetch(`http://localhost:8000/api/scheduler/cancel/${jobId}`, {
        method: 'POST'
      });
      if (res.ok) fetchJobs();
    } catch (err) {
      alert("Error cancelling post");
    }
  };

  const postNow = async (jobId) => {
    try {
      const res = await fetch(`http://localhost:8000/api/scheduler/post-now/${jobId}`, {
        method: 'POST'
      });
      if (res.ok) fetchJobs();
    } catch (err) {
      alert("Error triggering posting");
    }
  };

  const getPlatformIcon = (platform) => {
    switch (platform) {
      case 'instagram':
        return <InstagramIcon size={14} style={{ color: '#E1306C' }} />;
      case 'facebook':
        return <FacebookIcon size={14} style={{ color: '#1877F2' }} />;
      case 'youtube':
        return <YoutubeIcon size={14} style={{ color: '#FF0000' }} />;
      default:
        return null;
    }
  };

  return (
    <div className="container">
      {/* ── Header ───────────────────────────────────── */}
      <header className="page-header">
        <div className="header-icon" style={{ background: 'var(--accent-gradient)' }}>
          <Calendar size={28} style={{ color: '#white' }} />
        </div>
        <div>
          <h1 className="page-title">Social Scheduler</h1>
          <p className="page-subtitle">Schedule, queue, and automatically publish video reels to Instagram, Facebook, and YouTube</p>
        </div>
      </header>

      {/* ── Main Content Grid ────────────────────────── */}
      <div className="editor-grid">
        
        {/* Left Side: Schedule Creator Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Post Details Card */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 className="setting-title" style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
              <Share2 size={18} /> Schedule Video Post
            </h3>

            {/* Video File Path */}
            <div className="input-group">
              <label>Reel Video File Path (Absolute)</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. /Users/masi/Documents/newreels/DJ_zlrmSdKN.mp4"
                value={videoPath}
                onChange={e => setVideoPath(e.target.value)}
              />
              <span className="hint-text">Specify the absolute path of your watermarked/subtitled reel.</span>
            </div>

            {/* Caption/Description */}
            <div className="input-group" style={{ marginTop: '1rem' }}>
              <label>Caption / Video Description</label>
              <textarea
                className="input-field"
                rows={3}
                placeholder="Add caption, hashtags, and social description..."
                value={caption}
                onChange={e => setCaption(e.target.value)}
                style={{ resize: 'vertical', minHeight: '80px', fontSize: '0.88rem' }}
              />
            </div>

            {/* Platform Selection */}
            <div className="input-group" style={{ marginTop: '1.25rem' }}>
              <label style={{ marginBottom: '0.5rem', display: 'block' }}>Publishing Platforms</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => togglePlatform('instagram')}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid',
                    background: selectedPlatforms.includes('instagram') ? 'rgba(225, 48, 108, 0.12)' : 'var(--surface-dark)',
                    borderColor: selectedPlatforms.includes('instagram') ? '#E1306C' : 'rgba(255,255,255,0.06)',
                    color: selectedPlatforms.includes('instagram') ? '#fff' : 'var(--text-secondary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer',
                    fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.2s ease'
                  }}
                >
                  <InstagramIcon size={16} style={{ color: '#E1306C' }} /> Instagram
                </button>

                <button
                  type="button"
                  onClick={() => togglePlatform('facebook')}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid',
                    background: selectedPlatforms.includes('facebook') ? 'rgba(24, 119, 242, 0.12)' : 'var(--surface-dark)',
                    borderColor: selectedPlatforms.includes('facebook') ? '#1877F2' : 'rgba(255,255,255,0.06)',
                    color: selectedPlatforms.includes('facebook') ? '#fff' : 'var(--text-secondary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer',
                    fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.2s ease'
                  }}
                >
                  <FacebookIcon size={16} style={{ color: '#1877F2' }} /> Facebook
                </button>

                <button
                  type="button"
                  onClick={() => togglePlatform('youtube')}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid',
                    background: selectedPlatforms.includes('youtube') ? 'rgba(255, 0, 0, 0.12)' : 'var(--surface-dark)',
                    borderColor: selectedPlatforms.includes('youtube') ? '#FF0000' : 'rgba(255,255,255,0.06)',
                    color: selectedPlatforms.includes('youtube') ? '#fff' : 'var(--text-secondary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer',
                    fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.2s ease'
                  }}
                >
                  <YoutubeIcon size={16} style={{ color: '#FF0000' }} /> YouTube
                </button>
              </div>
            </div>

            {/* Posting Timepicker */}
            <div className="input-group" style={{ marginTop: '1.25rem' }}>
              <label>Scheduled Posting Date & Time</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="datetime-local"
                  className="input-field"
                  value={scheduledTime}
                  onChange={e => setScheduledTime(e.target.value)}
                  style={{ paddingLeft: '36px', color: '#fff', cursor: 'pointer' }}
                />
                <Clock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              </div>
            </div>
          </div>

          {/* Social API Authentication Settings */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 className="setting-title" style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <Settings size={18} /> API Integration & Credentials
              </h3>
              
              {/* Simulated Mode Toggle */}
              <button
                type="button"
                onClick={() => setUseSimulated(!useSimulated)}
                style={{
                  padding: '4px 10px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, border: 'none', cursor: 'pointer',
                  background: useSimulated ? 'rgba(139, 92, 246, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                  color: useSimulated ? 'var(--accent-primary)' : 'var(--success)',
                  border: useSimulated ? '1px solid rgba(139,92,246,0.3)' : '1px solid rgba(34,197,94,0.3)'
                }}
              >
                {useSimulated ? "⚡ Simulated Mode Active" : "📡 Real API Mode Active"}
              </button>
            </div>

            {useSimulated ? (
              <div style={{ background: 'rgba(139, 92, 246, 0.05)', border: '1px dashed rgba(139,92,246,0.15)', borderRadius: '8px', padding: '0.85rem', display: 'flex', gap: '8px' }}>
                <Info size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: '2px' }} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  Simulated posting mode is currently active. The scheduler loop will monitor and complete the job timeline with realistic publishing step executions without requiring developer setup! Toggle to **Real API Mode** to connect direct endpoints.
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                
                {/* Meta API Credentials */}
                {(selectedPlatforms.includes('instagram') || selectedPlatforms.includes('facebook')) && (
                  <div style={{ borderLeft: '3px solid var(--accent-primary)', paddingLeft: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>Meta Graph API Integration (Instagram/Facebook)</div>
                    
                    <div className="input-group">
                      <label style={{ fontSize: '0.72rem' }}>Meta Access Token</label>
                      <input
                        type="password"
                        className="input-field"
                        placeholder="Meta Graph API Access Token..."
                        value={metaAccessToken}
                        onChange={e => saveCredential('meta_access_token', e.target.value, setMetaAccessToken)}
                        style={{ height: '32px', fontSize: '0.8rem' }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      {selectedPlatforms.includes('instagram') && (
                        <div className="input-group" style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.72rem' }}>IG Business ID</label>
                          <input
                            type="text"
                            className="input-field"
                            placeholder="Instagram Account ID..."
                            value={igBusinessId}
                            onChange={e => saveCredential('instagram_business_id', e.target.value, setIgBusinessId)}
                            style={{ height: '32px', fontSize: '0.8rem' }}
                          />
                        </div>
                      )}
                      
                      {selectedPlatforms.includes('facebook') && (
                        <div className="input-group" style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.72rem' }}>FB Page ID</label>
                          <input
                            type="text"
                            className="input-field"
                            placeholder="Facebook Page ID..."
                            value={fbPageId}
                            onChange={e => saveCredential('facebook_page_id', e.target.value, setFbPageId)}
                            style={{ height: '32px', fontSize: '0.8rem' }}
                          />
                        </div>
                      )}
                    </div>

                    <div className="input-group">
                      <label style={{ fontSize: '0.72rem' }}>Public Reachable Video URL</label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="https://example.com/reels/video.mp4"
                        value={publicVideoUrl}
                        onChange={e => saveCredential('public_video_url', e.target.value, setPublicVideoUrl)}
                        style={{ height: '32px', fontSize: '0.8rem' }}
                      />
                      <span className="hint-text" style={{ fontSize: '0.65rem' }}>Meta requires a public URL so their server can ingest and process the video file.</span>
                    </div>
                  </div>
                )}

                {/* YouTube API Credentials */}
                {selectedPlatforms.includes('youtube') && (
                  <div style={{ borderLeft: '3px solid #FF0000', paddingLeft: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.25rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>YouTube Data API Integration</div>
                    
                    <div className="input-group">
                      <label style={{ fontSize: '0.72rem' }}>Google OAuth Access Token</label>
                      <input
                        type="password"
                        className="input-field"
                        placeholder="Google Developer Auth Access Token..."
                        value={youtubeAccessToken}
                        onChange={e => saveCredential('youtube_access_token', e.target.value, setYoutubeAccessToken)}
                        style={{ height: '32px', fontSize: '0.8rem' }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="button"
            className="btn-primary"
            disabled={loading || !videoPath || selectedPlatforms.length === 0 || !scheduledTime}
            onClick={handleSchedule}
            style={{ height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            {loading ? (
              <>
                <Loader size={20} className="spin" /> Setting Schedule...
              </>
            ) : (
              <>
                <Send size={20} /> Add Post to Social Queue
              </>
            )}
          </button>
        </div>

        {/* Right Side: Jobs / Queues Tracker */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          <div className="glass-panel" style={{ padding: '1.5rem', flex: 1, minHeight: '400px' }}>
            <h3 className="setting-title" style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
              <Calendar size={18} /> Social Publishing Calendar Queue
            </h3>

            {jobs.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'var(--text-secondary)' }}>
                <Calendar size={40} style={{ opacity: 0.15, marginBottom: '1rem' }} />
                <span>No active or previous scheduled posts found</span>
                <span style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Schedule posts on the left to monitor their execution timelines.</span>
              </div>
            ) : (
              <div className="jobs-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '550px', overflowY: 'auto' }}>
                {jobs.map(job => (
                  <div key={job.id} className="job-card glass-panel" style={{ padding: '1.25rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="job-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', alignItems: 'flex-start' }}>
                      <div>
                        <div className="job-handle" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <FolderOpen size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                          {job.video_name}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                          <Clock size={10} /> 
                          Sched: {new Date(job.scheduled_time).toLocaleString()}
                        </div>
                      </div>
                      
                      <div className={`status-badge status-${job.status}`} style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '999px', textTransform: 'capitalize' }}>
                        {job.status}
                      </div>
                    </div>

                    {job.caption && (
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0.5rem 0', background: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        "{job.caption}"
                      </p>
                    )}

                    {/* Target Channels */}
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', margin: '0.5rem 0' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Target Channels:</span>
                      {job.platforms.map(plat => (
                        <div key={plat} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--surface-dark)', padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)', fontSize: '0.7rem' }}>
                          {getPlatformIcon(plat)}
                          <span style={{ textTransform: 'capitalize' }}>{plat}</span>
                        </div>
                      ))}
                    </div>

                    <div className="progress-text" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {job.status === 'posting' && <Loader size={12} className="spin" style={{ color: 'var(--accent-primary)' }} />}
                      {job.progress}
                    </div>

                    {job.error && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <AlertCircle size={12} /> {job.error}
                      </div>
                    )}

                    {/* Immediate Post Trigger & Cancel Actions */}
                    {job.status === 'scheduled' && (
                      <div style={{ display: 'flex', gap: '10px', marginTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.75rem' }}>
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => postNow(job.id)}
                          style={{
                            padding: '6px 12px', fontSize: '0.75rem', height: 'auto', flex: 1,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                          }}
                        >
                          <Send size={12} /> Publish Live Now
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => cancelPost(job.id)}
                          style={{
                            padding: '6px 12px', fontSize: '0.75rem', height: 'auto', flex: 1,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                            border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--error)'
                          }}
                        >
                          <X size={12} /> Cancel Scheduled Post
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
