// Title Card direction — full portfolio page.
// Data is reproduced from the original site so each section has real content.
// Visual language: chunky color-blocked plaques, hard ink borders, drop shadows,
// the portrait's own palette only (cobalt, magenta, tan, brown, cream, ink).

const { useState, useEffect } = React;

// ─── SHARED CONTENT ─────────────────────────────────────────────────
// All copy, data, and links live in portfolio-data.js (loaded before this
// script via <script src> tag). Edit that file to change content; this
// file just lays it out.
const P = window.PORTFOLIO;
const NAV_SECTIONS = P.navSections;
const YT_ID = P.reel.ytId;
const employers = P.employers;
const pipelineWork = P.pipelineWork;
const skillGroups = P.skillGroups;
const galleryItems = P.galleryItems;
const devlogEntries = P.devlogEntries;

// ─── ICONS ──────────────────────────────────────────────────────────
const LinkedInIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.95v5.66H9.36V9h3.41v1.56h.05c.47-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.55C0 23.23.79 24 1.77 24h20.45C23.2 24 24 23.23 24 22.27V1.72C24 .77 23.2 0 22.22 0z"/></svg>
);
const GitHubIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.9 1.2 1.9 1.2 1.1 1.9 2.9 1.4 3.6 1 .1-.8.4-1.4.8-1.7-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.2-3.2-.1-.4-.5-1.6.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.6.2 2.8.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3"/></svg>
);
const ItchIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3.5 1.7C2.4 2.4.1 5 0 5.7v1c0 1.3 1.2 2.4 2.3 2.4 1.3 0 2.4-1.1 2.4-2.4 0 1.3 1 2.4 2.4 2.4 1.3 0 2.3-1.1 2.3-2.4 0 1.3 1.1 2.4 2.4 2.4h.4c1.3 0 2.4-1.1 2.4-2.4 0 1.3 1 2.4 2.3 2.4 1.4 0 2.4-1.1 2.4-2.4 0 1.3 1.2 2.4 2.4 2.4 1.2 0 2.3-1.1 2.3-2.4v-1c-.1-.7-2.4-3.3-3.5-4C20.7 1.6 16 1.5 12 1.5c-4 0-8.7.1-8.5.2zM10 9.6c-.5.7-1.4 1.2-2.3 1.2a3 3 0 0 1-2.4-1.2c-.6.7-1.4 1.2-2.4 1.2H3l1 4.7c.4 2.2 1 4.5 1.4 6 .8 1.4 5.6.9 6.6.9s5.8.5 6.6-.9c.4-1.5 1-3.8 1.4-6l1-4.7H21a3 3 0 0 1-2.4-1.2A3 3 0 0 1 16.3 11a3 3 0 0 1-2.3-1.2c-.6.7-1.2 1.2-2 1.2-.6 0-1.4-.5-2-1.2zm-1 3l1.4.1 1 .5c.3.3.5.6.5.9 0 .8-1 1.5-2.3 1.5-.4 0-.8 0-1.2-.2 0 0 1.7 2.5 4 2.6 2.2-.1 4-2.6 4-2.6-.4.2-.8.2-1.2.2-1.3 0-2.3-.7-2.3-1.5 0-.3.2-.6.4-.9.3-.2.7-.4 1.1-.5h1.3z"/></svg>
);

function SocialChips({ variant }) {
  return (
    <>
      {P.socials.map(s => {
        const Icon = s.id === 'linkedin' ? LinkedInIcon : s.id === 'github' ? GitHubIcon : ItchIcon;
        return (
          <a key={s.id} href={s.href} target="_blank" rel="noopener" className={`chip ${variant || ''}`}>
            <Icon /> {s.label.toUpperCase()}
          </a>
        );
      })}
    </>
  );
}

// ─── DARK MODE ──────────────────────────────────────────────────────
function useDarkMode() {
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);
  return [dark, setDark];
}

