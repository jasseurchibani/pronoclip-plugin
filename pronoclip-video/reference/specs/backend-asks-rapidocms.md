# Demandes backend — serveur RapidoCMS (consolidé)

**Destinataire : équipe backend RapidoCMS.** Trois demandes, par ordre de priorité, qui
débloquent le plugin `pronoclip-video`. Document autonome ; chaque point renvoie au détail.

---

## 1. `edit_image` — édition d'image à références (cohérence de visage INTER-plans)

**Problème.** `generate_image(prompt, size)` ne prend aucune image de référence → chaque
plan réinvente le visage. **Ask :** un outil `edit_image(prompt, reference_image_urls[],
size, quality?)` renvoyant une **URL publique** (miroir de `openai.images.edit`, multi-réf,
taille portrait `1024x1536`). **Détail complet : `reference/specs/edit_image-mcp-rapidocms.md`.**

> ⚠️ Attente réaliste (vérifiée sur clip payé, 2026-07-21) : `edit_image` verrouille la
> cohérence **ENTRE les plans** (même visage d'un plan à l'autre) — **pas DANS un plan
> animé** (le modèle i2v dérive au fil des frames). Ce n'est donc pas un remède au drift
> intra-clip ; cf. `reference/decisions/2026-07-21-recette-clip-anime-kling.md` §3.

## 2. Upload d'OCTETS (supprime le trou d'upload)

**Problème.** `upload_file_tool(type, name, file_url)` **n'ingère que depuis une URL
publique**, et `create_draft_tool.media_url` idem. **Aucun outil n'accepte des octets /
multipart / base64.** Un MP4 rendu **en local** ne peut donc pas être remis directement :
il faut d'abord l'exposer publiquement (S3/CDN propriétaire, ou tunnel éphémère
`cloudflared` — validé en Phase 3, RapidoCMS re-héberge dans son S3 après le fetch).

**Ask :** un outil `upload_bytes(type, name, data|multipart)` **ou** un
`get_upload_url()` (presigned PUT) qui renvoie l'URL biblio finale. Bénéfice : **supprime
le trou pour tous les revendeurs** — un revendeur n'a alors besoin que de son compte
RapidoCMS, **aucun stockage public** à lui. C'est le chemin le plus revendeur-friendly.

## 3. `schedule_draft_tool` — deux écarts constatés en réel (2026-07-21)

- **Format d'heure.** Le schéma MCP annonce `post_heure` au format **`H-i-s`** (tirets) ;
  le serveur **REJETTE** les tirets et exige **`H:i:s`** (deux-points, ex. `18:00:00`).
  → **Ask :** corriger la description du schéma (ou accepter les deux formats).
- **Décalage d'heure.** `18:00:00` envoyé → **`18:10`** stocké/retourné (`draft 525` →
  `post 427`, société 321). Léger décalage côté serveur, non documenté. → **Ask :**
  confirmer si c'est un lead-time minimal imposé, un arrondi, ou un bug de parsing.

---

## Notes de contexte (garanties côté plugin)
- Les prompts n'incluent **jamais** de texte/chiffre/nom/logo à peindre dans l'image.
- Les images de référence sont des **visages fictifs** (jamais un joueur réel identifiable).
- Le plugin **n'appelle jamais le MCP depuis du code** : le transport est injecté ; en
  Claude Code, c'est l'agent qui appelle les outils (cf. `adapters/rapidocms.ts`).
- **TikTok** (réseau natif du 9:16) est **à reconnecter** avant toute publication réelle ;
  d'ici là, publication de test sur Instagram (compte BraindCode).
