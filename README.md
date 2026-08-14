# PronoClip

Plugin Claude Code qui produit des **vidéos de pronostic football** de 40 secondes, au
format vertical 9:16 : score exact prédit, buteurs, portraits des joueurs, voix off,
musique — puis publication sur les réseaux via RapidoCMS.

Le rendu par défaut est **local et gratuit** (Chrome headless + ffmpeg). Tout ce qui
coûte de l'argent est en opt-in explicite, jamais par défaut.

Le plugin vit dans [`pronoclip-video/`](pronoclip-video/). Documentation détaillée :
[`pronoclip-video/README.md`](pronoclip-video/README.md) et
[`pronoclip-video/USAGE.md`](pronoclip-video/USAGE.md).

---

## Démarrage rapide

```bash
cd pronoclip-video
npm install
npm run demo        # match fictif, aucune configuration requise
```

Le MP4 sort dans `pronoclip-video/pronoclip-output/`.

---

## Commandes Claude Code

À taper dans le chat une fois le plugin chargé.

| Commande | Ce qu'elle fait | Coût |
|---|---|---|
| `/pronoclip-match <dom> <ext>` | Vidéo 40 s d'un match | **gratuit** |
| `/pronoclip-demo` | Match fictif, zéro configuration | **gratuit** |
| `/pronoclip-animated <dom> <ext>` | Vidéo 40 s en vrais clips IA | **~4,50 $** |
| `/pronoclip-squad <équipe>` | Sème les portraits d'une équipe | variable |
| `/pronoclip-daily` | Journée de matchs | gratuit |
| `/pronoclip-routine` | Routine de production | gratuit |
| `/pronoclip-presentateur` | Présentateur animé (HeyGen) | payant |

`/pronoclip-animated` affiche **toujours le devis d'abord** et attend un accord
explicite avant de dépenser. Une commande qui engagerait 4,50 $ sur simple frappe serait
un piège — une faute dans un nom d'équipe suffirait.

---

## Commandes terminal

```bash
cd pronoclip-video
```

### Produire une vidéo

| Commande | Effet |
|---|---|
| `npm run match -- Spain Portugal` | Vidéo 40 s, gratuite, hors-ligne |
| `npm run match -- Mexico Brazil --score 2-1` | Score imposé au lieu du score prédit |
| `npm run match -- France Espagne --voice=elevenlabs` | Voix premium (payante, opt-in) |
| `npm run demo` | Match fictif, aucune configuration |
| `npm run render` | Match d'exemple France vs Espagne |

Options : `--competition "Coupe du Monde 2026"`, `--namespace <marque>`.

### Vidéo animée (payant)

```bash
npm run animate-video -- Algeria Morocco --estimate   # devis, ne dépense rien
npm run animate-video -- Algeria Morocco --yes        # génère réellement
```

Sans `--yes`, le script estime et s'arrête. `--provider=<nom>` choisit un fournisseur
déclaré dans la configuration.

### Matchs du jour

```bash
npm run today                      # liste les matchs du jour, puis s'arrête
npm run today -- --pick 3          # rend la vidéo du match n° 3
npm run today -- --fixture 12345   # idem, par identifiant
```

La liste vient d'un webhook n8n (`N8N_FIXTURES_WEBHOOK`). En cas d'échec — webhook
injoignable, aucun match — le script explique la cause et renvoie vers la saisie
manuelle. Jamais de blocage, jamais de match inventé.

### Effectifs et portraits

| Commande | Effet |
|---|---|
| `npm run seed-squads -- "<dossier>"` | Sème les effectifs depuis un dossier `<Équipe>/<Joueur>.png` |
| `npm run seed-missing -- Algeria --dry-run` | Liste les joueurs sans portrait (gratuit) |
| `npm run seed-missing -- Algeria --max=1` | Génère les portraits manquants (**payant**) |
| `npm run portrait -- "<Joueur>" <Équipe>` | Génère un portrait isolé (**payant**) |

