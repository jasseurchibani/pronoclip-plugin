# USAGE — pronoclip-video (de zéro à un MP4)

Guide pratique pour **quelqu'un qui n'a jamais vu le repo**. Chaque commande est
copiable-collable, dans l'ordre. Toutes les commandes ci-dessous ont été **réellement
exécutées** pour écrire ce document.

Le plugin génère des vidéos verticales 9:16 de ~40 s de **pronostic football (score
exact)** : prédiction déterministe → 8 plans (face-à-face → buts → résultat final) →
rendu **local et gratuit** (Chrome + ffmpeg) → voix off + lit musical + whoosh.

---

## 1. Prérequis

| Prérequis | Pour quoi | Obligatoire |
|---|---|---|
| **Node ≥ 20** | exécuter les scripts (`tsx`) | oui |
| **Google Chrome** (ou Chromium) | capture des frames (rendu local) | oui pour le rendu |
| **ffmpeg** | fourni par `ffmpeg-static` (installé par npm) | auto |
| Clés API (`.env`) | seulement pour le **payant** (voix ElevenLabs, clip Kling) ou la **publication** RapidoCMS | non |

La **démo ne demande aucune clé, aucun compte, aucune config client.**

## 2. Installation

```bash
git clone <repo> && cd pronoclip-video
npm install
```

`npm install` résout tout (`tsx`, `puppeteer-core`, `ffmpeg-static`, `vitest`, …). Pour
l'utiliser comme plugin Claude Code, ajouter le dossier à `.claude-plugin/marketplace.json`
(cf. README) — les commandes `/pronoclip-*` deviennent disponibles.

## 3. La démo (zéro config, ~40 s, gratuit) — COMMENCER ICI

```bash
npm run demo                 # score PRÉDIT par le moteur
npm run demo -- --score 2-1  # score IMPOSÉ 2-1 (respecté à l'identique)
```

Match **fictif** (Rovers vs Comets, effectifs inventés — aucun joueur réel). Sortie réelle :

```
===== DÉMO PronoClip — match FICTIF, zéro config =====
Rovers 2-1 Comets  (score imposé)
  but : Kian Alder (goal_normal)
  but : Milo Sereno (goal_penalty)
  but : Nilo Bast (goal_normal)
===== MP4 DÉMO =====
.../pronoclip-output/demo_rovers-vs-comets_2-1.mp4
```

Le MP4 (h264 + aac, 40 s) contient : face-à-face → buts (score incrémental) → résultat
final + carton, **filigrane « Vidéo générée par IA » en permanence**, voix off locale
gratuite (dégrade en musique + whoosh si aucune TTS locale). En commande plugin :
`/pronoclip-demo` ou `/pronoclip-demo 2-1`.

## 4. Générer / rendre une vraie vidéo

| Commande | Ce qu'elle fait | Coût |
|---|---|---|
| `npm run render` | Rend l'exemple **France vs Espagne** (motion, 8 plans, voix SAPI locale) → `pronoclip-output/pronoclip_france-vs-espagne.mp4` | **gratuit** |
| `npm run render -- --voice=elevenlabs` | Idem, voix **ElevenLabs** premium (nécessite `ELEVENLABS_API_KEY` dans `.env`) | payant (voix) |
| `npm run example` | Écrit le `match-script.json` (prédiction relisible) sans rendu | gratuit |
| `npm run prompts` | Assemble les 8 prompts d'image (relecture) sans génération | gratuit |
| `/pronoclip-match <dom> <ext> [score]` | Une vidéo pour un match donné (skill `video-pronostic`) | gratuit (motion) |

## 5. Publier (RapidoCMS) — nécessite un compte

```bash
npm run publish-video   # construit le plan (légende + mention IA + planning), dry-run
```

