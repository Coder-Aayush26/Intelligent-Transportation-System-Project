import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Map, Activity, Users, Radio, CheckCircle, Search, AlertCircle, Database, Lock, Share2 } from 'lucide-react';
import Button from '../components/common/Button';
import './LandingPage.css';
function useParallax() {
  useEffect(() => {
    let raf;
    const hero = document.querySelector('.hero-section');
    const content = document.querySelector('.hero-content');
    const visual  = document.querySelector('.hero-visual');
    const progressBar = document.querySelector('.scroll-progress-bar');
    const floatCards = document.querySelectorAll('.float-card');

    function onScroll() {
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        
        // Progress bar
        if (progressBar) {
          const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
          const scrollPct = docHeight > 0 ? (y / docHeight) * 100 : 0;
          progressBar.style.width = `${scrollPct}%`;
        }

        // Parallax
        if (content) content.style.transform = `translateY(${y * 0.18}px)`;
        if (visual)  visual.style.transform  = `translateY(${y * 0.08}px)`;
        
        // Float cards secondary parallax
        floatCards.forEach((card, i) => {
          const speed = 0.05 + (i * 0.02);
          card.style.transform = `translateY(${y * speed}px)`;
        });
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);
}

/* ── Counter animation on scroll ─────────────────────────────── */
function useCounter() {
  useEffect(() => {
    const counters = document.querySelectorAll('[data-count]');
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el     = entry.target;
        const target = parseInt(el.dataset.count, 10);
        const suffix = el.dataset.suffix || '';
        const dur    = 1600;
        const start  = performance.now();
        function frame(now) {
          const p = Math.min((now - start) / dur, 1);
          const ease = 1 - Math.pow(1 - p, 3);          // cubic ease-out
          el.textContent = Math.round(ease * target) + suffix;
          if (p < 1) requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
        obs.unobserve(el);
      });
    }, { threshold: 0.5 });
    counters.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);
}

