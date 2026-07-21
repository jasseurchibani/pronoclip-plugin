# Schéma — `index.json` d'un effectif semé (bibliothèque de portraits)

**Statut : ACTÉ, implémenté (adapters/squad-library.ts).**
**Voir aussi :** `reference/decisions/2026-07-13-bibliotheque-portraits-canonique.md` (le *pourquoi*).

---

## 1. Rôle

`index.json` est la **source de vérité unique d'un effectif** pour un couple
`namespace + équipe`. Un seul fichier porte à la fois :

- **le profil football** de chaque joueur (consommé par `core/prediction.ts` pour
  pondérer les types de but) ;
- **le pointeur vers son portrait** de référence (consommé par le pipeline vidéo).

> **Pas de doublon.** L'effectif (pour le pronostic) et les portraits (pour l'image)
> lisent le **même** fichier. Il n'existe nulle part une seconde liste de joueurs.

## 2. Emplacement

```
pronoclip-data/                       ← donnée client, gitignorée (jamais dans le repo public)
└── squads/
    └── <namespace>/                  ← pronoclip (canonique) | <marque> (revendeur)
        └── <team_code>/              ← slug de l'équipe (ex. france, real_madrid)
            ├── portraits/            ← les PNG de référence (générés au semis)
            └── index.json            ← CE fichier
```

- `<namespace>` : `pronoclip` = mes effectifs canoniques ; `<marque>` = override revendeur.
  Le résolveur cherche `<marque>` **d'abord**, puis retombe sur `pronoclip`
  (cf. ADR §7). Le namespace est **en dur dans le chemin**.
- `<team_code>` : slug ASCII de l'équipe — minuscules, sans accents, espaces → `_`
  (« France » → `france`, « Real Madrid » → `real_madrid`). Doit égaler le champ
  `team_code` du fichier.

## 3. Schéma (`pronoclip.squad/v1`)

```jsonc
{
  "$schema": "pronoclip.squad/v1",
  "namespace": "pronoclip",     // = segment <namespace> du chemin
  "team": "France",             // nom d'affichage (messages, overlays)
  "team_code": "france",        // = slug = segment <team_code> du chemin
  "seeded_at": "2026-07-19",    // ISO 8601 quand les portraits sont gelés ; null tant que non semé
  "players": [
    {
      "name": "Kylian Mbappé",  // clé logique du joueur (unique dans l'effectif)
      "position": "FW",         // GK | DF | MF | WG | FW — pilote les défauts de type de but
      "isKeyPlayer": true,      // optionnel : joueur clé (buteur prioritaire)
      "profile": {              // MÊME profil que core PlayerProfile (hors position), stats ∈ [0,1]
        "heading":   0.35,      // aptitude aérienne (têtes)          — défaut dérivé du poste
        "longRange": 0.60,      // frappes lointaines                  — défaut dérivé du poste
        "setPieces": 0.35,      // qualité coups francs                — défaut 0
        "isPenaltyTaker": true  // tireur de penalty désigné (un seul) — défaut false
      },
      "portrait": "portraits/Kylian Mbappe.png"  // chemin EXPLICITE, relatif au dossier de l'équipe
    },
    {
      "name": "Didier Deschamps",   // non-joueur : présent pour son portrait, jamais buteur
      "role": "coach",              // player (défaut) | coach | staff — coach/staff exclus par loadRoster
      "profile": {},
      "portrait": "portraits/Didier Deschamps.png"
    }
  ]
}
```

### 3.1 Champs par joueur

| Champ | Type | Requis | Rôle |
|---|---|---|---|
| `name` | `string` | ✅ | Identité du joueur. **Unique** dans `players`. Clé de résolution. |
| `position` | `Position` | ✅ pour un joueur | `GK`\|`DF`\|`MF`\|`WG`\|`FW`. Omise pour un non-joueur (`role` coach/staff). |
| `role` | `"player"\|"coach"\|"staff"` | — | Défaut `player`. `coach`/`staff` = présent pour son portrait mais **jamais** choisi comme buteur. |
| `isKeyPlayer` | `boolean` | — | Buteur prioritaire (cf. `keyFirst` dans prediction). Défaut `false`. |
| `profile.heading` | `number` [0,1] | — | Têtes. Défaut dérivé du poste. |
| `profile.longRange` | `number` [0,1] | — | Frappes lointaines. Défaut dérivé du poste. |
| `profile.setPieces` | `number` [0,1] | — | Coups francs. Défaut `0`. |
| `profile.isPenaltyTaker` | `boolean` | — | Tireur désigné (**un seul par équipe**). Défaut `false`. |
| `portrait` | `string \| null` | ✅ | Pointeur portrait **EXPLICITE**, ou `null` si non généré. |

> **`portrait` est EXPLICITE — jamais dérivé du nom.** Le fichier peut s'appeler
> `Kylian Mbappe.png` (accent perdu, prénom ajouté) alors que `name` vaut `Kylian Mbappé` :
> seule la valeur de `portrait` fait foi. Valeur = chemin **relatif** au dossier de l'équipe
> (`portraits/…`), une **URL** `https://` (CDN canonique), un chemin **absolu**, ou `null`.

> `position` est **hors** de `profile` dans le fichier, mais le résolveur les fusionne
> en un `PlayerProfile` core `{ position, heading, longRange, setPieces, isPenaltyTaker }`
> quand il produit l'effectif pour le pronostic (`loadRoster`). Un non-joueur (`role`
> coach/staff) est **exclu** de `loadRoster` et marqué `isPlayer: false` côté core —
> `prediction.ts` ne le choisit donc jamais comme buteur.

## 4. Résolution & garde-fous (adapters/squad-library.ts)

- `resolvePortrait(playerName, team, namespace)` → **chemin absolu du portrait**, ou :
  - `NotSeededError` (« Effectif non semé — lance /pronoclip-squad ») si le joueur
    n'est **dans aucun** namespace de l'ordre de résolution ;
  - `PortraitPendingError` si le joueur **est semé mais `portrait` vaut `null`**
    (image pas encore produite).
- **Jamais de génération silencieuse** : les vidéos *lisent* la bibliothèque, elles ne
  la *sèment* jamais. Le semis est le rôle exclusif de `/pronoclip-squad`.
- `loadRoster(team, namespace)` → `Player[]` core (fusion marque → canonique) : c'est
  ce qui alimente `core/prediction.ts`. Même fichier, une seule vérité.
