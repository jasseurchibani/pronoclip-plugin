// Utilitaire de TEST (Phase 3, option C) — expose un fichier local en URL publique
// éphémère via cloudflared, le temps que RapidoCMS l'ingère dans sa bibliothèque.
// Sert un dossier en HTTP local + ouvre un quick tunnel cloudflared, puis écrit l'URL
// publique dans pronoclip-output/tunnel-url.txt. Reste vivant jusqu'à kill.
// Lancer : `node scripts/tunnel.mjs <dir> <port> <cloudflared.exe>`

import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

const dir = process.argv[2] || 'pronoclip-output'
const port = Number(process.argv[3] || 8787)
const cf = process.argv[4] || 'node_modules/cloudflared/bin/cloudflared.exe'
const urlFile = join(dir, 'tunnel-url.txt')

// Serveur statique minimal (Range supporté sommairement) — suffisant pour un fetch unique.
const server = createServer((req, res) => {
  const name = decodeURIComponent((req.url || '/').replace(/^\//, '').split('?')[0]) || ''
  try {
    const p = resolve(dir, name)
    const buf = readFileSync(p)
    const type = name.endsWith('.mp4') ? 'video/mp4' : name.endsWith('.png') ? 'image/png' : 'application/octet-stream'
    res.setHeader('Content-Type', type)
    res.setHeader('Content-Length', String(buf.length))
    res.setHeader('Accept-Ranges', 'bytes')
    res.statusCode = 200
    res.end(req.method === 'HEAD' ? undefined : buf)
    console.log(`[serve] ${req.method} /${name} → 200 (${buf.length} o)`)
  } catch {
    res.statusCode = 404
    res.end('not found')
    console.log(`[serve] ${req.method} /${name} → 404`)
  }
})
server.listen(port, () => console.log(`[serve] http://localhost:${port} sert ${dir}`))

// Quick tunnel cloudflared → capture l'URL trycloudflare.com.
const child = spawn(cf, ['tunnel', '--url', `http://localhost:${port}`], { stdio: ['ignore', 'pipe', 'pipe'] })
let captured = false
function scan(d) {
  const s = d.toString()
  process.stdout.write(s)
  const m = s.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)
  if (m && !captured) {
    captured = true
    writeFileSync(urlFile, m[0], 'utf8')
    console.log(`[tunnel] URL publique : ${m[0]} (écrite dans ${urlFile})`)
  }
}
child.stdout.on('data', scan)
child.stderr.on('data', scan)
child.on('exit', code => { console.log('[tunnel] cloudflared terminé', code); server.close(); process.exit(code ?? 0) })