/* ─────────────────────────────────────────────────────────────── */
export default function LandingPage() {
  useParallax();
  useCounter();

  return (
    <div className="landing">
      {/* ── Scroll Progress Bar ───────────────────────────────── */}
      <div className="scroll-progress-container">
        <div className="scroll-progress-bar"></div>
      </div>

      {/* ── Nav ─────────────────────────────────────────────────── */}
      <nav className="landing-nav">
        <div className="brand">
          <div className="brand-mark">ITS</div>
          <div className="brand-text">
            <div className="name">INTELLIGENT TRANSPORTATION SYSTEMS</div>
            <div className="tag">Crowdsourced Real-Time Incident Management</div>
          </div>
        </div>
        <div className="links">
          <a href="#home">Home</a>
          <a href="#features">Features</a>
          <a href="#how-it-works">How It Works</a>
          <a href="#about">About</a>
        </div>
        <div className="actions">
          <Button as={Link} to="/app/dashboard" variant="outline" size="sm">Login</Button>
          <Button as={Link} to="/app/dashboard" size="sm">Get Started</Button>
        </div>
      </nav>

      {/* ── Live Ticker Marquee ───────────────────────────────── */}
      <div className="ticker-wrap">
        <div className="ticker-content">
          <span className="ticker-item r">🔴 Accident reported · Ring Road</span> <span className="t-sep">|</span>
          <span className="ticker-item o">🟠 Congestion · NH-48</span> <span className="t-sep">|</span>
          <span className="ticker-item g">✅ Waterlogging resolved · MG Road</span> <span className="t-sep">|</span>
          <span className="ticker-item b">🔵 Hazard reported · 5th Avenue</span> <span className="t-sep">|</span>
          <span className="ticker-item r">🔴 Accident reported · Ring Road</span> <span className="t-sep">|</span>
          <span className="ticker-item o">🟠 Congestion · NH-48</span> <span className="t-sep">|</span>
          <span className="ticker-item g">✅ Waterlogging resolved · MG Road</span>
        </div>
      </div>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="hero-section" id="home">
        <div className="hero-bg">
          <div className="hero-grid-overlay" />
        </div>

        <div className="hero-content">
          <div className="hero-eyebrow">
            <span className="hero-eyebrow-dot" />
            Live Monitoring Active
          </div>

          <h1 className="hero-h1">
            Smarter Roads.<br />
            <span className="grad">Safer Cities.</span>
          </h1>

          <p className="hero-sub">
            Real-time crowdsourced incident management — powered by AI verification
            and community consensus. Know before you go.
          </p>

          <div className="hero-actions">
            <Button as={Link} to="/app/report">Report an Incident</Button>
            <Button as={Link} to="/app/dashboard" variant="outline">View Live Map →</Button>
          </div>

          <div className="hero-proof">
            <div className="proof-stat">
              <div className="proof-stat-val" data-count="12400" data-suffix="+">0+</div>
              <div className="proof-stat-label">Incidents Resolved</div>
            </div>
            <div className="proof-divider" />
            <div className="proof-stat">
              <div className="proof-stat-val" data-count="98" data-suffix="%">0%</div>
              <div className="proof-stat-label">Verification Accuracy</div>
            </div>
            <div className="proof-divider" />
            <div className="proof-stat">
              <div className="proof-stat-val" data-count="34" data-suffix="s">0s</div>
              <div className="proof-stat-label">Avg. Alert Speed</div>
            </div>
          </div>
        </div>

        <div className="hero-visual">
          <div className="hero-viz">
            {/* Floating data cards */}
            <div className="float-card float-card-1">
              <div className="float-card-title">Confidence Score</div>
              <div className="float-card-val">92%</div>
              <div className="float-card-sub">↑ Verified by 6 users</div>
            </div>
            <div className="float-card float-card-2">
              <div className="float-card-title">Active Incidents</div>
              <div className="float-card-val">24</div>
              <div className="float-card-sub">↑ 3 new this hour</div>
            </div>
            <div className="float-card float-card-3">
              <div className="float-card-title">AI Assessment</div>
              <div className="float-card-val">Real</div>
              <div className="float-card-sub">✓ Confirmed</div>
            </div>
            <CommandCentreIllustration />
          </div>
        </div>
      </section>

      {/* ── Stats Band ──────────────────────────────────────────── */}
      <section className="stats-band">
        {[
          { val: 24,    suffix: '+',  label: 'Active Incidents Today' },
          { val: 98,    suffix: '%',  label: 'AI Verification Accuracy' },
          { val: 12400, suffix: '+',  label: 'Total Incidents Resolved' },
          { val: 34,    suffix: 's',  label: 'Average Alert Latency' },
        ].map((s, i) => (
          <div className={`stats-band-item reveal reveal-delay-${i + 1}`} key={s.label}>
            <span className="stats-band-val" data-count={s.val} data-suffix={s.suffix}>0{s.suffix}</span>
            <div className="stats-band-label">{s.label}</div>
          </div>
        ))}
      </section>

      {/* ── Features ────────────────────────────────────────────── */}
      <section className="feature-strip" id="features">
        <div className="reveal-left section-label">What We Offer</div>
        <div className="reveal section-title">Built for the Real World</div>
        <div className="reveal section-desc">
          Every feature is designed around one goal: getting accurate incident information
          to the people who need it, faster than any traditional system.
        </div>

        <div className="feature-panel">
          {[
            { icon: <Activity size={32} color="#2563eb" />, title: 'Crowdsourced Reports',    desc: 'Any road user can submit a geotagged incident report in seconds, directly from their phone.', delay: 1 },
            { icon: <ShieldCheck size={32} color="#7c3aed" />, title: 'AI Verification',         desc: 'Machine learning cross-references new reports against existing data and flags duplicates instantly.', delay: 2 },
            { icon: <Map size={32} color="#16a34a" />, title: 'Live GIS Map',            desc: 'All verified incidents appear on an interactive map with real-time severity and confidence overlays.', delay: 3 },
            { icon: <Users size={32} color="#ca8a04" />, title: 'Reliability Scoring',     desc: 'Every user earns a dynamic reliability score. Trusted reporters get higher initial confidence.', delay: 4 },
          ].map((f) => (
            <div className={`feature-item reveal-scale reveal-delay-${f.delay}`} key={f.title}>
              <div className="feature-icon" style={{display:'flex', alignItems:'center', justifyContent:'center'}}>{f.icon}</div>
              <h4>{f.title}</h4>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ────────────────────────────────────────── */}
      <section className="how-section" id="how-it-works">
        <div className="how-inner">
          <div>
            <div className="reveal-left section-label">Process</div>
            <h2 className="reveal section-title">From Report to Road Alert in&nbsp;Seconds</h2>
            <p className="reveal section-desc">
              Four stages transform a raw user observation into a trusted, verified incident
              on the live map — automatically.
            </p>

            <div className="steps-list">
              {[
                { n:1, icon: <AlertCircle size={20} style={{verticalAlign:'middle', marginRight:6}} />, title:'Report',                  desc:'User submits location, category, severity and optional photo.',                               delay:1 },
                { n:2, icon: <Search size={20} style={{verticalAlign:'middle', marginRight:6}} />, title:'AI Assessment',           desc:'Duplicate check, location validation, initial confidence score assigned.',                   delay:2 },
                { n:3, icon: <Users size={20} style={{verticalAlign:'middle', marginRight:6}} />, title:'Community Verification',  desc:'Nearby users confirm or contradict — confidence rises or falls in real time.',               delay:3 },
                { n:4, icon: <Map size={20} style={{verticalAlign:'middle', marginRight:6}} />, title:'Live Map Update',         desc:'Verified incidents appear with severity markers and push notifications to affected routes.', delay:4 },
              ].map((s) => (
                <div className={`step-item reveal reveal-delay-${s.delay}`} key={s.n}>
                  <div className="step-num">{s.n}</div>
                  <div className="step-content">
                    <h4>{s.icon} {s.title}</h4>
                    <p>{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Live pipeline mock */}
          <div className="how-visual reveal-right">
            <div className="how-visual-card">
              <div className="how-visual-header">
                <span className="live-dot" />
                Live Verification Pipeline
              </div>
              {[
                { icon:<AlertCircle size={18} color="#0ea5e9"/>, label:'Incident Reported',           sub:'Ring Road, Near City Mall',  status:'Done',    cls:'status-done'    },
                { icon:<Search size={18} color="#0ea5e9"/>, label:'AI Duplicate Check',          sub:'No duplicate found',         status:'Done',    cls:'status-done'    },
                { icon:<CheckCircle size={18} color="#0ea5e9"/>, label:'Location Validation',         sub:'GPS accuracy: 12m',          status:'Active',  cls:'status-active'  },
                { icon:<Users size={18} color="#0ea5e9"/>, label:'Community Verification',      sub:'Awaiting nearby users…',     status:'Pending', cls:'status-pending' },
                { icon:<Share2 size={18} color="#0ea5e9"/>, label:'Map Broadcast',               sub:'Will publish when ≥80%',     status:'Pending', cls:'status-pending' },
              ].map((p, i) => (
                <div className="pipeline-step" key={i}>
                  <div className="pipeline-icon" style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {p.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="pipeline-label">{p.label}</div>
                    <div className="pipeline-sub">{p.sub}</div>
                  </div>
                  <div className={`pipeline-status ${p.cls}`}>{p.status}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── About ───────────────────────────────────────────────── */}
      <section className="about-section" id="about">
        <div className="about-text">
          <div className="reveal-left section-label">About</div>
          <h2 className="reveal section-title">The ITS Vision</h2>
          <p className="reveal reveal-delay-1 section-desc" style={{marginBottom:0}}>
            The Intelligent Transportation System is a crowdsourced incident-management platform
            that empowers road users to report, verify, and act on real-time traffic incidents.
          </p>
          <p className="reveal reveal-delay-2" style={{fontSize:15,color:'var(--text-soft)',lineHeight:1.85,marginTop:16}}>
            AI-assisted verification and community consensus combine to surface the most reliable
            information, giving every traveller the data they need to make safer decisions —
            without waiting for official channels.
          </p>
          <div className="about-badges reveal reveal-delay-3">
            {['Open Source', 'AI-Powered', 'Community Driven', 'Real-Time GIS', 'Privacy First'].map(b => (
              <span className="about-badge" key={b}><span className="about-badge-icon">✦</span>{b}</span>
            ))}
          </div>
        </div>

        <div className="reveal-right" style={{position:'relative'}}>
          <AboutVisual />
        </div>
      </section>

    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   COMMAND CENTRE ILLUSTRATION
   Animated SVG: perspective city map + live data feeds
──────────────────────────────────────────────────────────────── */
function CommandCentreIllustration() {
  return (
    <svg viewBox="0 0 560 420" fill="none" xmlns="http://www.w3.org/2000/svg" style={{borderRadius:20,overflow:'visible'}}>
      <defs>
        <linearGradient id="bg-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#eef4ff"/>
          <stop offset="100%" stopColor="#f5f0ff"/>
        </linearGradient>
        <linearGradient id="road-h" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="rgba(255,255,255,0)"/>
          <stop offset="0.3" stopColor="#ffffff"/>
          <stop offset="0.7" stopColor="#ffffff"/>
          <stop offset="1" stopColor="rgba(255,255,255,0)"/>
        </linearGradient>
        <linearGradient id="road-v" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(255,255,255,0)"/>
          <stop offset="0.3" stopColor="#ffffff"/>
          <stop offset="0.7" stopColor="#ffffff"/>
          <stop offset="1" stopColor="rgba(255,255,255,0)"/>
        </linearGradient>
        <filter id="soft-shadow">
          <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="rgba(37,99,235,0.15)"/>
        </filter>
        <filter id="pin-glow-r">
          <feGaussianBlur stdDeviation="3" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="pin-glow-b">
          <feGaussianBlur stdDeviation="3" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <path id="vp1" d="M30,215 C120,185 240,255 370,210 S 490,185 530,200"/>
        <path id="vp2" d="M155,20 C145,110 160,200 155,400"/>
        <path id="vp3" d="M385,20 C375,130 410,255 395,400"/>
      </defs>

      {/* Light gradient base */}
      <rect width="560" height="420" rx="20" fill="url(#bg-grad)"/>

      {/* Subtle grid */}
      <g opacity="0.08" stroke="#2563eb" strokeWidth="0.5">
        {[50,100,150,200,250,300,350,400].map(y=><line key={'gy'+y} x1="0" y1={y} x2="560" y2={y}/>)}
        {[60,120,180,240,300,360,420,480].map(x=><line key={'gx'+x} x1={x} y1="0" x2={x} y2="420"/>)}
      </g>

      {/* ── Colorful city blocks ───────────────────────────── */}
      {/* Top-left cluster */}
      <rect x="30"  y="25"  width="100" height="72" rx="6" fill="#dbeafe" stroke="#93c5fd" strokeWidth="1"/>
      <rect x="30"  y="25"  width="100" height="14" rx="6" fill="#2563eb" opacity="0.6"/>
      <rect x="48"  y="52"  width="14" height="10" rx="2" fill="#fff" opacity="0.7"/>
      <rect x="68"  y="52"  width="14" height="10" rx="2" fill="#fff" opacity="0.7"/>
      <rect x="88"  y="52"  width="14" height="10" rx="2" fill="#fff" opacity="0.5"/>
      <rect x="48"  y="68"  width="14" height="10" rx="2" fill="#fff" opacity="0.6"/>
      <rect x="68"  y="68"  width="14" height="10" rx="2" fill="#93c5fd" opacity="0.8"/>

      {/* Top-center */}
      <rect x="185" y="45"  width="82"  height="60" rx="6" fill="#ede9fe" stroke="#c4b5fd" strokeWidth="1"/>
      <rect x="185" y="45"  width="82"  height="12" rx="6" fill="#7c3aed" opacity="0.5"/>
      <rect x="198" y="68"  width="12" height="9" rx="2" fill="#fff" opacity="0.7"/>
      <rect x="216" y="68"  width="12" height="9" rx="2" fill="#fff" opacity="0.7"/>
      <rect x="234" y="68"  width="12" height="9" rx="2" fill="#fff" opacity="0.5"/>
      <rect x="198" y="82"  width="12" height="9" rx="2" fill="#c4b5fd" opacity="0.8"/>
      <rect x="216" y="82"  width="12" height="9" rx="2" fill="#fff" opacity="0.4"/>

      {/* Top-right cluster */}
      <rect x="420" y="28"  width="110" height="80" rx="6" fill="#dcfce7" stroke="#86efac" strokeWidth="1"/>
      <rect x="420" y="28"  width="110" height="14" rx="6" fill="#16a34a" opacity="0.5"/>
      <rect x="436" y="55"  width="14" height="10" rx="2" fill="#fff" opacity="0.7"/>
      <rect x="458" y="55"  width="14" height="10" rx="2" fill="#fff" opacity="0.6"/>
      <rect x="480" y="55"  width="14" height="10" rx="2" fill="#86efac" opacity="0.7"/>
      <rect x="436" y="72"  width="14" height="10" rx="2" fill="#fff" opacity="0.5"/>
      <rect x="458" y="72"  width="14" height="10" rx="2" fill="#fff" opacity="0.6"/>

      {/* Bottom-left */}
      <rect x="35"  y="270" width="130" height="100" rx="6" fill="#fef9c3" stroke="#fde047" strokeWidth="1"/>
      <rect x="35"  y="270" width="130" height="16" rx="6" fill="#ca8a04" opacity="0.5"/>
      <rect x="52"  y="302"  width="18" height="12" rx="2" fill="#fff" opacity="0.7"/>
      <rect x="78"  y="302"  width="18" height="12" rx="2" fill="#fff" opacity="0.6"/>
      <rect x="104" y="302"  width="18" height="12" rx="2" fill="#fde047" opacity="0.7"/>
      <rect x="52"  y="320"  width="18" height="12" rx="2" fill="#fff" opacity="0.5"/>
      <rect x="78"  y="320"  width="18" height="12" rx="2" fill="#fff" opacity="0.5"/>

      {/* Bottom-center */}
      <rect x="240" y="295" width="90"  height="80" rx="6" fill="#ffe4e6" stroke="#fda4af" strokeWidth="1"/>
      <rect x="240" y="295" width="90"  height="14" rx="6" fill="#dc2626" opacity="0.45"/>
      <rect x="255" y="322" width="14" height="10" rx="2" fill="#fff" opacity="0.7"/>
      <rect x="276" y="322" width="14" height="10" rx="2" fill="#fff" opacity="0.6"/>
      <rect x="255" y="338" width="14" height="10" rx="2" fill="#fda4af" opacity="0.8"/>

      {/* Bottom-right */}
      <rect x="600" y="270" width="0"   height="0"  rx="4"/>
      <rect x="450" y="280" width="100" height="90" rx="6" fill="#e0f2fe" stroke="#7dd3fc" strokeWidth="1"/>
      <rect x="450" y="280" width="100" height="14" rx="6" fill="#0ea5e9" opacity="0.5"/>
      <rect x="464" y="306" width="14" height="10" rx="2" fill="#fff" opacity="0.7"/>
      <rect x="484" y="306" width="14" height="10" rx="2" fill="#7dd3fc" opacity="0.8"/>
      <rect x="504" y="306" width="14" height="10" rx="2" fill="#fff" opacity="0.5"/>
      <rect x="464" y="322" width="14" height="10" rx="2" fill="#fff" opacity="0.6"/>

      {/* ── Roads (white stripes) ─────────────────────────── */}
      <path d="M0,215 C120,185 240,255 370,210 S 500,185 560,200" stroke="#ffffff" strokeWidth="24" fill="none" strokeLinecap="round"/>
      <path d="M0,215 C120,185 240,255 370,210 S 500,185 560,200" stroke="#e2e8f0" strokeWidth="24" fill="none" strokeLinecap="round" opacity="0.4"/>
      <path d="M0,215 C120,185 240,255 370,210 S 500,185 560,200" stroke="rgba(37,99,235,0.25)" strokeWidth="1.5" strokeDasharray="12 9" fill="none">
        <animate attributeName="stroke-dashoffset" from="0" to="-42" dur="1.8s" repeatCount="indefinite"/>
      </path>

      <path d="M0,345 C180,328 340,358 560,338" stroke="#ffffff" strokeWidth="22" fill="none" strokeLinecap="round"/>
      <path d="M0,345 C180,328 340,358 560,338" stroke="rgba(37,99,235,0.2)" strokeWidth="1.5" strokeDasharray="10 8" fill="none">
        <animate attributeName="stroke-dashoffset" from="0" to="-36" dur="2.2s" repeatCount="indefinite"/>
      </path>

      <path d="M155,0 C145,100 160,210 155,420" stroke="#ffffff" strokeWidth="22" fill="none" strokeLinecap="round"/>
      <path d="M155,0 C145,100 160,210 155,420" stroke="rgba(37,99,235,0.22)" strokeWidth="1.5" strokeDasharray="10 8" fill="none">
        <animate attributeName="stroke-dashoffset" from="0" to="-36" dur="2s" repeatCount="indefinite"/>
      </path>

      <path d="M390,0 C380,130 410,255 398,420" stroke="#ffffff" strokeWidth="20" fill="none" strokeLinecap="round"/>
      <path d="M390,0 C380,130 410,255 398,420" stroke="rgba(37,99,235,0.18)" strokeWidth="1.5" strokeDasharray="9 7" fill="none">
        <animate attributeName="stroke-dashoffset" from="0" to="-32" dur="1.6s" repeatCount="indefinite"/>
      </path>

      {/* ── Animated vehicles ─────────────────────────────── */}
      <g filter="url(#pin-glow-b)">
        <rect width="22" height="10" rx="3" fill="#2563eb" opacity="0.9">
          <animateMotion dur="6s" repeatCount="indefinite" rotate="auto"><mpath href="#vp1"/></animateMotion>
        </rect>
      </g>
      <g filter="url(#pin-glow-b)">
        <rect width="10" height="20" rx="3" fill="#7c3aed" opacity="0.85">
          <animateMotion dur="7s" repeatCount="indefinite" rotate="auto" begin="2s"><mpath href="#vp2"/></animateMotion>
        </rect>
      </g>
      <g>
        <rect width="10" height="18" rx="3" fill="#16a34a" opacity="0.85">
          <animateMotion dur="8s" repeatCount="indefinite" rotate="auto" begin="4s"><mpath href="#vp3"/></animateMotion>
        </rect>
      </g>

      {/* ── Incident pins ─────────────────────────────────── */}
      {/* Accident — red */}
      <g filter="url(#pin-glow-r)">
        <circle cx="272" cy="210" r="12" fill="#fee2e2" stroke="#f87171" strokeWidth="2"/>
        <circle cx="272" cy="210" r="6"  fill="#dc2626"/>
        <circle cx="272" cy="210" r="20" fill="none" stroke="#f87171" strokeWidth="1.5" opacity="0.5">
          <animate attributeName="r" values="12;28;12" dur="2.4s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.5;0;0.5" dur="2.4s" repeatCount="indefinite"/>
        </circle>
      </g>

      {/* Waterlogging — blue */}
      <g filter="url(#pin-glow-b)">
        <circle cx="155" cy="155" r="10" fill="#dbeafe" stroke="#3b82f6" strokeWidth="2"/>
        <circle cx="155" cy="155" r="5"  fill="#2563eb"/>
        <circle cx="155" cy="155" r="18" fill="none" stroke="#3b82f6" strokeWidth="1" opacity="0.4">
          <animate attributeName="r" values="10;24;10" dur="3s" repeatCount="indefinite" begin="0.8s"/>
          <animate attributeName="opacity" values="0.4;0;0.4" dur="3s" repeatCount="indefinite" begin="0.8s"/>
        </circle>
      </g>

      {/* Congestion — orange */}
      <g>
        <circle cx="390" cy="165" r="10" fill="#fff7ed" stroke="#fb923c" strokeWidth="2"/>
        <circle cx="390" cy="165" r="5"  fill="#ea580c"/>
        <circle cx="390" cy="165" r="18" fill="none" stroke="#fb923c" strokeWidth="1" opacity="0.4">
          <animate attributeName="r" values="10;24;10" dur="2.8s" repeatCount="indefinite" begin="1.5s"/>
          <animate attributeName="opacity" values="0.4;0;0.4" dur="2.8s" repeatCount="indefinite" begin="1.5s"/>
        </circle>
      </g>

      {/* ── Data panel ─────────────────────────────────────── */}
      <g filter="url(#soft-shadow)">
        <rect x="340" y="300" width="192" height="102" rx="14" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1"/>
        <text x="356" y="323" fontSize="9" fontWeight="700" letterSpacing="1.5" fill="#64748b">LIVE CONFIDENCE</text>
        {[
          { y:334, w:130, label:'Accident — Ring Rd',   color:'#dc2626' },
          { y:354, w:98,  label:'Waterlogging — MG Rd', color:'#2563eb' },
          { y:374, w:72,  label:'Congestion — NH48',    color:'#ea580c' },
        ].map((b)=>(
          <g key={b.label}>
            <rect x="356" y={b.y}    width="168" height="10" rx="5" fill="#f1f5f9"/>
            <rect x="356" y={b.y}    width={b.w}  height="10" rx="5" fill={b.color} opacity="0.85"/>
            <text x="356" y={b.y+22} fontSize="8" fill="#94a3b8">{b.label}</text>
          </g>
        ))}
      </g>

      {/* ── Reports card ───────────────────────────────────── */}
      <g filter="url(#soft-shadow)">
        <rect x="22" y="118" width="118" height="66" rx="12" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1"/>
        <text x="36" y="138" fontSize="8.5" fontWeight="700" letterSpacing="1.2" fill="#64748b">REPORTS TODAY</text>
        <text x="36" y="162" fontSize="24" fontWeight="900" fill="#2563eb">128</text>
        <text x="80" y="162" fontSize="11" fill="#16a34a" fontWeight="700">↑12%</text>
        <text x="36" y="177" fontSize="8" fill="#94a3b8">from 98 users</text>
      </g>

      {/* Connection lines */}
      <line x1="272" y1="222" x2="340" y2="318" stroke="#f87171" strokeWidth="1" strokeDasharray="4 3" opacity="0.4"/>
      <line x1="155" y1="165" x2="140" y2="180" stroke="#3b82f6" strokeWidth="1" strokeDasharray="4 3" opacity="0.35"/>
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────
   ABOUT VISUAL — Modern Data Grid
──────────────────────────────────────────────────────────────── */
function AboutVisual() {
  return (
    <div className="modern-about-visual" style={{
      background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
      border: '1px solid #e2e8f0',
      borderRadius: '24px',
      padding: '30px',
      boxShadow: '0 20px 40px rgba(15,23,42,0.06), 0 0 0 1px rgba(255,255,255,0.5) inset',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background Decor */}
      <div style={{
        position:'absolute', top:'-50%', left:'-50%', width:'200%', height:'200%',
        background: 'radial-gradient(circle, rgba(37,99,235,0.03) 0%, transparent 50%)',
        zIndex: 0, animation: 'driftA 20s linear infinite'
      }} />
      
      <div style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Card 1 */}
        <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ background: '#eff6ff', padding: '8px', borderRadius: '8px' }}>
              <Database size={18} color="#2563eb" />
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Real-time Data</div>
          </div>
          <div style={{ height: 4, width: '100%', background: '#f1f5f9', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: '75%', background: '#2563eb', animation: 'loadBar 3s ease-out' }} />
          </div>
        </div>

        {/* Card 2 */}
        <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9', transform: 'translateY(20px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ background: '#f0fdf4', padding: '8px', borderRadius: '8px' }}>
              <CheckCircle size={18} color="#16a34a" />
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Consensus</div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[1,2,3,4,5].map(i => (
              <div key={i} style={{ flex: 1, height: 24, background: i<=4 ? '#16a34a' : '#f1f5f9', borderRadius: 4, opacity: i<=4 ? 0.8 : 1 }} />
            ))}
          </div>
        </div>

        {/* Card 3 */}
        <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9', gridColumn: 'span 2' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ background: '#fef2f2', padding: '8px', borderRadius: '8px' }}>
                <Lock size={18} color="#dc2626" />
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Secure Infrastructure</div>
            </div>
            <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 600, background: '#f0fdf4', padding: '4px 8px', borderRadius: 12 }}>Protected</div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', border: '2px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={16} color="#64748b" />
            </div>
            <div style={{ flex: 1, height: 2, background: 'linear-gradient(90deg, #cbd5e1 50%, transparent 50%)', backgroundSize: '8px 2px' }} />
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#eff6ff', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={18} color="#2563eb" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