`upload_file_tool` exige une **URL publique** : exposer le MP4 (S3/CDN, ou tunnel éphémère
`node scripts/tunnel.mjs pronoclip-output 8787 node_modules/cloudflared/bin/cloudflared.exe`),
puis l'agent appelle `upload_file_tool` → `create_draft_tool` → `schedule_draft_tool`.
`RAPIDOCMS_COMPANY_ID` dans `.env`. Détail : skill `publication-cms`. **TikTok à reconnecter**
(réseau natif du 9:16) ; en attendant, publication de test sur Instagram.

## 6. Payant (opt-in explicite — jamais en routine, coût affiché avant)

| Commande | Service | Coût |
|---|---|---|
| `npm run animate -- --animated` | clip animé **Kling 3.0** (fal.ai) — **gelé** par défaut (cf. ADR recette) | ~0,56 $/clip |
| `npm run test-clip` | pipeline B2 (OpenAI edit) → Kling → 5 frames | ~0,8 $ |
| `/pronoclip-presentateur` | présentateur **HeyGen** qui parle | ~1 crédit/s |
| `/pronoclip-squad <équipe>` | sème les portraits d'une équipe (gaté sur `edit_image`) | payant |

## 7. Surfaces de configuration

| Fichier | Versionné ? | Contenu |
|---|---|---|
| `pronoclip.config.json` | oui | config **produit** : marque, couleurs, durée, mention IA, niveau de rendu, voix. **Aucun secret, aucun ID client.** |
| `.env` (cf. `.env.example`) | **non** | secrets : `RAPIDOCMS_COMPANY_ID`, clés API. |
| `pronoclip-data/config.json` | **non** | données **client** de runtime (comptes sociaux, IDs RapidoRH). |

## 8. Definition of Done §12 — résultats réels

| # | Critère | Résultat |
|---|---|---|
| 1 | Installer proprement, lancer une commande, obtenir un MP4 ~40 s | ✅ `npm install` + `npm run demo` → MP4 **40,0 s** |
| 2 | face-à-face → buts → résultat final | ✅ plans : `team_reveal → rival_reveal → face_off → but → but → goalkeeper_save → celebration → final_result` |
| 3 | sans score → prédit ; avec 2-1 → respecte | ✅ `demo` → **1-0 prédit** ; `demo --score 2-1` → **2-1 respecté** |
| 4 | mention IA visible | ✅ filigrane + carton (overlays) + métadonnées MP4 = « Vidéo générée par intelligence artificielle… » |
| 5 | grep IDs client → vide | ✅ `git grep` des affectations d'ID client → **vide** |
| 6 | la démo marche sans config | ✅ `demo.ts` ne lit **aucun** secret/env ; seule lecture = `pronoclip.config.json` (produit) |

## 9. Garde-fous (non négociables)

- **Mention IA** garantie par le hook `assertDisclosure` (rendu refusé si vide) + toujours à l'écran.
- **Zéro logo/écusson/sponsor, zéro visage de joueur réel** (`reference/directives-legales.md`).
  Contrôle visuel adversarial : agent `verificateur-legal`.
- **Rendu local gratuit** par défaut ; **jamais le MCP payant** `render_video`. Payant = opt-in explicite.
- **Le MCP n'est jamais appelé depuis le code** : transport injecté ; en Claude Code, l'agent est le transport.
- **Aucune donnée client dans le repo** (public) : `pronoclip-data/`, `pronoclip-output/`, `pronoclip-logs/`, `.env` sont gitignorés.

## 10. Contraintes connues

- **Tier `animated` (Kling) gelé** : qualité vidéo figée, à rouvrir quand un meilleur modèle sort (`reference/decisions/2026-07-21-recette-clip-anime-kling.md`).
- **RapidoRH / dailies** : `create-daily-tool` est réservé aux comptes **membre** — l'owner ne peut pas journaliser ses runs aujourd'hui, et le Kanban « Production vidéo » n'existe pas encore (`reference/specs/backend-asks-rapidocms.md` §4).
- **Mode image B3** (stopgap) → **B1** (`edit_image` + portraits) et **upload d'octets** RapidoCMS : demandes backend en attente (même doc §1-2).
