// Génère index.html : composition HyperFrames GSAP, calques détourés (bg + sujet),
// caméra par type de plan, overlays. Déterministe (aucun random/date).
import { writeFileSync } from 'node:fs'

const SHOT = 5 // s par plan
const BG = '#0A0A0A', ACCENT = '#33D17A'
const WATERMARK = 'Vidéo générée par IA'
const ENDCARD = ['Vidéo générée par intelligence artificielle — PronoClip',
                 'Contenu de divertissement. Aucun pari, aucune mise, aucun gain.']

// n=1..8 ; motion ∈ pushin|whippan|punchin|save|celebrate ; caption ; scorer? ; speed?
const scenes = [
  { motion: 'pushin',   caption: 'REAL MADRID',                   },
  { motion: 'pushin',   caption: 'FC BARCELONE',                  },
  { motion: 'whippan',  caption: 'REAL MADRID  VS  FC BARCELONE', },
  { motion: 'punchin',  caption: 'BUT : MBAPPÉ',    scorer: 'Frappe · Mbappé',      speed: true },
  { motion: 'punchin',  caption: 'BUT : VINÍCIUS JR', scorer: 'Frappe · Vinícius Jr', speed: true },
  { motion: 'save',     caption: 'ARRÊT DÉCISIF',                 },
  { motion: 'celebrate',caption: 'CÉLÉBRATION',                   },
  { motion: 'pushin',   caption: 'SCORE FINAL',                   },
]
const total = scenes.length * SHOT
// score-bug : états successifs (clip lifecycle) — REA x–y FCB
const scoreStates = [
  { txt: 'REA  0 – 0  FCB', start: 0,  dur: 15 },
  { txt: 'REA  1 – 0  FCB', start: 15, dur: 5  },
  { txt: 'REA  2 – 0  FCB', start: 20, dur: 20 },
]

const layers = scenes.map((s, i) => {
  const n = i + 1, T = i * SHOT
  const goal = s.motion === 'punchin'
  return `
    <!-- PLAN ${n} : ${s.motion} -->
    <img class="clip layer" id="bg${n}"  src="assets/bg${n}.jpg" data-start="${T}" data-duration="${SHOT}" data-track-index="0" />
    <img class="clip layer" id="sub${n}" src="assets/sub${n}.png" data-start="${T}" data-duration="${SHOT}" data-track-index="1" />
    ${s.speed ? `<div class="clip speedlines" id="speed${n}" data-start="${T}" data-duration="${SHOT}" data-track-index="2"></div>` : ''}
    <div class="clip caption" id="cap${n}" data-start="${T}" data-duration="${SHOT}" data-track-index="7">${s.caption}</div>
    ${s.scorer ? `<div class="clip scorer" id="scorer${n}" data-start="${T}" data-duration="${SHOT}" data-track-index="6">${s.scorer}</div>` : ''}`
}).join('\n')

const scoreEls = scoreStates.map((s, k) =>
  `<div class="clip scorebug" id="sb${k + 1}" data-start="${s.start}" data-duration="${s.dur}" data-track-index="8">${s.txt}</div>`
).join('\n    ')

