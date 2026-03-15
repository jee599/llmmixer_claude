import { NextRequest, NextResponse } from 'next/server'
import type { AgentType, TemplateName } from '@llmmixer/core'
import { getWorkflowEngine } from '@/lib/mixer-instance'

export async function GET() {
  const engine = getWorkflowEngine()
  const workflow = engine.getWorkflow()
  return NextResponse.json({ workflow })
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    prompt: string
    template: TemplateName
    autoApprove?: boolean
    availableAgents?: AgentType[]
  }

  const { prompt, template, autoApprove, availableAgents = ['claude', 'codex', 'gemini'] } = body

  if (!prompt || !template) {
    return NextResponse.json(
      { error: 'prompt and template are required' },
      { status: 400 }
    )
  }

  const engine = getWorkflowEngine()

  try {
    const workflow = await engine.start(
      prompt,
      template,
      new Set(availableAgents),
      autoApprove
    )
    return NextResponse.json({ workflow })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
