// Effectifs d'exemple (démo) — le match de test est FRANCE vs ESPAGNE.
// France : chargée depuis la bibliothèque de portraits semée (source de vérité unique,
// `pronoclip-data/squads/pronoclip/france/`) — l'effectif est une ENTRÉE explicite du
// moteur, jamais une connaissance du modèle. Espagne : effectif fictif minimal (adversaire
// non semé). Couleurs = aplat uniquement (aucun écusson/sponsor — cf. directives légales).

import type { Team } from '../core/types'
import { seedFromString } from '../core/rng'
import { loadRoster } from '../adapters/squad-library'

// France = 26 joueurs de champ (les 27 portraits moins l'entraîneur Deschamps, exclu par
// `loadRoster`). Un seul « Mbappé canonique », lu depuis l'index.
export const france: Team = {
  name: 'France',
  colors: { primary: 'royal blue', secondary: 'white' },
  players: loadRoster('France', 'pronoclip'),
}

// Espagne = effectif fictif MINIMAL (adversaire non semé : pas de portraits). Noms
// d'athlètes fictifs — aucune donnée réelle requise pour le camp adverse du match de test.
export const espagne: Team = {
  name: 'Espagne',
  colors: { primary: 'red', secondary: 'gold' },
  players: [
    { name: 'Iker Montoya', isKeyPlayer: true, profile: { position: 'FW', heading: 0.6, longRange: 0.45, isPenaltyTaker: true } },
    { name: 'Álvaro Sáez', isKeyPlayer: true, profile: { position: 'WG', heading: 0.15, longRange: 0.6 } },
    { name: 'Nico Ferrán', profile: { position: 'MF', heading: 0.35, longRange: 0.7, setPieces: 0.7 } },
    { name: 'Pau Ribalta', profile: { position: 'MF', heading: 0.3, longRange: 0.5 } },
    { name: 'Marc Solà', profile: { position: 'DF', heading: 0.8, longRange: 0.1 } },
    { name: 'Gonzalo Vidal', profile: { position: 'FW', heading: 0.5, longRange: 0.35 } },
  ],
}

// Graine explicite → exemple reproductible. En usage réel, l'absence de graine = aléatoire.
export const EXAMPLE_SEED = seedFromString('France|Espagne')
