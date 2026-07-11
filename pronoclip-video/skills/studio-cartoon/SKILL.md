---
name: studio-cartoon
description: >-
  Utiliser quand l'utilisateur veut une vidéo de pronostic en version dessin
  animé, un match en cartoon, une animation avec mascottes, ou la version
  animée de chaque match de la journée. Déclencher aussi sur "dessin animé",
  "cartoon", "mascotte", "version animée", "anime le match".
---

# Studio cartoon — équipe d'agents IA pour vidéos dessin animé

Produit la version **dessin animé** d'un match : une équipe de 4 agents
spécialisés travaille en chaîne, comme un mini-studio d'animation. C'est la
déclinaison cartoon du pipeline `video-pronostic` (le style `cartoon` du
cahier des charges §2.4), avec en plus une **modération finale
systématique** (§2.7).

## L'équipe (agents/)

| Ordre | Agent | Rôle | Sortie contractuelle |
|---|---|---|---|
| 1 | `scenariste-cartoon` | storyboard 4–6 scènes, gags, personnages ORIGINAUX | JSON storyboard |
| 2 | `directeur-artistique-cartoon` | prompts cohérents + `generate_image` RapidoCMS + QC | JSON plans gelés |
| 3 | `video-composer` | composition HyperFrames (thème cartoon) + rendu local | JSON `{status, mp4_path…}` |
| 4 | `verificateur-legal` | modération adversariale des frames rendues | JSON verdict OK/REJET |

Chaque agent a son fichier dans `agents/` avec ses règles complètes —
l'orchestrateur (ce skill) ne fait que dispatcher, vérifier les contrats
JSON et boucler.

## Workflow

### Étape 0 — Références et entrées

- Charger `reference/storyboard-cartoon.md`, `reference/charte-pronoclip.md`
  et `reference/directives-legales.md`.
- Entrées requises : celles du skill `video-pronostic` (équipes, score,
  compétition, kickoff — refuser si incomplet). Durée : 12 s par défaut,
  15 s max. Style imposé : `cartoon` (thème CSS cartoon de la charte).

### Étape 1 — Scénario

Dispatcher **`scenariste-cartoon`** avec les données du match. Vérifier le
JSON : 4–6 scènes, champs complets, personnages originaux (pas de nom de
joueur réel). Storyboard invalide → 1 redispatch avec le motif, puis échec.

### Étape 2 — Direction artistique

Dispatcher **`directeur-artistique-cartoon`** avec le storyboard. Il rend
les plans gelés dans `.media/sequences/`. `status: "KO"` → logger, basculer
le match en mode `--light` cartoon (formes CSS, sans images) plutôt que
bloquer.

### Étape 3 — Composition et rendu

Dispatcher **`video-composer`** avec le brief habituel **+ deux champs** :
`storyboard` (le JSON de l'étape 1) et `plans` (la liste de l'étape 2).
Le compositeur mappe les scènes du storyboard sur les fenêtres du template,
applique le **thème cartoon** de la charte (variables CSS) et les recettes
d'animation de `storyboard-cartoon.md` (bounce, squash & stretch, wipes),
puis lint + validate + rendu local.

### Étape 4 — Modération (bloquante)

Dispatcher **`verificateur-legal`** avec le chemin du MP4.

- `verdict: "OK"` → continuer (log, publication éventuelle) ;
- `verdict: "REJET"` → appliquer `corrections_requises` en redispatchant
  l'agent concerné (DA pour un plan fautif, composer pour la mention IA),
  re-rendre, re-vérifier. **Max 2 cycles**, ensuite : échec du match
  (tâche RH en échec, jamais de publication d'une vidéo rejetée).

### Étape 5 — Log

```markdown
- [HH:MM] Cartoon : {match} {score} — storyboard {n} scènes, {n} plans ({retries} retries), verdict légal {OK/REJET} — ~Xmin
```

## Toute la journée en dessin animé

Pour « la version animée de chaque match » : c'est **`routine-matchs`** qui
orchestre (phases Sense/Plan/GO inchangées) ; en phase Act, chaque match est
confié à ce skill au lieu du `video-composer` seul. **Max 2 studios en
parallèle** (un studio = jusqu'à 4 agents actifs), les garde-fous de la
routine s'appliquent (10 matchs max, fenêtre H-6/H-2, jamais de service
payant sans confirmation).

## Garde-fous

- Personnages **originaux uniquement** — la caricature d'un joueur réel est
  un motif de REJET, pas une retouche.
- La modération de l'étape 4 est **obligatoire et bloquante** : aucune
  vidéo cartoon ne part vers `publication-cms` sans verdict OK.
- Rendu 100 % local (CLI HyperFrames), images via RapidoCMS uniquement —
  aucun service payant dans ce studio.
- Durée bornée 5–15 s (cahier des charges) ; 9:16 par défaut.
