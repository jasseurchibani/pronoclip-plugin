# Spec backend — outil MCP `edit_image` (serveur RapidoCMS)

**Destinataire : équipe backend RapidoCMS.**
**Statut : à implémenter. Chemin critique — le plugin `pronoclip-video` (Phase 4) est bloqué sans cet outil.**
Document autonome : tout le contexte nécessaire est ici.

---

## 1. Pourquoi cet outil

Le plugin `pronoclip-video` génère des vidéos de pronostic : 8 plans fixes qui
racontent un match. **Un même joueur (athlète fictif) apparaît dans plusieurs
plans** et doit y garder **le même visage, la même carnation, le même maillot**.

L'outil MCP actuel `generate_image(prompt, size)` ne prend **aucune image de
référence** : chaque appel réinvente le visage → incohérence d'un plan à l'autre.
La solution retenue (Décision B1) est un nouvel outil `edit_image` qui accepte des
**images de référence**, exactement comme `openai.images.edit`.

Mécanisme cible :
1. Le visage d'un personnage est généré **une seule fois** (via `generate_image`).
2. Cette image devient la **référence** réutilisée dans tous les plans suivants où
   ce personnage apparaît, via `edit_image`.
3. Le plan `face_off` (duel) passe **deux** références (héros domicile + extérieur).

> Précédent qui marche : le site de référence fait déjà ceci dans
> `actions/scene-images.ts` avec `openai.images.edit({ image: files, prompt, ... })`,
> et passe un **tableau** d'images pour le `face_off`. `edit_image` doit en être
> l'équivalent MCP, générique et multi-références.

---

## 2. Limite bloquante de `generate_image` aujourd'hui

Le schéma MCP actuel est :

```
generate_image(prompt: string, size: string /* "hd" | "standard" */)
```

Deux manques pour notre usage :
- **Aucune image de référence** (le motif de cette spec).
- **Aucun contrôle du ratio** : `size` ne gère que `hd`/`standard` (qualité), pas
  les dimensions. Or les vidéos sont **verticales 9:16**. Il faut exposer une
  taille en pixels, dont un format portrait (**`1024x1536`**, le format utilisé par
  le site).

→ `edit_image` **doit** exposer `size` en dimensions explicites (voir §3). Idéalement,
`generate_image` est étendu de la même façon (mais ce n'est pas bloquant : le premier
visage peut être généré en portrait via `edit_image` lui-même sans référence, ou via
un `generate_image` étendu).

---

## 3. Signature de `edit_image`

```
edit_image(
  prompt: string,                 // requis
  reference_image_urls: string[], // requis, 1..4 ; face_off = 2
  size: string,                   // requis, dimensions en pixels — voir ci-dessous
  quality?: string                // optionnel : "low" | "medium" | "high" (défaut "medium")
) -> EditImageResult
```

### Paramètres

| Champ | Type | Requis | Notes |
|---|---|---|---|
| `prompt` | string | oui | Description de l'image. Ne contient jamais de texte/chiffre/nom/logo à peindre (garanti côté plugin). |
| `reference_image_urls` | string[] | oui | 1 à 4 **URLs HTTPS publiques** d'images PNG/JPG accessibles par le serveur. Ordre significatif (1re = sujet principal). `face_off` en fournit 2. |
| `size` | string | oui | Dimensions en pixels. **Doit accepter au minimum `"1024x1536"` (portrait 9:16-ish)**. Autres valeurs alignées sur le modèle sous-jacent (`1024x1024`, `1536x1024`). |
| `quality` | string | non | `"low"` \| `"medium"` \| `"high"`. Défaut `"medium"` (comme le site). |

---

## 4. Payload (ce que le client MCP envoie)

```json
{
  "name": "edit_image",
  "arguments": {
    "prompt": "A premium 2D anime sports illustration ... (bloc complet du plugin)",
    "reference_image_urls": [
      "https://media.rapidocms.example/pronoclip/hero_home_abc.png"
    ],
    "size": "1024x1536",
    "quality": "medium"
  }
}
```

Exemple `face_off` (deux références) :

```json
{
  "name": "edit_image",
  "arguments": {
    "prompt": "Two rival athletes face to face ...",
    "reference_image_urls": [
      "https://media.rapidocms.example/pronoclip/hero_home_abc.png",
      "https://media.rapidocms.example/pronoclip/hero_away_def.png"
    ],
    "size": "1024x1536",
    "quality": "medium"
  }
}
```

