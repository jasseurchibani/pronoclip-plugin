# Scripts de narration PronoClip — gabarits

Gabarits de voix off pour le skill `audio-narration`. Calibrage :
**~2,5 mots/s** — une vidéo de 12 s supporte ~30 mots. Chaque gabarit suit
les 4 beats de la composition : hook (0–2 s) → annonce (2–5 s) → tension
(5–9 s) → punchline + CTA (9–12 s), un fichier WAV par beat.

Variables : `{home}` `{away}` `{score}` `{pseudo}` — remplacées avant TTS.

**Transparence IA** : si la mention « Pronostic — contenu généré par IA »
n'est pas clairement lisible à l'écran, ajouter le tag oral de fin
(dernière ligne de chaque gabarit, entre parenthèses = optionnel sinon).

---

## 1. Hype — commentateur surchauffé

### FR

| Beat | Texte |
|---|---|
| hook | Accrochez-vous, ça va chauffer ! |
| annonce | {home}, {away} : le choc de la journée ! |
| tension | Et nous, on le sent venir… on le sent… {score} ! |
| punchline | Prono signé {pseudo} — t'en dis quoi ? Dis-le en commentaire ! |
| *(tag IA)* | *(Pronostic généré par IA !)* |

### EN

| Beat | Texte |
|---|---|
| hook | Hold on tight, this one's on fire! |
| annonce | {home} versus {away} — the clash of the day! |
| tension | And we can feel it coming… we call it… {score}! |
| punchline | {pseudo}'s prediction — what's yours? Drop it below! |
| *(tag IA)* | *(AI-generated prediction!)* |

---

## 2. Analyse froide — data et sang-froid

### FR

| Beat | Texte |
|---|---|
| hook | Les chiffres ne mentent pas. |
| annonce | {home} face à {away} : tout est dans les données. |
| tension | Forme, historique, dynamique… verdict : {score}. |
| punchline | Prono calculé pour {pseudo}. À vous de débattre. |
| *(tag IA)* | *(Pronostic généré par IA.)* |

### EN

| Beat | Texte |
|---|---|
| hook | Numbers don't lie. |
| annonce | {home} against {away}: it's all in the data. |
| tension | Form, history, momentum… the verdict: {score}. |
| punchline | Computed for {pseudo}. Now you argue. |
| *(tag IA)* | *(AI-generated prediction.)* |

---

## 3. Humour — second degré assumé

### FR

| Beat | Texte |
|---|---|
| hook | Alerte prono pas sérieux… quoique. |
| annonce | {home} reçoit {away} — priez pour vos coupons. |
| tension | Notre boule de cristal affiche… {score} ! |
| punchline | Si ça passe, {pseudo} est un génie. Sinon, on n'a rien dit ! |
| *(tag IA)* | *(Pronostic généré par IA, hein !)* |

### EN

| Beat | Texte |
|---|---|
| hook | Warning: unserious prediction… or is it? |
| annonce | {home} hosts {away} — pray for your betting slips. |
| tension | Our crystal ball says… {score}! |
| punchline | If it lands, {pseudo}'s a genius. If not, we said nothing! |
| *(tag IA)* | *(AI-generated prediction, just saying!)* |

---

## Règles d'adaptation

- Durée ≠ 12 s : garder les 4 beats, ajuster le nombre de mots
  (~2,5 mots/s par beat), jamais couper la punchline.
- La langue vient de `langue_captions` dans `./pronoclip-data/config.json` ;
  autres langues : traduire un gabarit en conservant registre et rythme.
- Ton charte PronoClip (`charte-pronoclip.md`) : complice et énergique,
  on assume le prono, jamais professoral.
