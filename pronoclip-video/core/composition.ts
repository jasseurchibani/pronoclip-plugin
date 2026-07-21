// Composition HTML→MP4 (cf. MISSION §8). Génère une page animée de 40 s au-dessus des
// 8 images fixes : Ken Burns par plan, transitions, overlays (caption, buteur, type de
// but, score incrémental, scoreboard final), filigrane IA persistant, carton de fin.
// AUCUN texte n'est cuit dans les images : tout le texte est overlay HTML (§4/§13).
// Charte : fond #0A0A0A, accent #33D17A EN ACCENT seulement, jamais en aplat.
// Pur : renvoie une chaîne HTML, aucune I/O. La cible de prod est le CLI HyperFrames ;
// cette même page est capturable en local (Chrome headless) pour le mode dégradé.

import type { MatchScript, Shot } from './types'
import { GOAL_TYPE_LABELS } from './labels'

export interface CompositionConfig {
  brand: { colors: { background: string; accent: string } }
  ai_disclosure: { watermark: string; end_card: string[] }
  video: { scene_length_seconds: number }
}

export interface CompositionInput {
  script: MatchScript
  /** 8 sources d'image (chemins relatifs à la page, ou URLs), dans l'ordre des plans. */
  images: string[]
  config: CompositionConfig
}

const GOAL_TYPES = new Set(Object.keys(GOAL_TYPE_LABELS))

/** Ken Burns par type de plan (cf. §8 : push-in reveals, whip-pan face-off, punch-in buts). */
function kenBurns(sceneType: string): string {
  if (sceneType === 'team_reveal' || sceneType === 'rival_reveal' || sceneType === 'final_result') return 'pushin'
  if (sceneType === 'face_off') return 'whippan'
  if (GOAL_TYPES.has(sceneType) || sceneType === 'goal_montage') return 'punchin'
  return 'drift'
}

/** Construit la timeline JS (score cumulé, captions) à partir des plans. */
function buildTimeline(script: MatchScript, images: string[], shotMs: number) {
  let home = 0
  let away = 0
  return script.shots.map((s: Shot, i) => {
    const isGoal = GOAL_TYPES.has(s.sceneType)
    if (isGoal) {
      if (s.teamSide === 'home') home++
      else if (s.teamSide === 'away') away++
    }
    // side : pilote le panneau généré (fallback sans image) — teinte home/away/both.
    const side = s.teamSide === 'home' || s.teamSide === 'away' || s.teamSide === 'both' ? s.teamSide : 'none'
    return {
      src: images[i] ?? '',
      sceneType: s.sceneType,
      motion: kenBurns(s.sceneType),
      side,
      caption: s.caption,
      scorer: isGoal ? s.playerName : null,
      goalType: isGoal ? (GOAL_TYPE_LABELS[s.goalType!] ?? '') : null,
      isGoal,
      justScored: isGoal, // déclenche le flash du score-bug à l'entrée du plan
      home,
      away,
      startMs: i * shotMs,
    }
  })
}