// ─── HEX ECHO SVG (matches the portrait's pentagon-pipe frame) ──────
// Hex outline, rendered slightly larger than the portrait and offset
// to the lower-right, like a stamp registration mark.
function HexEcho() {
  // flat-top hex with a slight horizontal stretch to echo the portrait's hex
  const pts = '12,50 35,8 88,8 108,50 88,92 35,92';
  return (
    <svg viewBox="0 0 120 100" preserveAspectRatio="none">
      <polygon points={pts} fill="var(--magenta-lt)" stroke="var(--magenta)" strokeWidth="2.5" />
      <polygon points={pts} fill="none" stroke="var(--ink)" strokeWidth="2.5" transform="translate(2.5 2.5)" />
    </svg>
  );
}

// ─── NAV ────────────────────────────────────────────────────────────
function Nav({ dark, setDark }) {
  return (
    <header className="marquee">
      <div className="marquee-top">
        <div className="l">★ KRJ Productions ★</div>
        <div className="r">
          <span>EST. 2006 · A PIPELINE PICTURE</span>
          <button className="theme-toggle" onClick={() => setDark(d => !d)} title="Toggle theme">
            {dark ? '☀ DAY' : '☾ NIGHT'}
          </button>
        </div>
      </div>
      <nav className="marquee-nav">
        {NAV_SECTIONS.map((s, i) => (
          <React.Fragment key={s.id}>
            {i > 0 && <span className="star">★</span>}
            <a href={`#${s.id}`}>{s.label.toUpperCase()}</a>
          </React.Fragment>
        ))}
      </nav>
    </header>
  );
}

// ─── HERO ───────────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="section">
      <div className="tc-bg-burst" />
      <div className="hero">
        <div className="hero-grid">
          <div>
            <div className="presenting">PRESENTING</div>
            <h1 className="hero-name"><span>K</span>rishna<br/><span>R</span>amos <span>J</span>ain!</h1>
            <div className="hero-role">{P.role}</div>
            <p className="hero-desc">{parseEmphasis(P.heroBlurb)}</p>
            <div className="hero-ctas">
              <a href="#reel" className="btn-big cobalt">WATCH MY REEL ▶</a>
              <a href="#pipeline" className="btn-big tan">SEE PIPELINE WORK</a>
              <a href="#contact" className="btn-big cream">GET IN TOUCH</a>
            </div>
            <div className="hero-socials">
              <SocialChips />
            </div>
          </div>
          <div className="portrait-wrap">
            <div className="portrait-hex"><HexEcho /></div>
            <div className="portrait"><img src="assets/cartoon_self_wrench.png" alt="Krishna Ramos Jain" /></div>
          </div>
        </div>
      </div>
      <div className="stats-strip">
        {P.stats.slice(0, 3).map((s, i) => (
          <div className="stat" key={i}><div className="n">{s.n}</div><div className="l">{s.label}</div></div>
        ))}
      </div>
    </section>
  );
}

// ─── REEL ───────────────────────────────────────────────────────────
function Reel() {
  const [playing, setPlaying] = useState(false);
  return (
    <section id="reel" className="section cobalt-wash">
      <div className="wrap">
        <div className="plaque cobalt"><span className="n">01</span>FEATURE PRESENTATION</div>
        <div className="reel-frame">
          <div className="marquee-strip">
            <span><span className="bulb"></span><span className="bulb"></span><span className="bulb"></span> NOW SHOWING</span>
            <span style={{ fontSize: 11, letterSpacing: '0.18em' }}>DEMO REEL · 2025</span>
          </div>
          {playing ? (
            <div style={{ aspectRatio: '16/9', background: '#000' }}>
              <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${YT_ID}?autoplay=1`} title="Demo Reel" frameBorder="0" allow="autoplay; encrypted-media" allowFullScreen style={{ border: 0, display: 'block' }} />
            </div>
          ) : (
            <div className="reel-thumb" onClick={() => setPlaying(true)}>
              <img src={`https://img.youtube.com/vi/${YT_ID}/maxresdefault.jpg`} alt="Demo Reel" />
              <div className="reel-play" />
            </div>
          )}
          <div className="reel-caption">★ Eighteen Years of Animation &amp; Pipeline Work ★ Click to Play ★</div>
        </div>
      </div>
    </section>
  );
}

