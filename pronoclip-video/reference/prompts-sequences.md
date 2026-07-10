# Prompts de séquences — plans visuels de match (generate_image)

Prompts pour le skill `sequences-match`. Chaque plan = prompt positif +
negative prompt + variables couleurs + déclinaison de cadrage par format.

## Variables

| Variable | Contenu | Exemple |
|---|---|---|
| `{color_home}` | couleur maillot domicile (nom + hex) | `deep navy blue (#004170)` |
| `{color_away}` | couleur maillot extérieur | `white (#ffffff)` |
| `{color_winner}` | couleur du vainqueur pronostiqué | `deep navy blue (#004170)` |

Toujours donner **le nom de la couleur ET le hex** dans le prompt : les
modèles d'image suivent mieux les noms, le hex lève l'ambiguïté.

## Negative prompt commun (base `prompts-visuels-pro`)

À embarquer dans CHAQUE génération :

```
club logos, team crests, brand logos, sponsor marks, competition emblems,
recognizable faces, real player likeness, portrait features, jersey numbers,
text, letters, words, captions, watermark, signature, deformed hands,
extra fingers, distorted limbs, low quality, jpeg artifacts
```

**Negative renforcé** (retry après détection d'un logo/visage/texte) :
ajouter en tête `(no logo:1.4), (no face:1.4), (no text:1.4)` et préciser
dans le positif `plain unbranded jerseys, anonymous silhouettes`.

## Déclinaisons de cadrage par format

| Format | Cadrage à ajouter au prompt |
|---|---|
| 9:16 | `vertical composition, tall framing, subject centered in lower two-thirds, headroom for overlay text` |
| 1:1 | `square composition, subject centered, balanced negative space` |
| 16:9 | `wide cinematic composition, subject on rule-of-thirds, lateral depth` |

---

## Plan 1 — AMBIANCE

**Positif** :

```
night football stadium seen from the stands, packed crowd in shadow,
colored smoke flares in {color_home} and {color_away}, floodlights with
neon glow, stylized illustration, cinematic haze, vibrant rim lighting,
dark background, no text
```

**Négatif** : commun. **Animation cible** : Ken Burns + pulsation fumigènes.

## Plan 2 — FACE-À-FACE

**Positif** :

```
two football players seen from behind, anonymous silhouettes facing each
other, one wearing a plain unbranded {color_home} jersey, the other a plain
unbranded {color_away} jersey, dramatic low-key lighting, fog, strong rim
light, stylized neon illustration, clean backs with no numbers
```

**Négatif** : commun (insister : `jersey numbers, name prints`).
**Animation cible** : parallax 2 calques (remove-background) + slow zoom.

## Plan 3 — ACTION

**Positif** :

```
football strike in full silhouette, dynamic kicking pose, long light
trails following the ball, painterly motion blur, speed streaks, neon
accents in {color_home} and {color_away}, high contrast dark arena
background, energy burst composition
```

**Négatif** : commun. **Animation cible** : zoom-punch 0.4 s + speed lines —
choisir une image dont la diagonale d'action « appelle » ce mouvement.

## Plan 4 — CÉLÉBRATION

**Positif** :

```
euphoric football crowd celebrating, arms raised in silhouette, confetti
rain in {color_winner}, stadium floodlights flaring, neon glow, stylized
illustration, joyful explosion of light, dark stands background
```

**Négatif** : commun (insister : `recognizable faces`).
**Animation cible** : shake + confettis CSS + flash blanc.

## Plan 5 — TIFO (option, fond du carton final)

**Positif** :

```
abstract geometric tifo pattern, bold diagonal shapes alternating
{color_home} and {color_away}, flat vector style with subtle neon glow,
seamless background texture, no figures, no text
```

**Négatif** : commun. **Animation cible** : dérive lente en fond du carton
final (translation diagonale continue, très subtile).

---

## Exemples de résultat attendu

**Plan 2 pour PSG vs Real Madrid (9:16)** — image verticale sombre : deux
joueurs de dos en contre-plongée légère, silhouettes nettes détourées par un
rim light froid, maillot bleu nuit uni à gauche, maillot blanc uni à droite,
dos parfaitement vierges (ni numéro ni flocage), nappe de brume au sol,
halos néon discrets ; le tiers supérieur reste sombre et dégagé pour
l'overlay texte. Rien d'identifiable : ni écusson, ni visage, ni typo.

**Plan 4 pour un vainqueur pronostiqué PSG (9:16)** — foule en silhouette
massée dans les tribunes, bras levés, pluie de confettis bleu nuit
(#004170) éclairée par les projecteurs, éclats de lumière néon, aucune
banderole lisible, aucun visage net ; l'énergie monte vers le haut du
cadre, prête pour le shake + flash d'entrée.