// --- GSAP timeline ---
const tw = []
scenes.forEach((s, i) => {
  const n = i + 1, T = i * SHOT
  if (s.motion === 'pushin') {
    tw.push(`tl.fromTo("#bg${n}",{scale:1.05},{scale:1.16,duration:${SHOT},ease:"none"},${T});`)
    tw.push(`tl.fromTo("#bg${n}",{opacity:0},{opacity:1,duration:0.35},${T});`)
    tw.push(`tl.fromTo("#sub${n}",{scale:1.09,y:0},{scale:1.26,y:-24,duration:${SHOT},ease:"none"},${T});`)
  } else if (s.motion === 'whippan') {
    tw.push(`tl.fromTo("#bg${n}",{x:70,scale:1.12,opacity:0},{x:0,scale:1.06,opacity:1,duration:${SHOT},ease:"power2.out"},${T});`)
    tw.push(`tl.fromTo("#sub${n}",{x:150},{x:0,duration:${SHOT},ease:"power2.out"},${T});`)
  } else if (s.motion === 'punchin') {
    tw.push(`tl.fromTo("#bg${n}",{scale:1.24},{scale:1.06,duration:1.2,ease:"power3.out"},${T});`)
    tw.push(`tl.fromTo("#sub${n}",{scale:1.5,rotation:-3,x:-10},{scale:1.02,rotation:0,x:0,duration:0.55,ease:"power4.out"},${T});`)
    tw.push(`tl.to("#sub${n}",{x:14,duration:${SHOT - 0.55},ease:"sine.inOut"},${T + 0.55});`)
    tw.push(`tl.fromTo("#speed${n}",{opacity:0},{opacity:0.9,duration:0.16,ease:"power1.out"},${T});`)
    tw.push(`tl.to("#speed${n}",{opacity:0,duration:0.8,ease:"power1.in"},${T + 0.16});`)
  } else if (s.motion === 'save') {
    tw.push(`tl.fromTo("#bg${n}",{scale:1.18,opacity:0},{scale:1.05,opacity:1,duration:${SHOT},ease:"power2.out"},${T});`)
    tw.push(`tl.fromTo("#sub${n}",{scale:1.34,x:-24},{scale:1.0,x:0,duration:0.7,ease:"power4.out"},${T});`)
  } else if (s.motion === 'celebrate') {
    tw.push(`tl.fromTo("#bg${n}",{scale:1.06,opacity:0},{scale:1.14,opacity:1,duration:${SHOT},ease:"sine.inOut"},${T});`)
    tw.push(`tl.fromTo("#sub${n}",{scale:1.08,y:12},{scale:1.22,y:-14,duration:${SHOT},ease:"sine.inOut"},${T});`)
  }
  // caption slide-in
  tw.push(`tl.fromTo("#cap${n}",{opacity:0,y:34},{opacity:1,y:0,duration:0.5,ease:"power2.out"},${T});`)
  if (s.scorer) tw.push(`tl.fromTo("#scorer${n}",{opacity:0,y:20},{opacity:1,y:0,duration:0.5,ease:"power2.out"},${T + 0.15});`)
})
// score-bug pops
tw.push(`tl.fromTo("#sb1",{opacity:0},{opacity:1,duration:0.4},0);`)
tw.push(`tl.fromTo("#sb2",{scale:0.6,opacity:0},{scale:1,opacity:1,duration:0.45,ease:"back.out(2)"},15);`)
tw.push(`tl.fromTo("#sb3",{scale:0.6,opacity:0},{scale:1,opacity:1,duration:0.45,ease:"back.out(2)"},20);`)
// end card (2 dernières s)
tw.push(`tl.fromTo("#endcard",{opacity:0},{opacity:1,duration:0.4},${total - 2});`)

const html = `<!doctype html>
<html lang="fr" data-resolution="portrait">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=1080, height=1920" />
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { width:1080px; height:1920px; overflow:hidden; background:${BG}; }
    body { font-family:"Inter",sans-serif; color:#fff; }
    #root { position:absolute; inset:0; background:${BG}; }
    .layer { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; transform-origin:center center; will-change:transform,opacity; }
    .speedlines { position:absolute; inset:-10%; pointer-events:none;
      background:repeating-linear-gradient(112deg, rgba(255,255,255,0) 0 26px, rgba(255,255,255,.55) 26px 29px);
      mix-blend-mode:screen; opacity:0; }
    .scorebug { position:absolute; top:60px; left:50%; transform:translateX(-50%);
      padding:14px 30px; background:rgba(10,10,10,.72); border-bottom:4px solid ${ACCENT};
      border-radius:12px; font-weight:800; font-size:44px; letter-spacing:.04em; white-space:nowrap; }
    .caption { position:absolute; left:64px; right:64px; bottom:210px; font-weight:800;
      font-size:82px; line-height:1.02; text-transform:uppercase; padding-left:26px;
      border-left:10px solid ${ACCENT}; text-shadow:0 4px 24px rgba(0,0,0,.85); }
    .scorer { position:absolute; left:74px; right:64px; bottom:150px; font-weight:600;
      font-size:44px; opacity:.96; text-shadow:0 3px 16px rgba(0,0,0,.85); }
    .watermark { position:absolute; right:44px; bottom:44px; font-size:30px; font-weight:600;
      opacity:.72; letter-spacing:.02em; text-shadow:0 2px 10px rgba(0,0,0,.9); }
    #endcard { position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
      background:rgba(10,10,10,.94); opacity:0; padding:120px 90px; text-align:center; }
    #endcard .inner { border-top:5px solid ${ACCENT}; border-bottom:5px solid ${ACCENT}; padding:48px 0; }
    #endcard .e0 { font-weight:800; font-size:56px; line-height:1.15; }
    #endcard .e1 { font-weight:500; font-size:38px; opacity:.9; margin-top:22px; }
  </style>
</head>
<body>
  <div id="root" data-composition-id="main" data-start="0" data-duration="${total}" data-width="1080" data-height="1920">
${layers}

    ${scoreEls}

    <div class="clip watermark" id="watermark" data-start="0" data-duration="${total}" data-track-index="9">${WATERMARK}</div>

    <div class="clip" id="endcard" data-start="${total - 2}" data-duration="2" data-track-index="10">
      <div class="inner"><div class="e0">${ENDCARD[0]}</div><div class="e1">${ENDCARD[1]}</div></div>
    </div>
  </div>

  <script>
    window.__timelines = window.__timelines || {};
    const tl = gsap.timeline({ paused: true });
    ${tw.join('\n    ')}
    window.__timelines["main"] = tl;
  </script>
</body>
</html>
`
writeFileSync('index.html', html, 'utf8')
console.log('index.html écrit —', total, 's,', scenes.length, 'plans')
