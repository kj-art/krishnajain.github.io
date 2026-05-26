// Title Card direction — full portfolio page.
// Data is reproduced from the original site so each section has real content.
// Visual language: chunky color-blocked plaques, hard ink borders, drop shadows,
// the portrait's own palette only (cobalt, magenta, tan, brown, cream, ink).

const { useState, useEffect } = React;

// ─── DATA ───────────────────────────────────────────────────────────
const NAV_SECTIONS = [
  { id: 'reel',     label: 'Reel' },
  { id: 'credits',  label: 'Credits' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'skills',   label: 'Skills' },
  { id: 'art',      label: 'Art' },
  { id: 'lab',      label: 'Lab' },
  { id: 'about',    label: 'About' },
  { id: 'contact',  label: 'Contact' },
];

const YT_ID = '79AOg9Q983I';

const employers = [
  { studio: 'Powerhouse Animation Studios', role: 'Lead Technical Artist', tenure: '2014 to 2025',
    projects: [
      { client: 'Netflix', title: 'Castlevania' },
      { client: 'Netflix', title: 'Masters of the Universe: Revelation' },
      { client: 'Netflix', title: 'Blood of Zeus' },
      { client: 'Netflix', title: 'Tomb Raider' },
      { client: 'Platform / Square Enix', title: "Final Fantasy XV: A King's Tale" },
      { client: 'Platform / Deep Silver', title: 'Dead Island: Retro Revenge' },
      { client: 'Stoic Studio', title: 'The Banner Saga' },
  ]},
  { studio: 'Zynga', role: 'Senior Artist', tenure: '2010 to 2012',
    projects: [
      { client: 'Facebook', title: 'Kingdoms and Quests' },
      { client: 'Facebook', title: 'The Ville' },
  ]},
  { studio: 'Team Chaos LLC', role: 'Freelance Animator', tenure: '2012 to 2013',
    projects: [
      { client: 'iOS', title: 'Dragon Academy' },
      { client: 'iOS', title: 'Elements: Broken Lands' },
  ]},
  { studio: 'Powerhouse Animation Studios', role: 'Lead Flash Developer', tenure: '2006 to 2010',
    projects: [
      { client: 'Sony / Red 5', title: 'Freerealms' },
      { client: 'Hothead Games', title: 'Penny Arcade Adventures' },
  ]},
];

const pipelineWork = [
  { tag: 'After Effects scripting', title: 'Keylighting Automation', selfInitiated: true,
    body: "Retrieves preset character compositions from a database and applies them based on scene and character. Also enables bulk saving of new, location-specific comps. Eliminated manual searching and setup across hundreds of shots.",
    tools: ['ExtendScript', 'After Effects', 'JSON Database'] },
  { tag: 'Toon Boom + AE scripting', title: 'Lighting Pass System', selfInitiated: true,
    body: "Replaced frame-by-frame manual tone coloring with a fully automated pipeline. Exports separate light and shadow sequences from Harmony, then imports and composites them in After Effects with correct timing. No re-coloring needed for lighting adjustments.",
    tools: ['Qt Script', 'ExtendScript', 'Toon Boom Harmony', 'After Effects'] },
  { tag: 'Animate scripting', title: 'Chain Animation Tool', selfInitiated: true,
    body: "A JSFL tool that automates chain link placement along a drawn path with controls for scaling and twisting. What was once a tedious manual process for Castlevania became a one-click workflow.",
    tools: ['JSFL', 'Adobe Animate'] },
  { tag: 'Toon Boom + Python', title: 'Import/Export Scripts', selfInitiated: false,
    body: "A suite of scripts built across productions to move assets and scene data between software without losing information. The largest example exports Storyboard Pro scenes to Photoshop and Clip Studio Paint with camera movements intact, with render farm network integration. Many others handle similar cross-software handoffs throughout the pipeline.",
    tools: ['Qt Script', 'Python', 'Storyboard Pro', 'Photoshop', 'Clip Studio Paint'] },
  { tag: 'Google Apps Script', title: 'Production Tracking Dashboard', selfInitiated: false,
    body: "Task-tracking tools built in Google Sheets and Apps Script, giving managers real-time visibility into deadlines and tasks across departments. No additional software licenses required.",
    tools: ['Google Apps Script', 'Google Sheets', 'ftrack API'] },
  { tag: 'ActionScript / AIR', title: 'Sprite Sheet Export Tool', selfInitiated: true,
    body: "An Adobe AIR application that automated sprite sheet exports for a Zynga game team, reducing manual asset prep and accelerating delivery cycles for live social games.",
    tools: ['ActionScript 3', 'Adobe AIR'] },
];

