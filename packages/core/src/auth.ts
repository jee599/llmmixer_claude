import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const TOKEN_FILE = '.mixer/session-token'

export function generateToken(projectPath: string): string {
  const token = randomUUID()
  const mixerDir = join(projectPath, '.mixer')
  mkdirSync(mixerDir, { recursive: true })
  writeFileSync(join(projectPath, TOKEN_FILE), token, { mode: 0o600 })
  return token
}

export function loadToken(projectPath: string): string | null {
  try {
    return readFileSync(join(projectPath, TOKEN_FILE), 'utf-8').trim()
  } catch {
    return null
  }
}

export function validateToken(projectPath: string, token: string): boolean {
  const stored = loadToken(projectPath)
  if (!stored) return false
  return stored === token
}
