#!/usr/bin/env node

import { execSync, spawn, execFile } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const command = args[0]
const PROJECT_PATH = process.cwd()
const MIXER_DIR = join(PROJECT_PATH, '.mixer')
const PORT = process.env.PORT ?? '3333'

function ensureMixerDir() {
  mkdirSync(MIXER_DIR, { recursive: true })
}

function openBrowser(url) {
  const cmd = process.platform === 'darwin' ? 'open' : 'xdg-open'
  try {
    execSync(`${cmd} ${url}`, { stdio: 'ignore' })
  } catch {
    console.log(`Open ${url} in your browser`)
  }
}

function checkCmd(name, versionArgs) {
  return new Promise((resolve) => {
    execFile('which', [name], (whichErr) => {
      if (whichErr) {
        resolve({ installed: false })
        return
      }
      execFile(name, versionArgs, { timeout: 10000 }, (err, stdout) => {
        if (err) {
          resolve({ installed: true })
          return
        }
        resolve({ installed: true, version: stdout.trim().split('\n')[0] })
      })
    })
  })
}

async function doctor() {
  console.log('\n  LLMMixer Doctor\n')
  const checks = [
    { name: 'Node.js', cmd: 'node', args: ['--version'] },
    { name: 'Git', cmd: 'git', args: ['--version'] },
    { name: 'Claude Code', cmd: 'claude', args: ['--version'] },
    { name: 'Codex CLI', cmd: 'codex', args: ['--version'] },
    { name: 'Gemini CLI', cmd: 'gemini', args: ['--version'] },
  ]

  let available = 0
  for (const c of checks) {
    const result = await checkCmd(c.cmd, c.args)
    const icon = result.installed ? '  ✓' : '  ✗'
    const color = result.installed ? '\x1b[32m' : '\x1b[31m'
    const version = result.version ? ` — ${result.version}` : ''
    const status = result.installed ? 'installed' : 'not found'
    console.log(`${color}${icon}\x1b[0m ${c.name}${version} (${status})`)
    if (['claude', 'codex', 'gemini'].includes(c.cmd) && result.installed) available++
  }

  console.log(`\n  ${available}/3 agents available.\n`)
}

async function main() {
  switch (command) {
    case 'doctor': {
      await doctor()
      break
    }

    case 'nuke': {
      console.log('Nuking all sessions...')
      try {
        const res = await fetch(`http://localhost:${PORT}/api/nuke`, { method: 'POST' })
        if (res.ok) {
          console.log('All sessions terminated.')
        } else {
          console.log('Server not running.')
        }
      } catch {
        console.log('Server not running.')
      }
      break
    }

    default: {
      ensureMixerDir()
      console.log(`\n  Starting LLMMixer dashboard on port ${PORT}...\n`)

      const dashboardPath = join(__dirname, '..', 'packages', 'dashboard')

      const server = spawn('npx', ['next', 'dev', '-p', PORT], {
        cwd: dashboardPath,
        stdio: 'inherit',
        env: { ...process.env },
      })

      server.on('error', (err) => {
        console.error('Failed to start dashboard:', err.message)
        process.exit(1)
      })

      setTimeout(() => {
        openBrowser(`http://localhost:${PORT}`)
      }, 3000)

      process.on('SIGINT', () => {
        server.kill()
        process.exit(0)
      })
    }
  }
}

main()
