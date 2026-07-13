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
