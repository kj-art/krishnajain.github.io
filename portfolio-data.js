// Shared portfolio content.
// Edit this file. Both "Portfolio - Title Card.html" and the RPG iso page
// (and any future direction) read from here, so changes show up everywhere.
// No JSX, no React; just data + small helper functions.

window.PORTFOLIO = {

  // ─── IDENTITY ────────────────────────────────────────────────────
  name: 'Krishna Ramos Jain',
  role: 'Pipeline Developer & Animator',
  email: 'krishna@krishnajain.com',
  yearStarted: 2006,

  // Hero blurb. Plain string, but use [b]...[/b] to mark words that should
  // render bold/highlighted in the design. Each page renders these its own way.
  heroBlurb:
    "18 years animating and [b]automating 2D pipelines[/b] at [b]Powerhouse Animation Studios[/b]. "
    + "I've written the scripts that made the pipelines for productions such as "
    + "[b]Netflix's Castlevania, Blood of Zeus, and Masters of the Universe[/b] faster. "
    + "My tools cover the entire pipeline, from preproduction through delivery.",

  // ─── NAV ─────────────────────────────────────────────────────────
  navSections: [
    { id: 'reel',     label: 'Reel' },
    { id: 'credits',  label: 'Credits' },
    { id: 'pipeline', label: 'Pipeline' },
    { id: 'skills',   label: 'Skills' },
    { id: 'art',      label: 'Art' },
    { id: 'lab',      label: 'Lab' },
    { id: 'about',    label: 'About' },
    { id: 'contact',  label: 'Contact' },
  ],

  // ─── SOCIAL ──────────────────────────────────────────────────────
  socials: [
    { id: 'linkedin', label: 'LinkedIn', href: 'https://www.linkedin.com/in/krishna-jain-938b7222/' },
    { id: 'github',   label: 'GitHub',   href: 'https://github.com/kj-art/developer-portfolio' },
    { id: 'itch',     label: 'itch.io',  href: 'https://itch.io/profile/bluebeezle' },
  ],

  // ─── REEL ────────────────────────────────────────────────────────
  reel: {
    ytId: '5wvPKSvf6ps',
    caption: 'Eighteen Years of Animation & Pipeline Work',
  },

  // ─── CREDITS ─────────────────────────────────────────────────────
  employers: [
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
  ],

  // ─── PIPELINE WORK ───────────────────────────────────────────────
  pipelineWork: [
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
  ],
  pipelineIntro:
    "When I spot a repetitive task, I [b]build a tool[/b], often without being asked. "
    + "When I'm assigned a problem, I look for the solution that helps the whole pipeline, "
    + "not just the immediate task. The scripts below are a sample of that work across "
    + "eighteen years of production.",

  // ─── SKILLS ──────────────────────────────────────────────────────
  skillGroups: [
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
  ],

  // ─── ART GALLERY ─────────────────────────────────────────────────
  // type: 'video' for .mp4, omit for images
  galleryItems: [
    { src: 'assets/StrikeThereAndBackAgain_fb.mp4', type: 'video', label: 'Strike! There and Back Again, D&D animation' },
    { src: 'assets/bear_morning_final.png', label: "Bear Morning, children's book illustration" },
    { src: 'assets/moon_slice.png',         label: "Moon slice, children's book mood thumbnail" },
    { src: 'assets/night_final.png',        label: "Night scene, children's book mood thumbnail" },
    { src: 'assets/leaf.png',               label: 'Leaf, illustration' },
    { src: 'assets/leaf2_color.png',        label: 'Leaf and the Twisted Root, illustration' },
    { src: 'assets/miya_portrait_animation.gif', label: 'Miya, RPG dialogue portrait (After Effects)' },
    { src: 'assets/miya_portrait_pixel.gif', label: 'Miya, RPG dialogue portrait (Pixquare)' },
    { src: 'assets/kaz_adjust.png',         label: 'Kaz, character illustration' },
    { src: 'assets/scorch_and_kavos.png',   label: 'Scorch and Kavos, D&D characters' },
    { src: 'assets/dragon_character.jpg',   label: 'Dragon, character illustration' },
    { src: 'assets/LunaAndZoey.png',        label: 'Luna and Zoey' },
    { src: 'assets/Zoey.png',               label: 'Zoey, character illustration' },
    { src: 'assets/Irene.png',              label: 'Irene, character illustration' },
    { src: 'assets/EmmaAndSophie2025.png',  label: 'Portrait studies' },
    { src: 'assets/kavos_design_sheet.png', label: 'Kavos, character design sheet' },
    { src: 'assets/roppu_kun.jpg',          label: "Roppu-kun, inspired by Yoh Yoshinari's Tezuka tribute" },
    { src: 'assets/ghost_character_rig.jpg',          label: "Yokai, character illustration" },
  ],

  // ─── DEVLOG ──────────────────────────────────────────────────────
  // Most recent first. To add a post, prepend a new entry.
  devlogEntries: [
    { tag: ['Pixel Art', 'Scripting', 'Pixquare', 'Aseprite'], date: 'Jun 20, 2026', title: 'Miya traditional pixel animation in Pixquare',
      desc: "Sometimes the old ways are the best. I created a speed line script in Aseprite to make that part of the process easier. As much as possible, I've kept different lighting on different layers in case I want to use dynamic lighting. This is particularly important with the rim lighting, which is actively destructive to the art underneath it.",
      media: 'assets/miya_portrait_pixel.gif', mediaType: 'gif',
      extraMedia: [
        { src: 'assets/Miya_angry_pixel_timelapse.mp4', label: 'Timelapse' },
        { src: 'assets/speed_lines_script.png', label: 'Speed line script in Aseprite' },
      ]
    },
    { tag: 'Spine', date: 'Apr 17, 2026', title: 'Miya rig in Spine',
      desc: "Rigged Miya in Spine as a proof-of-concept for a side-by-side comparison with the original After Effects version. Spine opens up the potential for smooth transitions between animations that frame-by-frame can't do as cleanly.",
      media: 'assets/miya_spine.gif', mediaType: 'gif',
      extraMedia: [{ src: 'assets/miya_spine_bones.gif', label: 'Spine skeleton view' }] },
    { tag: 'Pixel Art', date: 'Apr 13, 2026', title: 'Sprite stacking for isometric character animation',
      desc: "Investigated sprite stacking as a way to get isometric character rotations for free. Large shapes looked great and moved convincingly in 3D, with precise rotation at any angle. Even experimented with building poses in MagicaVoxel. The catch: fine details flickered badly on export. The idea is probably shelved for now, but the large-form results were genuinely impressive.",
      media: 'assets/sprite_stacking_test.gif', mediaType: 'gif',
      itchUrl: 'https://bluebeezle.itch.io/mitama-ji/devlog/1488963/sprite-stacking' },
    { tag: ['Unity', 'Pixel Art'], date: 'Nov 29, 2025', title: 'Dynamic lighting and shadows in Unity',
      desc: "Ghost story games require ghost story lighting. Isometric pixel game with a dynamic shadow and lighting system. Normal maps work for front-lighting, but when the player walks in front of a light, a naive setup lights her up as if the light is shining through her body. The fix: an auto-generated backlit rimlight normal map, with a shader that blends between the two based on the player's position relative to each light.",
      media: 'assets/dynamic_lighting_test.gif', mediaType: 'gif',
      itchUrl: 'https://bluebeezle.itch.io/mitama-ji/devlog/1129446/lighting-shaders-and-normal-maps' },
    { tag: ['Pixel Art', 'Aseprite'], date: 'Nov 27, 2025', title: 'Auto-generated normal maps from layer data',
      desc: "Updated my Python Aseprite sprite sheet exporter to automatically generate normal maps by detecting edges on each layer's silhouette and creating gradients that approximate surface normals. It won't be perfect since the script doesn't know the actual geometry, but it's a solid starting point. Since every body part is already on its own layer, the top of the arm reads as north-facing even when it's halfway down the sprite.",
      media: 'assets/Miya_walk.png', mediaType: 'img',
      extraMedia: [
        { src: 'assets/Miya_walk_nm_Backlit.png',  label: 'Back-lit normal map' },
        { src: 'assets/Miya_walk_nm_Frontlit.png', label: 'Front-lit normal map' },
      ],
      itchUrl: 'https://bluebeezle.itch.io/mitama-ji/devlog/1129446/lighting-shaders-and-normal-maps' },
    { tag: ['Pixel Art', 'Scripting', 'Aseprite'], date: 'Sep 27, 2025', title: 'Self-colored outline script',
      desc: "A script for Aseprite that automatically adds self-colored outlines across all frames, based on a palette layer that maps each color to its outline equivalent. Outlines are added on a separate layer, so you can erase selectively where they don't work. The character above looks fine without outlines because of his thin design, but since the outlines are added as a separate layer, removing them where I see fit is trivial.",
      media: 'assets/self_colored_outline_before.jpg', mediaType: 'img',
      extraMedia: [{ src: 'assets/self_colored_outline_after.jpg', label: 'After, Self-Colored Outline layer active' }] },
    { tag: ['Photoshop', 'Scripting'], date: 'Feb 19, 2024', title: 'Walk cycle consistency checker',
      desc: "A Photoshop script that pulls the same frame of animation from all directional walk cycle PSDs and puts them side by side, so inconsistencies between views are immediately visible. The before/after above shows exactly the kind of discrepancies it surfaces.",
      media: 'assets/before.gif', mediaType: 'gif',
      extraMedia: [{ src: 'assets/after.gif', label: 'After edit pass' }] },
    { tag: 'Character Design', date: 'Jan 31, 2022', title: 'Ghost character, night and day',
      desc: "Character design for a ghost fairy NPC. I was playing with an idea where the day version of ghosts would appear weaker with less detail. Considering the extra work that entailed, I dropped the idea pretty quickly.",
      media: 'assets/ghost_character_rig.jpg', mediaType: 'img' },
    { tag: 'After Effects', date: 'Feb 8, 2021', title: 'RPG portrait animation, Miya (angry)',
      desc: "A looping RPG-style dialogue portrait built entirely in After Effects. Angry blink, wind-driven hair, anime speed lines in fore and background, broom held menacingly, subtle head rotation. Illustrated and animated from scratch.",
      media: 'assets/miya_portrait_animation.gif', mediaType: 'gif' },
  ],

  // ─── ABOUT ───────────────────────────────────────────────────────
  // Each entry is one paragraph. [b]...[/b] marks bold/emphasis.
  aboutParagraphs: [
    "I graduated from [b]SCAD with a BFA in Animation[/b] and spent the early part of my career building a programming department at Powerhouse Animation from scratch, first by making games in Actionscript, and then by creating tools and automating pipelines throughout the production process.",
    "Over 18 years I grew into a genuinely rare combination: someone who can [b]animate at a professional level and write production scripts that change how a studio operates.[/b] I've done both across major streaming, console, and indie game productions at Powerhouse Animation.",
    "I'm looking for roles where that combination matters. [b]2D pipeline developer, pipeline TD, or character and effects animation work.[/b] If your studio has a list of \"we really should fix this someday\" tasks, I've probably already built something for it.",
  ],

  // ─── STATS ───────────────────────────────────────────────────────
  // Used by hero strip, about block, RPG HUD, etc.
  stats: [
    { n: '18',   label: 'Years in production' },
    { n: '9+',   label: 'Productions credited' },
    { n: '6',    label: 'Scripting languages' },
    { n: '40+',  label: 'Pipeline tools written' },
  ],
};

// ─── HELPER: parse [b]…[/b] markers into React children ──────────────
// Each page can render plain text, but most want bold inline. Use this
// helper from a JSX file as:  parseEmphasis(PORTFOLIO.heroBlurb)
// which returns an array of strings and React <b> elements.
window.parseEmphasis = function(text) {
  if (!text) return [];
  // Lazy: only import React if it's there; otherwise return plain strings.
  const R = window.React;
  const out = [];
  const re = /\[b\]([\s\S]*?)\[\/b\]/g;
  let last = 0, m;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (R) out.push(R.createElement('b', { key: key++ }, m[1]));
    else   out.push(m[1]);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
};
