import { NextRequest, NextResponse } from 'next/server'
import { execFileSync } from 'node:child_process'
import type { AgentType, TemplateName } from '@llmmixer/core'
import { getWorkflowEngine } from '@/lib/mixer-instance'

function isCommandAvailable(cmd: string): boolean {
  try {
    execFileSync('which', [cmd], { timeout: 3000 })
    return true
  } catch {
    return false
  }
}

function detectAvailableAgents(): Set<AgentType> {
  const agents = new Set<AgentType>()

  // node-pty로 대화형 모드 지원 — 설치만 돼있으면 사용 가능
  if (isCommandAvailable('claude')) agents.add('claude')
  if (isCommandAvailable('codex')) agents.add('codex')
  if (isCommandAvailable('gemini')) agents.add('gemini')

  if (agents.size === 0) agents.add('codex')
  return agents
}

let cachedAgents: Set<AgentType> | null = null

function getAvailableAgents(): Set<AgentType> {
  if (!cachedAgents) cachedAgents = detectAvailableAgents()
  return cachedAgents
}

export async function GET() {
  const engine = getWorkflowEngine()
  return NextResponse.json({ workflow: engine.getWorkflow() })
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    prompt: string
    template: TemplateName
    autoApprove?: boolean
  }

  const { prompt, template, autoApprove } = body

  if (!prompt || !template) {
    return NextResponse.json({ error: 'prompt and template are required' }, { status: 400 })
  }

  const engine = getWorkflowEngine()
  const available = getAvailableAgents()

  try {
    const workflow = await engine.start(prompt, template, available, autoApprove)
    return NextResponse.json({ workflow })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