// ─── CREDITS ────────────────────────────────────────────────────────
function Credits() {
  return (
    <section id="credits" className="section">
      <div className="wrap">
        <div className="plaque brown"><span className="n">02</span>ALSO STARRING</div>
        <div className="employer-stack">
          {employers.map((e, i) => (
            <div className={`employer-card ${i % 2 === 0 ? 'tilt-l' : 'tilt-r'}`} key={i}>
              <div className="employer-head">
                <span className="studio">{e.studio}</span>
                <span className="role">{e.role}</span>
                <span className="tenure">{e.tenure}</span>
              </div>
              <div className="employer-body">
                {e.projects.map((p, j) => (
                  <div className="project" key={j}>
                    <div className="client">{p.client}</div>
                    <div className="title">{p.title}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── PIPELINE ───────────────────────────────────────────────────────
function Pipeline() {
  return (
    <section id="pipeline" className="section tan-wash">
      <div className="wrap">
        <div className="plaque tan"><span className="n">03</span>BEHIND THE SCENES</div>
        <p className="pipeline-intro">{parseEmphasis(P.pipelineIntro)}</p>
        <div className="pipeline-grid">
          {pipelineWork.map((p, i) => (
            <div className="pipeline-card" key={i}>
              <div className="top">
                <span className="p-tag">{p.tag}</span>
                {p.selfInitiated && <span className="p-self">SELF-INITIATED</span>}
              </div>
              <h3>{p.title}</h3>
              <p>{p.body}</p>
              <div className="p-tools">
                {p.tools.map((t, j) => <span className="tool-chip" key={j}>{t}</span>)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── SKILLS ─────────────────────────────────────────────────────────
function Skills() {
  return (
    <section id="skills" className="section">
      <div className="wrap">
        <div className="plaque deep"><span className="n">04</span>TOOLS OF THE TRADE</div>
        <div className="skills-grid">
          {skillGroups.map((g, i) => (
            <div className="skill-block" key={i}>
              <h4>{g.title.toUpperCase()}</h4>
              <ul>
                {g.skills.map((s, j) => (
                  <li key={j} className={s.primary ? 'primary' : ''}>{s.name}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── GALLERY ────────────────────────────────────────────────────────
function Gallery() {
  const [lightbox, setLightbox] = useState(null);
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') setLightbox(null); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
  return (
    <section id="art" className="section magenta-wash">
      <div className="wrap">
        <div className="plaque magenta"><span className="n">05</span>ON DISPLAY</div>
        <div className="gallery-grid">
          {galleryItems.map((it, i) => (
            <div className="gal-item" key={i} onClick={() => setLightbox(it)}>
              {it.type === 'video'
                ? <video src={it.src} autoPlay loop muted playsInline onError={e => e.currentTarget.closest('.gal-item').style.display = 'none'} />
                : <img src={it.src} alt={it.label} loading="lazy" onError={e => e.currentTarget.closest('.gal-item').style.display = 'none'} />}
              <div className="gal-label">{it.label}</div>
            </div>
          ))}
        </div>
      </div>
      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <button className="lightbox-close" onClick={() => setLightbox(null)}>×</button>
          {lightbox.type === 'video'
            ? <video src={lightbox.src} autoPlay loop muted playsInline controls onClick={e => e.stopPropagation()} />
            : <img src={lightbox.src} alt={lightbox.label} onClick={e => e.stopPropagation()} />}
        </div>
      )}
    </section>
  );
}

// ─── DEVLOG ─────────────────────────────────────────────────────────
function Devlog() {
  const [open, setOpen] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  useEffect(() => {
    const h = (e) => {
      if (e.key !== 'Escape') return;
      if (lightbox) setLightbox(null);
      else if (open) setOpen(null);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, lightbox]);

  return (
    <section id="lab" className="section">
      <div className="wrap">
        <div className="plaque brown"><span className="n">06</span>FROM THE STUDIO</div>
        <div className="devlog-grid">
          {devlogEntries.map((e, i) => (
            <div className="devlog-card" key={i} onClick={() => setOpen(e)}>
              {e.media
                ? <img className="devlog-media" src={e.media} alt={e.title} loading="lazy" onError={ev => ev.currentTarget.style.display = 'none'} />
                : <div className="devlog-media-placeholder">IMAGE COMING SOON</div>}
              <div className="devlog-body">
                <div className="devlog-meta">
                  <span className="devlog-tag">{e.tag.toUpperCase()}</span>
                  <span className="devlog-date">{e.date}</span>
                </div>
                <div className="devlog-title">{e.title}</div>
                <p className="devlog-desc">{e.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(null)}>
          <div className="modal" onClick={ev => ev.stopPropagation()}>
            <button className="modal-close" onClick={() => setOpen(null)}>×</button>
            <div className="modal-meta">
              <span className="devlog-tag">{open.tag.toUpperCase()}</span>
              <span className="devlog-date">{open.date}</span>
            </div>
            <h2>{open.title}</h2>
            <p>{open.desc}</p>
            {open.itchUrl && (
              <a href={open.itchUrl} target="_blank" rel="noopener" className="chip magenta" style={{ marginBottom: 20 }}>
                READ FULL DEVLOG ON ITCH.IO →
              </a>
            )}
            <div className="modal-gallery">
              {[{ src: open.media, label: open.title }, ...(open.extraMedia || [])].map((m, j) => (
                <div className="gi" key={j} onClick={() => setLightbox(m)}>
                  <img src={m.src} alt={m.label} loading="lazy" />
                  {m.label && j > 0 && <div className="gi-cap">{m.label}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)} style={{ zIndex: 1000 }}>
          <button className="lightbox-close" onClick={() => setLightbox(null)}>×</button>
          <img src={lightbox.src} alt={lightbox.label} onClick={e => e.stopPropagation()} />
        </div>
      )}
    </section>
  );
}

// ─── ABOUT ──────────────────────────────────────────────────────────
function About() {
  return (
    <section id="about" className="section cobalt-wash">
      <div className="wrap">
        <div className="plaque cobalt"><span className="n">07</span>MEET THE ANIMATOR</div>
        <div className="about-grid">
          <div className="about-text">
            {P.aboutParagraphs.map((para, i) => (
              <p key={i}>{parseEmphasis(para)}</p>
            ))}
          </div>
          <div className="about-stats">
            <div className="about-stat"><div className="n">18</div><div className="l">Years in 2D animation production</div></div>
            <div className="about-stat"><div className="n">40+</div><div className="l">Pipeline tools written</div></div>
            <div className="about-stat"><div className="n">9+</div><div className="l">Productions credited</div></div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── FOOTER ─────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer id="contact">
      <div className="footer-inner">
        <div className="footer-end">THE END.</div>
        <div className="footer-top">
          <div>
            <h3>{P.name.toUpperCase()}</h3>
            <div className="footer-tagline">Pipeline Developer &amp; Animator, 2006 to present.</div>
          </div>
          <div className="footer-email">
            <a href={`mailto:${P.email}`}>{P.email}</a>
          </div>
        </div>
        <div className="footer-socials">
          <SocialChips variant="cobalt" />
        </div>
        <div className="footer-bottom" style={{ marginTop: 28 }}>
          <span>© 2026 Krishna Ramos Jain</span>
          <span>Roll Credits ·</span>
        </div>
      </div>
    </footer>
  );
}

// ─── APP ────────────────────────────────────────────────────────────
function App() {
  const [dark, setDark] = useDarkMode();
  return (
    <>
      <Nav dark={dark} setDark={setDark} />
      <Hero />
      <Reel />
      <Credits />
      <Pipeline />
      <Skills />
      <Gallery />
      <Devlog />
      <About />
      <Footer />
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