const skillGroups = [
  { title: 'Animation Software', skills: [
    { name: 'Adobe Animate', primary: true },
    { name: 'Toon Boom Harmony', primary: true },
    { name: 'Toon Boom Storyboard Pro', primary: true },
    { name: 'Adobe After Effects' },
    { name: 'Adobe Photoshop' },
    { name: 'Aseprite / Pixquare' },
  ]},
  { title: 'Scripting Languages', skills: [
    { name: 'ExtendScript (AE, Photoshop)', primary: true },
    { name: 'JSFL (Adobe Animate)', primary: true },
    { name: 'Qt Script (Toon Boom suite)', primary: true },
    { name: 'Python 3', primary: true },
    { name: 'Google Apps Script' },
    { name: 'ActionScript 2 / 3' },
  ]},
  { title: 'Pipeline Coverage', skills: [
    { name: 'Preproduction to delivery', primary: true },
    { name: 'Asset management systems', primary: true },
    { name: 'Cross-software workflows', primary: true },
    { name: 'Render farm integration' },
    { name: 'ftrack API' },
    { name: 'Production tracking tools' },
  ]},
  { title: 'Animation Specialties', skills: [
    { name: 'Character animation', primary: true },
    { name: 'Effects animation', primary: true },
    { name: 'Puppet / rigging', primary: true },
    { name: 'Pixel / 8-bit animation' },
    { name: 'Motion comic styles' },
    { name: 'Traditional frame-by-frame' },
  ]},
];

const galleryItems = [
  // Note: StrikeThereAndBackAgain_fb.mp4 was in the original site data but the
  // file isn't in the repo. Add it back here once the asset is committed.
  { src: 'assets/bear_morning_final.png', label: "Bear Morning, children's book illustration" },
  { src: 'assets/moon_slice.png',         label: "Moon slice, children's book mood thumbnail" },
  { src: 'assets/night_final.png',        label: "Night scene, children's book mood thumbnail" },
  { src: 'assets/leaf.png',               label: 'Leaf, illustration' },
  { src: 'assets/leaf2_color.png',        label: 'Leaf and the Twisted Root, illustration' },
  { src: 'assets/kaz_adjust.png',         label: 'Kaz, character illustration' },
  { src: 'assets/scorch_and_kavos.png',   label: 'Scorch and Kavos, D&D characters' },
  { src: 'assets/dragon_character.jpg',   label: 'Dragon, character illustration' },
  { src: 'assets/LunaAndZoey.png',        label: 'Luna and Zoey' },
  { src: 'assets/Zoey.png',               label: 'Zoey, character illustration' },
  { src: 'assets/Irene.png',              label: 'Irene, character illustration' },
  { src: 'assets/EmmaAndSophie2025.png',  label: 'Portrait studies' },
  { src: 'assets/kavos_design_sheet.png', label: 'Kavos, character design sheet' },
  { src: 'assets/roppu_kun.jpg',          label: "Roppu-kun, inspired by Yoh Yoshinari's Tezuka tribute" },
];

