# Décision ouverte — nom de joueur réel + visage fictif

**Statut : NON TRANCHÉ. Consultation juridique en cours.**
**Portée : Phase 3.** La fiche personnage du Match Bible s'écrit maintenant
(`core/match-bible.ts`, `players[]`) — ce choix ne peut donc pas être repoussé à
la Phase 5, contrairement à ce qui avait été dit initialement.

## La tension

Le produit **nomme des joueurs réels** comme buteurs pronostiqués (c'est l'intérêt
du pronostic : « But : Mbappé »). Or la Décision A2 impose des **athlètes fictifs,
non identifiables** à l'image (`reference/directives-legales.md`, Règle 1 : « aucun
visage de joueur identifiable, aucun nom associé à un visage »).

Ces deux exigences se rencontrent sur le **même plan** : une caption « But : Mbappé »
en overlay au-dessus d'un athlète dessiné. Le curseur du **degré de ressemblance**
entre l'athlète fictif et le vrai joueur crée un dilemme :

- **Trop peu de ressemblance** → un « Mbappé » blond à la peau claire au-dessus du
  nom « Mbappé » : la vidéo **paraît cassée / bâclée** pour le spectateur.
- **Trop de ressemblance** → on recrée un visage reconnaissable : **annule A2** et
  rouvre l'exposition au droit à l'image que A2 devait fermer.

Le prompt d'image, lui, ne contient **jamais** le nom (le sujet est une description
physique) — la tension est donc entièrement portée par **la caption/overlay**
associée à un visage, pas par le prompt.

## Les options (conséquences, sans recommandation)

### Option 1 — Athlète 100 % fictif, indépendant du vrai joueur *(comportement actuel)*
La fiche est tirée aléatoirement (graine) : build, cheveux, peau, crampons sans
lien avec le joueur nommé.
- **+** Sécurité juridique maximale : aucune ressemblance possible.
- **−** Dissonance nom↔visage : rendu qui « fait faux » ; risque perçu de bug.
- **−** Cohérence entre plans OK (fiche verrouillée), mais réalisme perçu faible.

### Option 2 — Athlète « inspiré » (attributs approchés, sans le visage)
On approche morphologie / carnation / coupe / poste du vrai joueur, **sans** viser
le visage.
- **+** Vidéo beaucoup plus crédible.
- **−** Zone grise : « ressemblance » et « nom associé » peuvent suffire à
  caractériser une atteinte au droit à l'image / à l'identité. Érode A2.
- **−** Nécessite des attributs réels par joueur → réintroduit de la donnée
  « joueur réel » dans l'effectif d'entrée.

### Option 3 — Aucun nom réel à l'écran
Les captions n'utilisent que le rôle / le poste / le numéro fictif :
« L'ATTAQUANT VEDETTE », « OUVERTURE DU SCORE », « N°9 ».
- **+** Sécurité maximale, cohérence visuelle préservée (fictif assumé).
- **−** Perte de l'argument de vente du pronostic (« qui marque »).

### Option 4 — Nom réel + avatar générique + mention explicite « représentation fictive »
On garde le nom, l'avatar reste générique, et un overlay précise que la
représentation est fictive (en plus de la mention IA).
- **+** Compromis : garde l'information, assume la fiction.
- **?** La mention suffit-elle juridiquement ? À valider par le juriste.

## Ce que fait l'implémentation actuelle

**Option 1** par défaut (le plus sûr) : `core/match-bible.ts` génère une fiche
fictive **indépendante** du joueur nommé, verrouillée par la graine. Le nom réel
n'apparaît que dans le `match-script` et les captions (overlays), **jamais** dans le
prompt d'image.

Le **degré de ressemblance** est destiné à devenir un réglage (`character_likeness`
dans `pronoclip.config.json` : `fictional` | `inspired` | `anonymous`) une fois la
décision prise — l'architecture le permet sans réécriture du cœur.

## À décider (juriste)

1. Quelle option (1 à 4, ou combinaison) ?
2. Si nom réel conservé : caption complète, nom de famille seul, ou rôle/numéro ?
3. Faut-il une mention « représentation fictive » distincte de la mention IA ?

Liens : `reference/directives-legales.md` (Règle 1), Décision A2 (audit Phase 0),
`core/match-bible.ts` (`players[]`), `core/prompt-builder.ts` (`subjectBlock`).
