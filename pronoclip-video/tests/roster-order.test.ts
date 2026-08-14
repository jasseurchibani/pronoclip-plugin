// Ordre de l'effectif au rendu.
// Règle : un effectif CURÉ (joueurs clés marqués) est intact ; un effectif NON CURÉ est
// mélangé de façon déterministe par la graine, sinon le buteur serait toujours le premier
// nom par ordre alphabétique dans toutes les vidéos d'une équipe.

import { describe, it, expect } from 'vitest'
import type { Player } from '../core/types'
import { orderRosterForMatch, slugify } from '../scripts/render-pipeline'

const uncurated: Player[] = ['Ana', 'Bruno', 'Caio', 'Dora', 'Elio', 'Fabio']
  .map(name => ({ name, profile: { position: 'MF' as const } }))

const curated: Player[] = [
  { name: 'Star', isKeyPlayer: true, profile: { position: 'FW' } },
  { name: 'Autre', profile: { position: 'DF' } },
]

describe('orderRosterForMatch', () => {
  it('laisse un effectif curé strictement intact', () => {
    expect(orderRosterForMatch(curated, 123)).toEqual(curated)
    expect(orderRosterForMatch(curated, 999)).toEqual(curated)
  })

  it('mélange un effectif non curé', () => {
    const out = orderRosterForMatch(uncurated, 42)
    expect(out.map(p => p.name).sort()).toEqual(uncurated.map(p => p.name).sort())
    expect(out.map(p => p.name)).not.toEqual(uncurated.map(p => p.name))
  })

  it('est déterministe pour une graine donnée', () => {
    expect(orderRosterForMatch(uncurated, 7)).toEqual(orderRosterForMatch(uncurated, 7))
  })

  it('donne des têtes de liste différentes selon la graine (buteurs variés)', () => {
    const firsts = new Set([1, 2, 3, 4, 5, 6, 7, 8].map(s => orderRosterForMatch(uncurated, s)[0].name))
    expect(firsts.size).toBeGreaterThan(1)
  })

  it('ne perd ni ne duplique aucun joueur', () => {
    const out = orderRosterForMatch(uncurated, 55)
    expect(out).toHaveLength(uncurated.length)
    expect(new Set(out.map(p => p.name)).size).toBe(uncurated.length)
  })

  it('supporte les effectifs vides ou à un seul joueur', () => {
    expect(orderRosterForMatch([], 1)).toEqual([])
    expect(orderRosterForMatch([uncurated[0]], 1)).toEqual([uncurated[0]])
  })
})

describe('slugify', () => {
  it('produit un nom de fichier sûr', () => {
    expect(slugify('Saudi Arabia')).toBe('saudi-arabia')
    expect(slugify('Côte d\'Ivoire')).toBe('cote-d-ivoire')
    expect(slugify('!!!')).toBe('match')
  })
})