---

## 5. Implémentation de référence (serveur)

Miroir générique de `actions/scene-images.ts` du site :

1. Pour chaque URL de `reference_image_urls` : `fetch` → buffer → `toFile(buf, name, { type })`.
2. Appeler l'API images en mode édition avec **le tableau** de fichiers :
   ```
   openai.images.edit({
     model: 'gpt-image-1.5',
     image: files,            // tableau (1..N)
     prompt,
     size,                    // "1024x1536"
     quality,                 // "medium"
   })
   ```
3. Récupérer `b64_json` → décoder → **uploader dans la bibliothèque média** RapidoCMS.
4. Renvoyer une **URL publique** (pas le base64) : le reste du pipeline
   (`upload_file_tool`, publication) exige des URLs publiques.

---

## 6. Format de réponse (succès)

```json
{
  "image_url": "https://media.rapidocms.example/pronoclip/scene_1_xyz.png",
  "width": 1024,
  "height": 1536,
  "model": "gpt-image-1.5",
  "revised_prompt": "..."      // optionnel
}
```

`image_url` **obligatoire** et **publique**. Le reste est indicatif. Garder la même
enveloppe que `generate_image` si elle existe déjà (cohérence des deux outils).

---

## 7. Gestion d'erreur

Codes stables, message lisible, et pour le rate limit un `retry_after_seconds`.

| Cas | Code suggéré | Champ |
|---|---|---|
| URL de référence inaccessible / 404 | `reference_unreachable` | `url` fautive |
| Format de référence non supporté | `reference_unsupported_format` | `url` |
| Trop de références (> max) | `too_many_references` | `max` |
| Prompt rejeté par la modération | `prompt_rejected` | `reason` |
| Rate limit | `rate_limited` | **`retry_after_seconds`** |
| Erreur upstream (modèle) | `upstream_error` | `detail` |

Exemple :
```json
{ "error": { "code": "rate_limited", "message": "Too many requests", "retry_after_seconds": 20 } }
```

---

## 8. Limites à fixer

- **`reference_image_urls`** : max **4** (recommandé). Rejeter au-delà (`too_many_references`).
- Taille max par image de référence (ex. 10 Mo) et types acceptés (PNG, JPG, WEBP).
- Timeout upstream raisonnable (ex. 60 s) ; renvoyer `upstream_error` au-delà.

---

## 9. Ce que fait le plugin si `edit_image` est ABSENT (repli, pas de crash)

Le plugin **ne doit jamais planter** faute de cet outil. Comportement de repli
(mode **B3**, cohérence de visage dégradée) :

1. À l'usage, si l'appel `edit_image` échoue avec « outil inconnu » (ou si l'outil
   n'est pas listé par le serveur), le plugin bascule automatiquement sur
   `generate_image` **sans référence**.
2. La cohérence de visage repose alors **uniquement** sur la fiche personnage
   textuelle verrouillée du Match Bible (`core/match-bible.ts`, `players[]` :
   build, cheveux, peau, crampons) — reproductible mais visage moins stable.
3. Le plugin **journalise clairement** : `edit_image indisponible — cohérence de
   visage réduite (repli B3, fiche personnage texte seule)`.
4. Aucune image payante n'est lancée sans affichage préalable du coût et accord
   explicite de l'utilisateur (règle produit).

Autrement dit : `edit_image` **améliore nettement** le résultat mais n'est pas une
dépendance dure au sens « ça ne tourne pas sans ». Il l'est en revanche pour la
**qualité vendable** (cohérence de personnage entre plans).

---

## 10. Conformité (rappel, garanti côté plugin — pour info)

- Les prompts n'incluent **jamais** de texte/chiffre/nom/logo à peindre dans l'image.
- Les images de référence sont des **visages fictifs générés** (athlètes non
  identifiables), **jamais** des photos de joueurs réels.
- Maillots en aplat de couleur, sans écusson ni sponsor ni flocage.

---

## 11. Récapitulatif de la commande (pour chiffrage)

- 1 nouvel outil MCP `edit_image` (multi-références, taille portrait, upload média, URL publique).
- Extension recommandée de `generate_image` pour accepter une **taille en pixels**
  (dont `1024x1536`), sinon impossible de produire du **vertical 9:16**.
- Contrat d'erreur avec `retry_after_seconds` sur le rate limit.
