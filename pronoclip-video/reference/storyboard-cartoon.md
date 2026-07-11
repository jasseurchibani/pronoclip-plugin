# Storyboard cartoon — trames, style et règles

Référence de l'équipe `studio-cartoon` : le scénariste y prend ses trames,
le directeur artistique son bloc de style, le compositeur ses recettes
d'animation.

## Bloc de style cartoon (préfixe commun de TOUS les prompts d'un match)

```
2D cartoon illustration, bold clean outlines, flat cel-shaded colors,
exaggerated proportions, big expressive eyes, squash and stretch poses,
vibrant saturated palette on dark stadium background, soccer theme,
no text, no logos, no crests, no realistic faces
```

Ajouter ensuite : les designs des personnages (character sheet du
storyboard, répétée mot pour mot sur chaque plan), le décor/action/gag de
la scène, le cadrage du format (9:16 : `vertical composition, headroom for
overlay text`), puis le negative prompt commun de `prompts-sequences.md`
**+ `SOCCER, no helmets, no shoulder pads`** (retour d'expérience : le mot
« football » seul dérive vers le football américain).

## Règles de character design (bloquantes)

- Personnages **originaux** : mascottes animales anthropomorphes, robots,
  avatars géométriques — aux couleurs des maillots, **sans écusson**.
- **Interdits** : caricature d'un joueur réel, nom de joueur, physique
  signature (coiffure, tatouage, célébration reconnaissable, numéro fétiche
  associé à un joueur), mascotte officielle d'un club ou d'une compétition.
- Deux personnages par match maximum (un par équipe) + figurants foule.

## Trames types (le scénariste en choisit une et la tord)

### 1. Le duel des mascottes (défaut)

1. **Ouverture (0–3 s)** — les deux mascottes entrent dans le stade
   cartoon ; gag d'entrée (trébuche, glissade, ballon rebelle).
2. **Confrontation (3–6 s)** — face-à-face regard dans les yeux, muscles
   gonflés vs air malin ; éclairs entre les regards.
3. **L'action du score (6–10 s)** — enchaînement burlesque : frappes,
   arrêts exagérés, le tableau d'affichage s'affole puis se fige sur le
   score pronostiqué.
4. **Chute + carton (10–15 s)** — la mascotte gagnante célèbre (danse,
   confettis), la perdante boude avec un gag tendre ; carton final
   « Pronostic de @pseudo — PronoClip » + CTA.

### 2. Les montagnes russes

Le ballon devient un wagon de montagnes russes qui traverse le stade ;
chaque virage marque un but (compteur qui grimpe) ; arrivée sur le score
final, les mascottes descendent du wagon décoiffées.

### 3. La météo du match

Un présentateur mascotte annonce la « météo » du match : pluie de ballons
côté vainqueur, petit nuage au-dessus du perdant ; la carte météo affiche
le score pronostiqué en isobares.

## Recettes d'animation (pour le compositeur, via /gsap)

| Intention | Recette |
|---|---|
| Entrée de mascotte | slide-in + `ease: "bounce.out"`, léger squash à l'atterrissage (`scaleY: 0.85` puis retour `elastic.out`) |
| Gag / impact | zoom-punch 0.3 s `back.out(3)` + shake 3 répétitions |
| Tableau d'affichage | compteur `snap: { innerText: 1 }` + sursaut `scale 1.15` sur le chiffre final |
| Célébration | confettis CSS aux couleurs du vainqueur + flash blanc 2 frames + jiggle `rotation: ±4°` fini |
| Transition de scène | wipe cartoon (cercle qui se ferme/s'ouvre, `clip-path`) calé sur les fenêtres du storyboard |

Toutes les recettes restent **seek-safe** : boucles finies uniquement,
aucun `repeat: -1` (contrat HyperFrames).

## Contraintes de durée

- 12 s par défaut, 15 s maximum (borne du cahier des charges : 5–15 s).
- 4 à 6 scènes ; jamais moins de 2 s par scène ;
- le carton final garde au moins 2,5 s (lisibilité du CTA mobile).
