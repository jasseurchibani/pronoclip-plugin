---
description: Génère UNE vidéo de pronostic score exact (~40 s, rendu local gratuit)
argument-hint: "<équipe domicile> <équipe extérieur> [score] [compétition] | --today"
---

Génère une vidéo de pronostic PronoClip pour un match unique (9:16, ~40 s).

Arguments reçus : $ARGUMENTS

## Mode par défaut — saisie manuelle (hors-ligne, aucun réseau)

C'est le chemin de test rapide. Il ne dépend ni de n8n ni d'Internet.

1. Parser : équipe domicile, équipe extérieur, puis optionnellement le score
   (`2-0` → L1 ; absent → **L0**, le moteur prédit le score) et la compétition.
2. Invoquer le skill **`video-pronostic`** et suivre son pipeline (predict →
   match-script → composition → rendu local → voix off + audio). Il demande les
   entrées obligatoires manquantes (compétition, date/heure) — ne rien inventer.
3. Rendu **local et gratuit** par défaut (tier `motion`, Chrome + ffmpeg). Le tier
   `animated` (Kling, payant) et la voix `elevenlabs` sont **opt-in explicites**.

Démo immédiate sans argument ni config : `npm run render` produit le MP4 France vs
Espagne.

## Mode optionnel `--today` — matchs réels du jour via n8n

Additif : n8n fournit **le match**, jamais le pronostic. Le score et les buteurs
restent produits par le moteur LOCAL (`core/prediction.ts`).

Prérequis : `N8N_FIXTURES_WEBHOOK` renseigné dans `.env` (voir `.env.example`).

1. Lister les matchs du jour — **s'arrêter là et afficher la liste** :
   ```
   npm run today
   ```
   Affiche `numéro, heure, compétition, équipes, [fixtureId]`.
2. **Attendre que l'utilisateur choisisse un numéro.** Ne JAMAIS choisir à sa place,
   ne JAMAIS inventer un match absent de la liste.
3. Rendre la vidéo du match retenu :
   ```
   npm run today -- --pick <numéro>
   npm run today -- --fixture <fixtureId>   # équivalent, stable si la liste bouge
   ```
   Options : `--leagues 39,140` (filtre de ligues), `--score 2-1` (score imposé),
   `--voice=elevenlabs` (opt-in payant).

### Si l'appel n8n échoue

L'adaptateur ne lève jamais : il rend un motif explicite (`not-configured`,
`network`, `http`, `invalid-json`, `no-fixtures`, `unreadable-fixtures`). Le script
affiche la cause, les `availableLeagues` quand il y en a, puis **renvoie vers le mode
saisie manuelle**. Relayer ce message à l'utilisateur tel quel et lui proposer le
repli — ne jamais fabriquer un match pour combler le vide.

Garde-fous (zéro logo/visage, mention IA, jamais le MCP payant `render_video`)
dans le skill `video-pronostic` — les suivre intégralement.
