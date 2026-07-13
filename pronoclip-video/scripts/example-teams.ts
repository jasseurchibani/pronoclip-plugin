// Effectifs d'exemple (démo) — données locales, PAS des données client, et fournies
// EXPLICITEMENT au moteur (l'effectif est une entrée, jamais une connaissance du modèle).
// Couleurs = aplat uniquement (aucun écusson/sponsor — cf. directives légales).

import type { Team } from '../core/types'
import { seedFromString } from '../core/rng'

export const realMadrid: Team = {
  name: 'Real Madrid',
  colors: { primary: 'white', secondary: 'gold' },
  players: [
    { name: 'Mbappé', isKeyPlayer: true, profile: { position: 'FW', heading: 0.15, longRange: 0.65, isPenaltyTaker: true } },
    { name: 'Vinícius Jr', isKeyPlayer: true, profile: { position: 'WG', heading: 0.1, longRange: 0.5 } },
    { name: 'Bellingham', profile: { position: 'MF', heading: 0.6, longRange: 0.6 } },
    { name: 'Rodrygo', profile: { position: 'WG', heading: 0.2, longRange: 0.55 } },
    { name: 'Valverde', profile: { position: 'MF', heading: 0.4, longRange: 0.85 } },
    { name: 'Güler', profile: { position: 'MF', setPieces: 0.85, longRange: 0.6 } },
  ],
}

export const barcelone: Team = {
  name: 'FC Barcelone',
  colors: { primary: 'deep blue', secondary: 'garnet' },
  players: [
    { name: 'Lewandowski', isKeyPlayer: true, profile: { position: 'FW', heading: 0.8, longRange: 0.4, isPenaltyTaker: true } },
    { name: 'Lamine Yamal', isKeyPlayer: true, profile: { position: 'WG', heading: 0.1, longRange: 0.55 } },
    { name: 'Raphinha', profile: { position: 'WG', heading: 0.25, longRange: 0.6, setPieces: 0.7 } },
    { name: 'Pedri', profile: { position: 'MF', heading: 0.3, longRange: 0.5 } },
    { name: 'Ferran Torres', profile: { position: 'FW', heading: 0.4 } },
    { name: 'Dani Olmo', profile: { position: 'MF', longRange: 0.65 } },
  ],
}

// Graine explicite → exemple reproductible. En usage réel, l'absence de graine = aléatoire.
export const EXAMPLE_SEED = seedFromString('Real Madrid|FC Barcelone')
