#!/usr/bin/env node

import { execSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const command = args[0]

const PROJECT_PATH = process.cwd()
const MIXER_DIR = join(PROJECT_PATH, '.mixer')
const PORT = process.env.PORT ?? '3333'

function ensureMixerDir() {
  mkdirSync(MIXER_DIR, { recursive: true })
}

function openBrowser(url: string) {
  const cmd = process.platform === 'darwin' ? 'open' : 'xdg-open'
  try {
    execSync(`${cmd} ${url}`, { stdio: 'ignore' })
  } catch {
    console.log(`Open ${url} in your browser`)
  }
}

async function main() {
  switch (command) {
    case 'doctor': {
      console.log('Running diagnostics...')
      // Phase 3에서 구현
      console.log('doctor command coming in Sprint 3')
      break
    }

    case 'nuke': {
      console.log('Nuking all sessions...')
      try {
        const res = await fetch(`http://localhost:${PORT}/api/nuke`, { method: 'POST' })
        if (res.ok) {
          console.log('All sessions terminated.')
        } else {
          console.log('Server not running. Cleaning up files...')
        }
      } catch {
        console.log('Server not running. Cleaning up files...')
      }
      break
    }

    default: {
      ensureMixerDir()
      console.log(`Starting LLMMixer dashboard on port ${PORT}...`)

      const dashboardPath = join(import.meta.dirname, '..', 'packages', 'dashboard')

      const server = spawn('npx', ['next', 'dev', '-p', PORT], {
        cwd: dashboardPath,
        stdio: 'inherit',
        env: { ...process.env },
      })

      server.on('error', (err) => {
        console.error('Failed to start dashboard:', err.message)
        process.exit(1)
      })

      // 서버 시작 대기 후 브라우저 열기
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
