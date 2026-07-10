# Directives légales PronoClip — vidéos de pronostics

Ces trois règles sont **bloquantes** : une vidéo qui viole l'une d'elles ne
doit être ni rendue, ni publiée. En cas de doute, s'arrêter et demander.

## Règle 1 — Aucun élément de propriété intellectuelle protégée

**Interdits absolus** dans toute composition :

- **logos de clubs** (écussons, blasons, monogrammes) ;
- **emblèmes de compétitions** (trophées stylisés, logos de ligues et de
  coupes, typographies officielles de compétitions) ;
- **visages de joueurs identifiables** (photos, portraits réalistes,
  caricatures reconnaissables, noms associés à un visage).

**Autorisés à la place** :

- silhouettes et avatars génériques (aucun trait de visage identifiable) ;
- maillots **aux couleurs des équipes uniquement** — aplat de couleur, sans
  écusson, sans sponsor, sans flocage nominatif ;
- noms d'équipes et de compétitions **en texte brut** (usage informatif).

Pourquoi : logos et emblèmes sont des marques déposées ; l'image des joueurs
relève du droit à l'image. PronoClip n'a aucune licence — c'est le point de
vigilance légale n°1 du projet.

## Règle 2 — Transparence IA obligatoire

Chaque vidéo doit afficher, de façon **visible et lisible** pendant la
diffusion, la mention :

> **« Pronostic — contenu généré par IA »**

- Présente à l'écran (pas seulement dans la description du post).
- Contraste et taille suffisants pour être lue sur mobile.
- Ne jamais la tronquer, la masquer par une animation, ou la faire
  disparaître avant la fin de la scène qui la porte.

Pourquoi : obligation de transparence du cahier des charges PronoClip, et
conformité avec les exigences de labellisation des contenus synthétiques des
plateformes (TikTok, Meta) et de l'AI Act.

## Règle 3 — Services de rendu payants : consentement explicite

Le rendu par défaut est **local et gratuit** (CLI HyperFrames). Le fallback
MCP « HyperFrames by HeyGen » (`compose` → `render_video`) est soumis à :

1. **Demande explicite** de l'utilisateur (jamais à l'initiative d'une
   routine automatisée) ;
2. **Annonce claire** avant l'appel : `render_video` est **PAYANT**, réservé
   aux vidéos premium ;
3. **Attente d'un OUI explicite** de l'utilisateur avant d'appeler
   `render_video` — un silence ou une réponse ambiguë vaut refus ;
4. Lors du suivi du rendu (`get_render_status`), **respecter
   `retry_after_seconds`** entre deux polls.

Pourquoi : engagement d'argent réel — même logique de verrouillage que le
plugin `rapido-meta-ads` du marketplace BraindCode.
