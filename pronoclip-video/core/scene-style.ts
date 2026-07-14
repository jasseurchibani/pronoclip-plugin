// Bloc de style + bloc négatif partagés par les 8 prompts (cf. MISSION §4).
// Porté de lib/scene-style.ts du site, avec DEUX corrections obligatoires :
//  - retrait de « crisp legible badges and sponsor logos » (violait les directives
//    légales : ni logo, ni écusson, ni sponsor — et la règle « aucun texte ») ;
//  - maillots en aplat de couleur uni, sans flocage ni numéro (Décision A2 + légal).

export const STYLE_BLOCK = `A premium 2D digital sports illustration in a sharp,
semi-realistic anime style, matching the exact dark, intense match-scene aesthetic
of Blue Lock and Vinland Saga. Strict 2D hand-drawn digital painting with fine ink
linework. Completely flat 2D graphic novel art style. No 3D rendering, no CGI
elements, no glossy plastic shading, no chibi features. Fully realistic human
proportions; sharp, narrow, intensely focused eyes of realistic human size. Highly
defined facial anatomy, sharp jawlines, broad athletic shoulders, realistic hand
anatomy with visible knuckles. High-end 2D animated film skin shading with a smooth
5-tone gradient (bright specular highlight, light midtone, base skin, warm shadow,
deep shadow). Plain solid-colour jerseys with smooth light-to-shadow gradients,
fabric folds as curved ink lines, absolutely no crest, no badge, no sponsor, no
lettering and no number on the kit. High-contrast dramatic lighting: key light from
above-front, warm orange-gold fill on side shadows, sharp cool blue rim light on the
opposite silhouette. 4K, flawless 2D digital anime concept art, 9:16 portrait
format, ultra-fine ink outline weight.`

export const NEGATIVE_BLOCK = `photorealistic, 3D render, CGI, glossy plastic
shading, chibi, oversized cartoon eyes, blurry, watermark, deformed hands, extra
fingers, realistic photograph, low quality, jpeg artifacts, text, letters, numbers,
captions, scoreboard, score, club crest, team badge, competition logo, sponsor logo,
shirt name, identifiable real player faces, real-person likeness`

// ── Tier ANIMATED (image→vidéo) : 3D cinématique ─────────────────────────────
// On ne se bat plus contre le prior vidéo-réel du modèle i2v (cf. correction §2) :
// le style est un rendu 3D cinématique « moteur de jeu haut de gamme » (type
// cinématique EA Sports). Ainsi la première frame et la dernière sont dans le MÊME
// registre — plus d'effondrement anime→3D. Réservé au tier animated ; le tier motion
// garde STYLE_BLOCK (anime 2D).
export const STYLE_BLOCK_ANIMATED = `A premium cinematic 3D render in the style of a
high-end sports video-game cinematic (next-gen console intro, EA Sports FC style):
stylised-realistic 3D athletes, physically based rendering, realistic skin and cloth
shading with subsurface detail, dramatic volumetric stadium lighting, filmic depth of
field, motion-graphics polish, high-contrast cinematic colour grade. Fully realistic
human proportions and anatomy, expressive but grounded faces. Plain solid-colour kit,
absolutely no crest, no badge, no sponsor, no lettering and no number on the kit. 4K,
ultra-detailed real-time cinematic 3D, 9:16 portrait framing.`

// NEGATIVE inversé pour le tier animated : on bannit le 2D/anime (garde le reste).
export const NEGATIVE_BLOCK_ANIMATED = `2D, anime, manga, cel-shaded, hand-drawn, flat
illustration, comic, line art, cartoon, sketch, watercolour, blurry, watermark,
deformed hands, extra fingers, low quality, jpeg artifacts, text, letters, numbers,
captions, scoreboard, score, club crest, team badge, competition logo, sponsor logo,
brand logo, nike, adidas, puma, swoosh, badge, emblem, sponsor text, shirt number,
shirt name, identifiable real player faces, real-person likeness`
