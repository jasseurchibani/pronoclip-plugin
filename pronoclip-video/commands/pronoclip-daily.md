---
description: Transforme le log PronoClip du jour en daily RapidoRH
---

Transforme le log d'exécution PronoClip du jour en daily RapidoRH.

Invoquer le skill **`suivi-rh-daily`**, Partie B :

1. Lire `./pronoclip-logs/YYYY-MM-DD.md` du jour — s'il n'existe pas, le
   dire et ne RIEN créer.
2. Agréger vidéos OK/KO, posts planifiés, échecs, temps total estimé.
3. Vérifier via `get-dailies-tool` qu'aucun daily n'existe déjà aujourd'hui
   (un seul daily par jour — sinon proposer de compléter l'existant à la
   main).
4. Créer le daily via `create-daily-tool` (tâches touchées du jour, heures
   arrondies au 0,5 h, format de résumé du skill).
