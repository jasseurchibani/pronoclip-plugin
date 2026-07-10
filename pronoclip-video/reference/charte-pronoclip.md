# Charte PronoClip — identité graphique et éditoriale

PronoClip vit au croisement du **football** et du **divertissement
numérique** : l'énergie d'un stade de nuit, l'esthétique d'un jeu vidéo.
Chaque vidéo et chaque caption doivent être reconnaissables en une seconde.

## Identité visuelle

- **Couleurs dynamiques** : les couleurs des équipes portent chaque vidéo
  (variables `--color-home` / `--color-away`), sur fond sombre.
- **Dominante néon** : accent lumineux (`--accent`) et halos (`--glow`) —
  le style `néon` est le style par défaut du plugin.
- **Typo sport condensée** : display condensée et impactante pour les noms
  d'équipes et le score (`--font-display`), sans-serif sobre pour le reste
  (`--font-body`).
- Silhouettes et aplats uniquement — jamais de logos ni de visages
  (voir `directives-legales.md`).

## Ton éditorial

- **Complice et énergique** : tutoiement, questions directes au spectateur,
  emojis football (⚽🔥🚨), phrases courtes qui claquent.
- On assume le pronostic (« on le sent », « on assume ») — jamais de ton
  professoral, jamais de certitude absolue.
- **Hashtags** : `#PronoClip` toujours en premier, puis les équipes du
  match (`#PSG #RealMadrid`), la compétition si pertinente.
- **Transparence** : chaque caption se termine par la mention
  `Pronostic — contenu généré par IA` (même obligation que dans la vidéo).

## 5 exemples de captions

```
🔥 Notre prono pour PSG – Real Madrid : 2-1 ! Et toi, tu le sens comment ? ⚽
#PronoClip #PSG #RealMadrid
Pronostic — contenu généré par IA
```

```
🚨 Choc de la journée ! On voit un 1-1 accroché entre l'OM et l'Inter…
T'es d'accord ou pas ? 👇
#PronoClip #OM #Inter
Pronostic — contenu généré par IA
```

```
⚡ 3-0 sec pour les Bleus ce soir ?! On assume. Balance ton score en
commentaire 👇
#PronoClip #France #Euro
Pronostic — contenu généré par IA
```

```
😤 Personne n'y croit, nous si : 0-2 à l'extérieur ! Rendez-vous après le
match… ⚽
#PronoClip #Barca #Bayern
Pronostic — contenu généré par IA
```

```
🏆 Soir de finale ! Nous, on dit 2-1 au bout du suspense… toi, tu dis
quoi ? 🔥
#PronoClip #LigueDesChampions
Pronostic — contenu généré par IA
```

## Variables CSS par style (pour `template-composition.html`)

À injecter dans le `:root` du template — les couleurs d'équipes
(`--color-home`, `--color-away` et leurs accents) restent toujours celles
du match, seul le thème change.

```css
/* ---- néon (DÉFAUT — cœur de l'identité PronoClip) ---- */
:root {
  --bg: #0a0a14;
  --fg: #f4f4ff;
  --accent: #00ffd0;
  --glow: 0 0 18px var(--accent);
  --font-display: "Archivo Black", system-ui, sans-serif;
  --font-body: "Inter", system-ui, sans-serif;
}

/* ---- réaliste-stylisé (ambiance retransmission TV, halos discrets) ---- */
:root {
  --bg: #0e1116;
  --fg: #e8edf2;
  --accent: #4da3ff;
  --glow: 0 0 8px rgba(77, 163, 255, 0.55);
}

/* ---- cartoon (aplats francs, zéro halo, contours épais) ---- */
:root {
  --bg: #12224e;
  --fg: #ffffff;
  --accent: #ffd93d;
  --glow: none;
}

/* ---- rétro (sépia stade années 70, grain léger) ---- */
:root {
  --bg: #1a120b;
  --fg: #f5e9d0;
  --accent: #ffb347;
  --glow: 0 0 6px rgba(255, 179, 71, 0.4);
}
```
