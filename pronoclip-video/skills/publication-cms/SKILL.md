---
name: publication-cms
description: >-
  Utiliser pour publier une vidéo PronoClip sur les réseaux sociaux via
  RapidoCMS : upload, brouillon, planification, rattachement à une campagne.
---

# Publication CMS — vidéos PronoClip via RapidoCMS

Publie une vidéo de pronostic sur les réseaux sociaux avec le MCP
**RapidoCMS** : upload du média, brouillon au ton PronoClip, planification
avant le coup d'envoi, rattachement à la campagne de la compétition.

## CONFIG (paramétrable — adapter ici pour chaque client)

> Cette section centralise tout ce qui change d'un client à l'autre, pour
> que le plugin reste revendable sans toucher au workflow.

| Paramètre | Valeur par défaut | Note |
|---|---|---|
| `company_id` CMS | `321` | identifiant société RapidoCMS |
| Comptes cibles | *(découverte auto)* | à lister via `list_connected_accounts` au **premier usage**, puis mémoriser dans `./pronoclip-data/config.json` |
| Fenêtre de publication | H-6 → H-2 avant le coup d'envoi | règle métier PronoClip |
| Hashtags de base | `#PronoClip` | + hashtags des équipes du match |

Format de `./pronoclip-data/config.json` (créé au premier usage) :

```json
{
  "company_id": 321,
  "comptes": [
    { "id": "…", "plateforme": "tiktok", "nom": "…" },
    { "id": "…", "plateforme": "instagram", "nom": "…" }
  ]
}
```

Si `config.json` existe, l'utiliser directement ; sinon appeler
`list_connected_accounts`, présenter les comptes trouvés à l'utilisateur,
et enregistrer son choix dans le fichier.

## Étape 1 — UPLOAD

⚠️ `upload_file_tool` exige une **URL PUBLIQUE** — impossible de lui passer
un binaire local. Deux chemins selon l'origine du MP4 :

**a) MP4 rendu localement** (cas normal, CLI HyperFrames) :

1. Exposer d'abord le fichier via une URL publique — bucket S3/objet du
   projet, ou le stockage média BraindCode ;
2. puis :

   ```
   upload_file_tool(type: "video", file_url: <url publique>)
   ```

**b) MP4 issu du MCP HyperFrames** (rendu cloud, cas premium) :

- utiliser **directement** la `video_url` signée retournée par
  `get_render_status` — elle passe telle quelle dans `upload_file_tool`,
  aucun ré-hébergement nécessaire.

## Étape 2 — BROUILLON

`create_draft_tool` avec :

- `post_type` : `"media"` ;
- `media_type` : `"video"` ;
- `media_source` : **TOUJOURS `"biblio"`** (le média vient de l'upload de
  l'étape 1, jamais d'une autre source) ;
- `caption` au ton PronoClip (voir `reference/charte-pronoclip.md`) :
  1. une **accroche** ;
  2. le **score pronostiqué** ;
  3. les hashtags **#PronoClip** + **#NomDesEquipes** ;
  4. la **mention contenu généré par IA** (obligatoire, comme dans la vidéo).

Exemple de caption :

```
🔥 Notre prono pour PSG – Real Madrid : 2-1 ! Et toi, tu vois quoi ? ⚽
#PronoClip #PSG #RealMadrid
Pronostic — contenu généré par IA
```

## Étape 3 — PLANIFICATION

`schedule_draft_tool` avec :

- `post_heure` **STRICTEMENT au format `HH:MM:SS`** (les deux-points sont
  obligatoires — `18:30:00`, jamais `18h30` ni `1830`) ;
- **Règle métier** : publier entre **H-6 et H-2** avant le coup d'envoi.
  - kickoff 21:00 → créneau valide entre 15:00:00 et 19:00:00 ;
  - si la fenêtre est déjà dépassée (moins de 2 h avant le match), **ne pas
    planifier** — signaler le problème et logger le KO (cohérent avec le
    garde-fou du skill `routine-matchs`).

## Étape 4 — CAMPAGNE

1. Chercher via `list_campagnes` une campagne nommée :

   ```
   PronoClip — {compétition} {mois}
   # ex. "PronoClip — Ligue des Champions juillet"
   ```

2. **Si elle existe** : rattacher le post avec `add_post_campagne`.
3. **Sinon** : proposer à l'utilisateur de la créer (`create_campagne`) —
   ne pas la créer sans son accord.

## Étape 5 — LOG

Append dans `./pronoclip-logs/YYYY-MM-DD.md` :

```markdown
- [HH:MM] Post planifié : {match} → {réseau} {date} {heure} — OK
```

En cas d'échec (upload KO, fenêtre de publication dépassée…), logger la même
ligne avec `— KO : {cause}`.
