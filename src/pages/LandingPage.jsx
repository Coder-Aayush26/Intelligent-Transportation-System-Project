import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/common/Button';
import './LandingPage.css';

/* ── Scroll-driven parallax ──────────────────────────────────── */
function useParallax() {
  useEffect(() => {
    let raf;
    const hero = document.querySelector('.hero-section');
    const content = document.querySelector('.hero-content');
    const visual  = document.querySelector('.hero-visual');

    function onScroll() {
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        if (content) content.style.transform = `translateY(${y * 0.18}px)`;
        if (visual)  visual.style.transform  = `translateY(${y * 0.08}px)`;
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
            { icon: '📡', title: 'Crowdsourced Reports',    desc: 'Any road user can submit a geotagged incident report in seconds, directly from their phone.', delay: 1 },
            { icon: '🤖', title: 'AI Verification',         desc: 'Machine learning cross-references new reports against existing data and flags duplicates instantly.', delay: 2 },
            { icon: '🗺️', title: 'Live GIS Map',            desc: 'All verified incidents appear on an interactive map with real-time severity and confidence overlays.', delay: 3 },
            { icon: '🛡️', title: 'Reliability Scoring',     desc: 'Every user earns a dynamic reliability score. Trusted reporters get higher initial confidence.', delay: 4 },
          ].map((f) => (
            <div className={`feature-item reveal-scale reveal-delay-${f.delay}`} key={f.title}>
              <div className="feature-icon">{f.icon}</div>
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
                { n:1, icon:'📍', title:'Report',                  desc:'User submits location, category, severity and optional photo.',                               delay:1 },
                { n:2, icon:'🤖', title:'AI Assessment',           desc:'Duplicate check, location validation, initial confidence score assigned.',                   delay:2 },
                { n:3, icon:'👥', title:'Community Verification',  desc:'Nearby users confirm or contradict — confidence rises or falls in real time.',               delay:3 },
                { n:4, icon:'🗺️', title:'Live Map Update',         desc:'Verified incidents appear with severity markers and push notifications to affected routes.', delay:4 },
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
                { icon:'📍', label:'Incident Reported',           sub:'Ring Road, Near City Mall',  status:'Done',    cls:'status-done'    },
                { icon:'🤖', label:'AI Duplicate Check',          sub:'No duplicate found',         status:'Done',    cls:'status-done'    },
                { icon:'🔍', label:'Location Validation',         sub:'GPS accuracy: 12m',          status:'Active',  cls:'status-active'  },
                { icon:'👥', label:'Community Verification',      sub:'Awaiting nearby users…',     status:'Pending', cls:'status-pending' },
                { icon:'📡', label:'Map Broadcast',               sub:'Will publish when ≥80%',     status:'Pending', cls:'status-pending' },
              ].map((p, i) => (
                <div className="pipeline-step" key={i}>
                  <div className="pipeline-icon" style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.15)' }}>
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
        {/* Neon glow filter */}
        <filter id="glow-b" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="4" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="glow-r" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="5" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        {/* Road gradient */}
        <linearGradient id="road-h" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="rgba(56,189,248,0)"/>
          <stop offset="0.3" stopColor="rgba(56,189,248,0.4)"/>
          <stop offset="0.7" stopColor="rgba(56,189,248,0.4)"/>
          <stop offset="1" stopColor="rgba(56,189,248,0)"/>
        </linearGradient>
        <linearGradient id="road-v" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(56,189,248,0)"/>
          <stop offset="0.3" stopColor="rgba(56,189,248,0.35)"/>
          <stop offset="0.7" stopColor="rgba(56,189,248,0.35)"/>
          <stop offset="1" stopColor="rgba(56,189,248,0)"/>
        </linearGradient>
        {/* Scan line */}
        <linearGradient id="scan" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(56,189,248,0)"/>
          <stop offset="0.5" stopColor="rgba(56,189,248,0.3)"/>
          <stop offset="1" stopColor="rgba(56,189,248,0)"/>
        </linearGradient>
        {/* Vehicle path */}
        <path id="vpath1" d="M30,220 C100,180 200,260 310,210 S 440,180 530,200"/>
        <path id="vpath2" d="M160,30 C140,100 160,200 155,380"/>
        <path id="vpath3" d="M390,30 C380,130 420,260 400,400"/>
      </defs>

      {/* ── Deep space base */}
      <rect width="560" height="420" rx="20" fill="#070c1a"/>

      {/* ── Subtle grid */}
      <g opacity="0.05" stroke="#38bdf8" strokeWidth="0.5">
        {[40,80,120,160,200,240,280,320,360,400].map(y=><line key={'gy'+y} x1="0" y1={y} x2="560" y2={y}/>)}
        {[40,80,120,160,200,240,280,320,360,400,440,480,520].map(x=><line key={'gx'+x} x1={x} y1="0" x2={x} y2="420"/>)}
      </g>

      {/* ── City blocks */}
      <g fill="#0c1422" stroke="rgba(56,189,248,0.08)" strokeWidth="1">
        <rect x="30"  y="28"  width="100" height="70"  rx="4"/>
        <rect x="160" y="50"  width="80"  height="55"  rx="4"/>
        <rect x="420" y="32"  width="110" height="75"  rx="4"/>
        <rect x="40"  y="280" width="120" height="90"  rx="4"/>
        <rect x="350" y="295" width="80"  height="70"  rx="4"/>
        <rect x="460" y="275" width="80"  height="100" rx="4"/>
        <rect x="240" y="305" width="90"  height="80"  rx="4"/>
      </g>

      {/* Lit windows */}
      <g opacity="0.5">
        {[[38,45],[38,58],[38,71],[55,45],[55,58],[55,71],[72,45],[72,58]].map(([x,y])=>
          <rect key={`w${x}${y}`} x={x} y={y} width="7" height="5" rx="1" fill="#38bdf8" opacity="0.4"/>)}
        {[[428,45],[428,60],[428,75],[448,45],[448,60],[448,75],[468,45],[468,60]].map(([x,y])=>
          <rect key={`w2${x}${y}`} x={x} y={y} width="7" height="5" rx="1" fill="#818cf8" opacity="0.4"/>)}
      </g>

      {/* ── Main roads — neon glow */}
      <path d="M0,220 C100,185 250,265 390,215 S 500,190 560,205" stroke="url(#road-h)" strokeWidth="18" fill="none" strokeLinecap="round"/>
      <path d="M0,220 C100,185 250,265 390,215 S 500,190 560,205" stroke="rgba(56,189,248,0.5)" strokeWidth="1" fill="none" strokeDasharray="12 8">
        <animate attributeName="stroke-dashoffset" from="0" to="-40" dur="1.5s" repeatCount="indefinite"/>
      </path>

      <path d="M0,348 C150,330 310,360 560,338" stroke="rgba(56,189,248,0.08)" strokeWidth="16" fill="none" strokeLinecap="round"/>
      <path d="M0,348 C150,330 310,360 560,338" stroke="rgba(56,189,248,0.3)"  strokeWidth="1"  fill="none" strokeDasharray="10 7">
        <animate attributeName="stroke-dashoffset" from="0" to="-34" dur="1.8s" repeatCount="indefinite"/>
      </path>

      <path d="M155,0 C145,100 165,200 155,420" stroke="url(#road-v)" strokeWidth="16" fill="none" strokeLinecap="round"/>
      <path d="M155,0 C145,100 165,200 155,420" stroke="rgba(56,189,248,0.45)" strokeWidth="1"  fill="none" strokeDasharray="10 7">
        <animate attributeName="stroke-dashoffset" from="0" to="-34" dur="2s" repeatCount="indefinite"/>
      </path>

      <path d="M395,0 C385,130 410,260 400,420" stroke="rgba(56,189,248,0.07)" strokeWidth="14" fill="none" strokeLinecap="round"/>
      <path d="M395,0 C385,130 410,260 400,420" stroke="rgba(56,189,248,0.3)"  strokeWidth="1"  fill="none" strokeDasharray="9 7">
        <animate attributeName="stroke-dashoffset" from="0" to="-32" dur="1.6s" repeatCount="indefinite"/>
      </path>

      {/* ── Scanning line */}
      <rect x="0" y="0" width="560" height="40" fill="url(#scan)" opacity="0.6">
        <animateTransform attributeName="transform" type="translate" from="0,0" to="0,420" dur="4s" repeatCount="indefinite"/>
      </rect>

      {/* ── Moving vehicles */}
      {/* Car 1 on horizontal road */}
      <g filter="url(#glow-b)">
        <rect width="24" height="11" rx="3" fill="rgba(56,189,248,0.25)" stroke="rgba(56,189,248,0.7)" strokeWidth="1">
          <animateMotion dur="6s" repeatCount="indefinite" rotate="auto">
            <mpath href="#vpath1"/>
          </animateMotion>
        </rect>
      </g>
      {/* Car 2 on vertical road */}
      <g filter="url(#glow-b)">
        <rect width="11" height="22" rx="3" fill="rgba(129,140,248,0.25)" stroke="rgba(129,140,248,0.7)" strokeWidth="1">
          <animateMotion dur="7s" repeatCount="indefinite" rotate="auto" begin="2s">
            <mpath href="#vpath2"/>
          </animateMotion>
        </rect>
      </g>
      {/* Car 3 */}
      <g filter="url(#glow-b)">
        <rect width="11" height="20" rx="3" fill="rgba(56,189,248,0.2)" stroke="rgba(56,189,248,0.5)" strokeWidth="1">
          <animateMotion dur="8s" repeatCount="indefinite" rotate="auto" begin="4s">
            <mpath href="#vpath3"/>
          </animateMotion>
        </rect>
      </g>

      {/* ── Incident pins with pulse rings */}
      {/* Pin 1 — Accident (red) at road intersection */}
      <g filter="url(#glow-r)">
        <circle cx="280" cy="215" r="10" fill="rgba(248,113,113,0.2)" stroke="rgba(248,113,113,0.8)" strokeWidth="1.5"/>
        <circle cx="280" cy="215" r="5"  fill="#f87171"/>
        <circle cx="280" cy="215" r="18" fill="none" stroke="rgba(248,113,113,0.4)" strokeWidth="1">
          <animate attributeName="r"       values="10;26;10" dur="2.4s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.5;0;0.5" dur="2.4s" repeatCount="indefinite"/>
        </circle>
      </g>

      {/* Pin 2 — Waterlogging (blue) */}
      <g filter="url(#glow-b)">
        <circle cx="155" cy="160" r="9" fill="rgba(56,189,248,0.2)" stroke="rgba(56,189,248,0.8)" strokeWidth="1.5"/>
        <circle cx="155" cy="160" r="4" fill="#38bdf8"/>
        <circle cx="155" cy="160" r="16" fill="none" stroke="rgba(56,189,248,0.3)" strokeWidth="1">
          <animate attributeName="r"       values="9;22;9"   dur="3s" repeatCount="indefinite" begin="0.8s"/>
          <animate attributeName="opacity" values="0.4;0;0.4" dur="3s" repeatCount="indefinite" begin="0.8s"/>
        </circle>
      </g>

      {/* Pin 3 — Congestion (orange) */}
      <g>
        <circle cx="395" cy="170" r="9" fill="rgba(251,146,60,0.2)" stroke="rgba(251,146,60,0.8)" strokeWidth="1.5"/>
        <circle cx="395" cy="170" r="4" fill="#fb923c"/>
        <circle cx="395" cy="170" r="16" fill="none" stroke="rgba(251,146,60,0.3)" strokeWidth="1">
          <animate attributeName="r"       values="9;22;9"   dur="2.8s" repeatCount="indefinite" begin="1.5s"/>
          <animate attributeName="opacity" values="0.4;0;0.4" dur="2.8s" repeatCount="indefinite" begin="1.5s"/>
        </circle>
      </g>

      {/* ── Data panel overlay — bottom right */}
      <g>
        <rect x="340" y="300" width="190" height="100" rx="12" fill="rgba(13,18,32,0.92)" stroke="rgba(56,189,248,0.25)" strokeWidth="1"/>
        {/* Header */}
        <text x="356" y="323" fontSize="9" fontWeight="700" letterSpacing="1.5" fill="rgba(56,189,248,0.7)" textAnchor="start">LIVE CONFIDENCE</text>
        {/* Bars */}
        {[
          { y:336, w:130, label:'Accident — Ring Rd',  color:'#f87171' },
          { y:356, w:98,  label:'Waterlogging — MG Rd', color:'#38bdf8' },
          { y:376, w:75,  label:'Congestion — NH48',   color:'#fb923c' },
        ].map((b) => (
          <g key={b.label}>
            <rect x="356" y={b.y}     width="168" height="10" rx="5" fill="rgba(255,255,255,0.05)"/>
            <rect x="356" y={b.y}     width={b.w}  height="10" rx="5" fill={b.color} opacity="0.8"/>
            <text x="356" y={b.y+22}  fontSize="8" fill="rgba(255,255,255,0.35)">{b.label}</text>
          </g>
        ))}
      </g>

      {/* ── Mini card top-left */}
      <g>
        <rect x="24" y="118" width="115" height="65" rx="10" fill="rgba(13,18,32,0.9)" stroke="rgba(56,189,248,0.2)" strokeWidth="1"/>
        <text x="38" y="138" fontSize="8" fontWeight="700" letterSpacing="1.2" fill="rgba(56,189,248,0.6)">REPORTS TODAY</text>
        <text x="38" y="160" fontSize="22" fontWeight="900" fill="#38bdf8">128</text>
        <text x="80" y="160" fontSize="10" fill="rgba(74,222,128,0.8)">↑ 12%</text>
        <text x="38" y="175" fontSize="8" fill="rgba(255,255,255,0.3)">from 98 users</text>
      </g>

      {/* Connection line between pin-1 and data panel */}
      <line x1="280" y1="225" x2="340" y2="315" stroke="rgba(248,113,113,0.25)" strokeWidth="1" strokeDasharray="4 3"/>
      <line x1="155" y1="169" x2="140" y2="183" stroke="rgba(56,189,248,0.2)"  strokeWidth="1" strokeDasharray="4 3"/>
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────
   ABOUT VISUAL — animated rings
──────────────────────────────────────────────────────────────── */
function AboutVisual() {
  return (
    <svg viewBox="0 0 420 380" fill="none" style={{width:'100%',maxWidth:400,margin:'0 auto',display:'block'}}>
      <defs>
        <filter id="glow-a">
          <feGaussianBlur stdDeviation="3" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      <rect width="420" height="380" rx="20" fill="#070c1a"/>

      {/* Concentric rings */}
      {[140,105,72,40].map((r,i)=>(
        <circle key={r} cx="210" cy="190" r={r}
          stroke="rgba(56,189,248,0.12)" strokeWidth="1" fill="none"
          strokeDasharray={i%2===0?"8 6":"4 8"}
          style={{animation:`orbitSpin ${12+i*4}s linear infinite ${i%2===0?'':'reverse'}`}}
        />
      ))}

      {/* Central hub */}
      <circle cx="210" cy="190" r="28" fill="rgba(56,189,248,0.08)" stroke="rgba(56,189,248,0.4)" strokeWidth="1.5"/>
      <text x="210" y="196" textAnchor="middle" fontSize="22">🗺️</text>

      {/* Orbiting nodes */}
      {[
        { angle:  0,  r:105, color:'#f87171', icon:'⚠', label:'Report' },
        { angle: 90,  r:105, color:'#38bdf8', icon:'🤖', label:'AI Check' },
        { angle:180,  r:105, color:'#4ade80', icon:'✅', label:'Verify' },
        { angle:270,  r:105, color:'#fb923c', icon:'📡', label:'Broadcast' },
      ].map((n)=>{
        const rad = (n.angle * Math.PI) / 180;
        const cx  = 210 + Math.cos(rad) * n.r;
        const cy  = 190 + Math.sin(rad) * n.r;
        return (
          <g key={n.label} filter="url(#glow-a)">
            <circle cx={cx} cy={cy} r="22" fill="rgba(13,18,32,0.95)" stroke={n.color} strokeWidth="1.5" opacity="0.9"/>
            <text x={cx} y={cy+5} textAnchor="middle" fontSize="14">{n.icon}</text>
            <text x={cx} y={cy+20} textAnchor="middle" fontSize="8" fill={n.color} fontWeight="700">{n.label}</text>
          </g>
        );
      })}

      {/* Connector lines */}
      {[0,90,180,270].map(angle=>{
        const rad = (angle * Math.PI) / 180;
        const x2  = 210 + Math.cos(rad) * 83;
        const y2  = 190 + Math.sin(rad) * 83;
        return <line key={angle} x1="210" y1="190" x2={x2} y2={y2}
          stroke="rgba(56,189,248,0.2)" strokeWidth="1" strokeDasharray="4 4"/>;
      })}

      {/* Outer badges */}
      {[
        { angle: 45,  r:148, text:'24 Active' },
        { angle:135,  r:148, text:'98% Acc.' },
        { angle:225,  r:148, text:'12k+ Res.' },
        { angle:315,  r:148, text:'34s Avg.' },
      ].map(b=>{
        const rad = (b.angle*Math.PI)/180;
        const cx  = 210 + Math.cos(rad)*b.r;
        const cy  = 190 + Math.sin(rad)*b.r;
        return (
          <g key={b.text}>
            <rect x={cx-30} y={cy-10} width="60" height="20" rx="10" fill="rgba(56,189,248,0.07)" stroke="rgba(56,189,248,0.2)" strokeWidth="1"/>
            <text x={cx} y={cy+4} textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#38bdf8">{b.text}</text>
          </g>
        );
      })}
    </svg>
  );
}
