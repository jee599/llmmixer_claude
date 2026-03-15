import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { getProjectPath } from '@/lib/mixer-instance'
import { requireAuth } from '@/lib/auth'

const DEFAULT_CONFIG = {
  decomposer: 'claude',
  maxAgents: 6,
  timeout: 300,
  autoApprove: false,
}

const DEFAULT_ROUTING = {
  design: 'claude',
  review: 'claude',
  implement: 'codex',
  scaffold: 'codex',
  research: 'gemini',
  docs: 'gemini',
}

function readJson(path: string, fallback: unknown): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch {
    return fallback
  }
}

export async function GET() {
  const projectPath = getProjectPath()
  const mixerDir = join(projectPath, '.mixer')

  const config = readJson(join(mixerDir, 'config.json'), DEFAULT_CONFIG)
  const routing = readJson(join(mixerDir, 'routing.json'), DEFAULT_ROUTING)

  return NextResponse.json({ config, routing })
}

export async function PUT(req: NextRequest) {
  const authError = requireAuth(req)
  if (authError) return authError

  const body = await req.json() as { config?: Record<string, unknown>; routing?: Record<string, unknown> }
  const projectPath = getProjectPath()
  const mixerDir = join(projectPath, '.mixer')

  mkdirSync(mixerDir, { recursive: true })

  if (body.config) {
    writeFileSync(join(mixerDir, 'config.json'), JSON.stringify(body.config, null, 2))
  }
  if (body.routing) {
    writeFileSync(join(mixerDir, 'routing.json'), JSON.stringify(body.routing, null, 2))
  }

  return NextResponse.json({ ok: true })
}