const devlogEntries = [
  { tag: 'Spine rigging', date: 'Apr 17, 2026', title: 'Miya rig in Spine',
    desc: "Rigged Miya in Spine for a side-by-side comparison with the original After Effects version. Spine opens up smooth transitions between animations that frame-by-frame can't do as cleanly. Another version is in progress.",
    media: 'assets/miya_spine.gif', mediaType: 'gif',
    extraMedia: [{ src: 'assets/miya_spine_bones.gif', label: 'Spine skeleton view' }] },
  { tag: 'Experiment', date: 'Apr 13, 2026', title: 'Sprite stacking for isometric character animation',
    desc: "Investigated sprite stacking as a way to get isometric character rotations for free. Large shapes looked great and moved convincingly in 3D, with precise rotation at any angle. Even experimented with building poses in MagicaVoxel. The catch: fine details flickered badly on export. The idea is probably shelved for now, but the large-form results were genuinely impressive.",
    media: 'assets/sprite_stacking_test.gif', mediaType: 'gif',
    itchUrl: 'https://bluebeezle.itch.io/mitama-ji/devlog/1488963/sprite-stacking' },
  { tag: 'Unity 2D', date: 'Nov 29, 2025', title: 'Dynamic lighting and shadows in Unity',
    desc: "Ghost story games require ghost story lighting. Isometric pixel game with a dynamic shadow and lighting system. Normal maps work for front-lighting, but when the player walks in front of a light, a naive setup lights her up as if the light is shining through her body. The fix: an auto-generated backlit rimlight normal map, with a shader that blends between the two based on the player's position relative to each light.",
    media: 'assets/dynamic_lighting_test.gif', mediaType: 'gif',
    itchUrl: 'https://bluebeezle.itch.io/mitama-ji/devlog/1129446/lighting-shaders-and-normal-maps' },
  { tag: 'Normal map pipeline', date: 'Nov 27, 2025', title: 'Auto-generated normal maps from layer data',
    desc: "Updated my Python Aseprite sprite sheet exporter to automatically generate normal maps by detecting edges on each layer's silhouette and creating gradients that approximate surface normals. It won't be perfect since the script doesn't know the actual geometry, but it's a solid starting point. Since every body part is already on its own layer, the top of the arm reads as north-facing even when it's halfway down the sprite.",
    media: 'assets/Miya_walk.png', mediaType: 'img',
    extraMedia: [
      { src: 'assets/Miya_walk_nm_Backlit.png',  label: 'Back-lit normal map' },
      { src: 'assets/Miya_walk_nm_Frontlit.png', label: 'Front-lit normal map' },
    ],
    itchUrl: 'https://bluebeezle.itch.io/mitama-ji/devlog/1129446/lighting-shaders-and-normal-maps' },
  { tag: 'Aseprite scripting', date: 'Sep 27, 2025', title: 'Self-colored outline script',
    desc: "A script for Aseprite that automatically adds self-colored outlines across all frames, based on a palette layer that maps each color to its outline equivalent. Outlines are added on a separate layer, so you can erase selectively where they don't work. The character above looks fine without outlines because of his thin design, but since the outlines are added as a separate layer, removing them where I see fit is trivial.",
    media: 'assets/self_colored_outline_before.jpg', mediaType: 'img',
    extraMedia: [{ src: 'assets/self_colored_outline_after.jpg', label: 'After, Self-Colored Outline layer active' }] },
  { tag: 'Photoshop scripting', date: 'Feb 19, 2024', title: 'Walk cycle consistency checker',
    desc: "A Photoshop script that pulls the same frame of animation from all directional walk cycle PSDs and puts them side by side, so inconsistencies between views are immediately visible. The before/after above shows exactly the kind of discrepancies it surfaces.",
    media: 'assets/before.gif', mediaType: 'gif',
    extraMedia: [{ src: 'assets/after.gif', label: 'After edit pass' }] },
  { tag: 'Character Design', date: 'Jan 31, 2022', title: 'Ghost character, night and day',
    desc: "Character design for a ghost fairy NPC. I was playing with an idea where the day version of ghosts would appear weaker with less detail. Considering the extra work that entailed, I dropped the idea pretty quickly.",
    media: 'assets/ghost_character_rig.jpg', mediaType: 'img' },
  { tag: 'After Effects animation', date: 'Feb 8, 2021', title: 'RPG portrait animation, Miya (angry)',
    desc: "A looping RPG-style dialogue portrait built entirely in After Effects. Angry blink, wind-driven hair, anime speed lines in fore and background, broom held menacingly, subtle head rotation. Illustrated and animated from scratch.",
    media: 'assets/miya_portrait_animation.gif', mediaType: 'gif' },
];

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
      <a href="https://www.linkedin.com/in/krishna-jain-938b7222/" target="_blank" rel="noopener" className={`chip ${variant || ''}`}>
        <LinkedInIcon /> LINKEDIN
      </a>
      <a href="https://github.com/kj-art/developer-portfolio" target="_blank" rel="noopener" className={`chip ${variant || ''}`}>
        <GitHubIcon /> GITHUB
      </a>
      <a href="https://itch.io/profile/bluebeezle" target="_blank" rel="noopener" className={`chip ${variant || ''}`}>
        <ItchIcon /> ITCH.IO
      </a>
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
            <h1 className="hero-name">Krishna<br/>Ramos <span>Jain!</span></h1>
            <div className="hero-role">Pipeline Developer &amp; Animator</div>
            <p className="hero-desc">
              18 years animating and <b>automating 2D pipelines</b> at <b>Powerhouse Animation Studios</b>. I've written the scripts that made the pipelines for productions such as <b>Netflix's Castlevania, Blood of Zeus, and Masters of the Universe</b> faster. My tools cover the entire pipeline, from preproduction through delivery.
            </p>
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
        <div className="stat"><div className="n">18</div><div className="l">Yrs in production</div></div>
        <div className="stat"><div className="n">9+</div><div className="l">Productions credited</div></div>
        <div className="stat"><div className="n">6</div><div className="l">Scripting languages</div></div>
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
        <p className="pipeline-intro">
          When I spot a repetitive task, I <b>build a tool</b>, often without being asked.
          When I'm assigned a problem, I look for the solution that helps the whole pipeline,
          not just the immediate task. The scripts below are a sample of that work across
          eighteen years of production.
        </p>
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
            <p>
              I graduated from <b>SCAD with a BFA in Animation</b> and spent the early part of my career building a programming department at Powerhouse Animation from scratch, first by making games in Actionscript, and then by creating tools and automating pipelines throughout the production process.
			</p>
			<p>
			Over 18 years I grew into a genuinely rare combination: someone who can <b>animate at a professional level and write production scripts that change how a studio operates.</b> I've done both across major streaming, console, and indie game productions at Powerhouse Animation.
			</p>
			<p>
			I'm looking for roles where that combination matters. <b>2D pipeline developer, pipeline TD, or character and effects animation work.</b> If your studio has a list of "we really should fix this someday" tasks, I've probably already built something for it.
            </p>
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
            <h3>KRISHNA RAMOS JAIN</h3>
            <div className="footer-tagline">Pipeline Developer &amp; Animator, 2006 to present.</div>
          </div>
          <div className="footer-email">
            <a href="mailto:krishna@krishnajain.com">krishna@krishnajain.com</a>
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
