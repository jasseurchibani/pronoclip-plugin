import { describe, it, expect } from 'vitest'
import {
  resolvePortrait, makePortraitResolver, namespaceOrder, NotSeededError, CANONICAL_NAMESPACE,
} from '../core/portrait-index'
import type { PortraitAsset, SquadIndex } from '../core/types'

const asset = (url: string): PortraitAsset => ({
  portrait_url: url,
  descriptor: { build: 'lean', hair: 'short dark hair', skin: 'tan', boots: 'red boots', number: 9 },
  seed: 1,
  version: 1,
  status: 'frozen',
})

const canonical: SquadIndex = {
  namespace: 'pronoclip',
  team: 'Real Madrid',
  team_code: 'real_madrid',
  players: { 'Mbappé': asset('canon/mbappe.png'), 'Vinícius Jr': asset('canon/vini.png') },
}
const brand: SquadIndex = {
  namespace: 'acme',
  team: 'Real Madrid',
  team_code: 'real_madrid',
  players: { 'Mbappé': asset('acme/mbappe.png') },
}
const squads = [canonical, brand]

describe('namespaceOrder', () => {
  it('marque d’abord, puis canonique', () => {
    expect(namespaceOrder('acme')).toEqual(['acme', 'pronoclip'])
  })
  it('dédupliqué quand la marque EST le canonique', () => {
    expect(namespaceOrder('pronoclip')).toEqual(['pronoclip'])
    expect(CANONICAL_NAMESPACE).toBe('pronoclip')
  })
})

describe('resolvePortrait', () => {
  const order = namespaceOrder('acme')
  it('le namespace de marque surcharge le canonique', () => {
    const p = resolvePortrait({ squads, namespaceOrder: order, team: 'Real Madrid', teamCode: 'real_madrid', playerName: 'Mbappé' })
    expect(p.portrait_url).toBe('acme/mbappe.png')
  })
  it('retombe sur le canonique quand la marque n’a pas semé ce joueur', () => {
    const p = resolvePortrait({ squads, namespaceOrder: order, team: 'Real Madrid', teamCode: 'real_madrid', playerName: 'Vinícius Jr' })
    expect(p.portrait_url).toBe('canon/vini.png')
  })
  it('lève « non semé » (erreur dure) si absent partout', () => {
    expect(() => resolvePortrait({ squads, namespaceOrder: order, team: 'Real Madrid', teamCode: 'real_madrid', playerName: 'Bellingham' }))
      .toThrow(NotSeededError)
    try {
      resolvePortrait({ squads, namespaceOrder: order, team: 'Real Madrid', teamCode: 'real_madrid', playerName: 'Bellingham' })
    } catch (e) {
      expect((e as Error).message).toContain('non semé')
      expect((e as Error).message).toContain('/pronoclip-squad Real Madrid')
    }
  })
})

describe('makePortraitResolver', () => {
  it('résout par côté (home/away) avec héritage marque → canonique', () => {
    const resolve = makePortraitResolver({
      squads,
      brandNamespace: 'acme',
      home: { name: 'Real Madrid', teamCode: 'real_madrid' },
      away: { name: 'FC Barcelone', teamCode: 'fc_barcelone' },
    })
    expect(resolve('Mbappé', 'home').portrait_url).toBe('acme/mbappe.png')
    expect(resolve('Vinícius Jr', 'home').portrait_url).toBe('canon/vini.png')
    expect(() => resolve('Lewandowski', 'away')).toThrow(NotSeededError)
  })
})