export function buildComposition(input: CompositionInput): string {
  const { script, images, config } = input
  const shotMs = config.video.scene_length_seconds * 1000
  const total = script.shots.length * shotMs
  const endCardMs = 2000 // 2 dernières secondes du plan 8
  const bg = config.brand.colors.background
  const accent = config.brand.colors.accent
  const watermark = config.ai_disclosure.watermark
  const endCard = config.ai_disclosure.end_card

  const data = {
    total,
    shotMs,
    endCardMs,
    homeShort: script.match.home.slice(0, 3).toUpperCase(),
    awayShort: script.match.away.slice(0, 3).toUpperCase(),
    finalHome: script.prediction.score.home,
    finalAway: script.prediction.score.away,
    shots: buildTimeline(script, images, shotMs),
  }

  // NB : la page expose window.__renderAt(ms) (capture déterministe) ET un autoplay rAF.
  return `<div id="pronoclip-stage">
  <div id="layers"></div>
  <div id="scorebug"><span class="tm">${data.homeShort}</span><b id="sc-h">0</b><i>–</i><b id="sc-a">0</b><span class="tm">${data.awayShort}</span></div>
  <div id="lower"><span id="caption"></span><span id="scorer"></span></div>
  <div id="watermark"></div>
  <div id="endcard"><div class="ec-inner"></div></div>
</div>
<style>
  #pronoclip-stage{position:relative;width:100%;max-width:1080px;aspect-ratio:9/16;margin:0 auto;
    background:${bg};overflow:hidden;font-family:Inter,system-ui,Arial,sans-serif;color:#fff;}
  #layers,#layers .shot{position:absolute;inset:0;}
  #layers .shot{opacity:0;}
  #layers .shot img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;
    transform-origin:center;will-change:transform,opacity;}
  /* Panneau généré (fallback sans image) — dégradé on-charte, teinté par camp. Le texte
     reste 100% overlay ; le panneau est purement graphique. Accent EN ACCENT (filet). */
  #layers .shot .panel{position:absolute;inset:0;transform-origin:center;will-change:transform;
    background:radial-gradient(circle at 50% 40%,#191919,${bg} 72%);}
  #layers .shot .panel.home{background:radial-gradient(circle at 50% 38%,rgba(51,120,220,.30),${bg} 68%);}
  #layers .shot .panel.away{background:radial-gradient(circle at 50% 38%,rgba(220,60,60,.28),${bg} 68%);}
  #layers .shot .panel.both{background:radial-gradient(circle at 50% 38%,#1e211d,${bg} 70%);}
  #layers .shot .panel::after{content:"";position:absolute;left:8%;right:8%;bottom:33%;height:2px;
    background:linear-gradient(90deg,transparent,${accent},transparent);opacity:.55;}
  /* Score-bug (haut) — accent EN ACCENT (filet), jamais en aplat */
  #scorebug{position:absolute;top:3%;left:50%;transform:translateX(-50%);display:flex;align-items:center;
    gap:.5rem;padding:.4rem .9rem;background:rgba(10,10,10,.72);border-bottom:2px solid ${accent};
    border-radius:6px;font-weight:800;font-size:clamp(14px,3.4vw,26px);letter-spacing:.04em;}
  #scorebug .tm{opacity:.85;font-weight:700;}
  #scorebug b{min-width:1.1em;text-align:center;}
  #scorebug i{opacity:.6;font-style:normal;}
  #scorebug.flash{box-shadow:0 0 0 2px ${accent}, 0 0 24px ${accent};}
  /* Lower third — caption + buteur */
  #lower{position:absolute;left:5%;right:5%;bottom:9%;display:flex;flex-direction:column;gap:.35rem;}
  #caption{font-weight:800;font-size:clamp(18px,5.2vw,40px);line-height:1.05;text-transform:uppercase;
    padding-left:.6rem;border-left:4px solid ${accent};text-shadow:0 2px 12px rgba(0,0,0,.8);}
  #scorer{font-weight:600;font-size:clamp(13px,3.4vw,24px);opacity:.95;padding-left:.7rem;
    text-shadow:0 2px 10px rgba(0,0,0,.8);}
  /* Filigrane IA persistant */
  #watermark{position:absolute;right:3%;bottom:3.2%;font-size:clamp(10px,2.4vw,16px);font-weight:600;
    opacity:.72;letter-spacing:.02em;text-shadow:0 1px 6px rgba(0,0,0,.9);}
  /* Carton de fin */
  #endcard{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
    background:rgba(10,10,10,.94);opacity:0;pointer-events:none;padding:8%;text-align:center;}
  #endcard .ec-inner{border-top:3px solid ${accent};border-bottom:3px solid ${accent};padding:1.4rem 0;max-width:90%;}
  #endcard p{margin:.5rem 0;}
  #endcard .ec0{font-weight:800;font-size:clamp(16px,4.6vw,32px);}
  #endcard .ec1{font-weight:500;font-size:clamp(12px,3.2vw,20px);opacity:.9;}
</style>
<script id="pronoclip-data" type="application/json">${JSON.stringify(data)}</script>
<script>
(function(){
  var D=JSON.parse(document.getElementById('pronoclip-data').textContent);
  var layers=document.getElementById('layers');
  D.shots.forEach(function(s){var d=document.createElement('div');d.className='shot';
    var media;
    if(s.src){media=document.createElement('img');media.src=s.src;}
    else{media=document.createElement('div');media.className='panel '+(s.side||'none');} // panneau généré
    d.appendChild(media);layers.appendChild(d);});
  var shotEls=[].slice.call(layers.children);
  var wm=document.getElementById('watermark');wm.textContent=${JSON.stringify(watermark)};
  var ec=document.querySelector('#endcard .ec-inner');
  ec.innerHTML='<p class="ec0">'+${JSON.stringify(endCard[0] ?? '')}+'</p><p class="ec1">'+${JSON.stringify(endCard[1] ?? '')}+'</p>';
  var cap=document.getElementById('caption'),scorer=document.getElementById('scorer'),
      scH=document.getElementById('sc-h'),scA=document.getElementById('sc-a'),
      sb=document.getElementById('scorebug'),endcard=document.getElementById('endcard');

  function motionTransform(motion,p){ // p in [0,1] local progress
    if(motion==='pushin')  return 'scale('+(1.02+0.12*p)+')';
    if(motion==='punchin') return 'scale('+(1.18-0.12*p)+')';
    if(motion==='whippan') return 'scale(1.1) translateX('+(8-16*p)+'%)';
    return 'scale('+(1.04+0.05*p)+') translateY('+(-2*p)+'%)'; // drift
  }
  function idxAt(t){var i=Math.floor(t/D.shotMs);return Math.max(0,Math.min(D.shots.length-1,i));}

  window.__DURATION=D.total;
  window.__renderAt=function(t){
    if(t>D.total)t=D.total;
    var i=idxAt(t), s=D.shots[i], local=(t-s.startMs)/D.shotMs;
    shotEls.forEach(function(el,j){
      var on=j===i;
      // transition : fondu (reveals/face_off/final) ~ .5s ; coupe franche sur les buts
      var fade=(s.motion!=='punchin');
      var op=on?1:0;
      if(on&&fade){op=Math.min(1,local/ (0.14));}
      el.style.opacity=op;
      var img=el.firstChild;
      if(on)img.style.transform=motionTransform(s.motion,Math.max(0,Math.min(1,local)));
    });
    // Overlays §8 séparés : gros = type de but (buts) ou caption de scène ; sous = buteur.
    cap.textContent=s.isGoal?(s.goalType||'BUT'):(s.caption||'');
    scorer.textContent=s.scorer||'';
    scorer.style.display=s.scorer?'block':'none';
    scH.textContent=s.home;scA.textContent=s.away;
    // flash du score-bug ~.5s après un but
    var flash=s.isGoal&&local<0.5;sb.classList.toggle('flash',!!flash);
    // scoreboard final = score plein plan sur final_result (déjà via score-bug) + carton de fin
    var intoEnd=t>(D.total-D.endCardMs);
    endcard.style.opacity=intoEnd?Math.min(1,(t-(D.total-D.endCardMs))/400):0;
  };

  // Autoplay pour visionnage direct dans un navigateur (la capture, elle, appelle __renderAt).
  var start=null;
  function loop(ts){if(start===null)start=ts;var t=ts-start;window.__renderAt(t);
    if(t<D.total)requestAnimationFrame(loop);}
  if(!window.__CAPTURE__)requestAnimationFrame(loop);
})();
</script>`
}