Un semis est **idempotent** : un effectif curé à la main n'est jamais réécrit, même
avec `--force`.

### Publication

```bash
npm run publish-video -- Algeria Morocco --at="2026-08-20 18:00"
```

Compose le plan de publication et imprime les arguments exacts des trois outils MCP
RapidoCMS à exécuter. **Le code n'appelle jamais MCP** : c'est l'agent Claude qui
exécute `upload_file_tool` → `create_draft_tool` → `schedule_draft_tool`.

### Qualité

```bash
npm test          # 205 tests
npm run typecheck
```

---

## Configuration

Copier `pronoclip-video/.env.example` en `.env` et renseigner ce dont vous avez besoin.
**Rien n'est obligatoire pour le rendu gratuit.**

| Variable | Sert à |
|---|---|
| `RAPIDOCMS_ACCOUNT_ID` | Compte cible de publication |
| `N8N_FIXTURES_WEBHOOK` | Matchs du jour |
| `OPENAI_API_KEY` | Génération de portraits manquants |
| `FAL_KEY` | Tier animé (fournisseur par défaut) |
| `ELEVENLABS_API_KEY` | Voix premium |

Aucune clé ni aucun identifiant client ne vit dans le code ou dans
`pronoclip.config.json` — uniquement dans `.env`, qui n'est jamais versionné.

Les réglages non secrets (durée, nombre de plans, charte, répartition des types de but,
fournisseurs vidéo) sont dans `pronoclip-video/pronoclip.config.json`.

### Ajouter un fournisseur vidéo

N'importe quelle API REST image→vidéo se décrit en configuration, sans toucher au code :

```json
"providers": {
  "mon-fournisseur": {
    "provider": "http",
    "api_key_env": "MA_CLE",
    "submit_url": "https://api.exemple.com/v1/video",
    "headers": { "Authorization": "Bearer ${API_KEY}" },
    "body": { "prompt": "${PROMPT}", "image": "${IMAGE_DATA_URI}", "duration": "${DURATION}" },
    "video_path": "data.video.url"
  }
}
```

Jetons disponibles : `${PROMPT}`, `${NEGATIVE_PROMPT}`, `${DURATION}`,
`${IMAGE_DATA_URI}`, `${IMAGE_B64}`, `${IMAGE_URL}`, `${MODEL}`, `${API_KEY}`.
Ajouter un bloc `poll` si l'API renvoie un identifiant de tâche au lieu de la vidéo.

La configuration ne contient que le **nom** de la variable d'environnement, jamais la
clé elle-même.

---

## Règles du projet

- **Mention IA obligatoire** — filigrane, carton de fin et métadonnées. Un hook bloquant
  refuse tout rendu sans elle.
- **Les effectifs sont une entrée, jamais une invention.** Un joueur non semé provoque
  une erreur explicite ; le moteur ne fabrique jamais de buteur.
- **Aucun MCP appelé depuis le code applicatif.** Le transport est injecté et exécuté
  par l'agent.
- **Rien de payant par défaut**, ni en routine automatique.
- **Aucun texte ni chiffre dans les images générées** — le score est un calque HTML.

---

## État actuel

Fonctionne : rendu 40 s, 48 équipes semées, portraits détourés incrustés, génération des
portraits manquants, plan de publication, tier animé.

Limites connues :

- **Les matchs du jour sont indisponibles** tant que le compte API-Football amont est
  suspendu — le webhook répond, mais sans données.
- **Les portraits ne sont pas dans le dépôt** (`pronoclip-data/` est ignoré par git) et
  les effectifs semés pointent vers un dossier local. Un clone sur une autre machine
  produira des vidéos sans image de joueur tant que les portraits ne sont pas hébergés
  en HTTPS.
- **Aucun appel réel à un fournisseur image→vidéo** n'a encore été effectué : la chaîne
  est validée contre un fournisseur simulé.
- **Le tier animé déforme les visages** en cours de clip sur le modèle par défaut — la
  cohérence de personnage n'est pas garantie en animé.
