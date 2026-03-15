import { NextRequest, NextResponse } from 'next/server'
import type { AgentType } from '@llmmixer/core'
import { getSessionManager, getProjectPath } from '@/lib/mixer-instance'

export async function GET() {
  const manager = getSessionManager()
  return NextResponse.json({ sessions: manager.getAllSessions() })
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    taskId: string
    agentType: AgentType
    prompt: string
    autoApprove?: boolean
    timeout?: number
  }

  const { taskId, agentType, prompt, autoApprove = false, timeout = 300 } = body

  if (!taskId || !agentType || !prompt) {
    return NextResponse.json(
      { error: 'taskId, agentType, and prompt are required' },
      { status: 400 }
    )
  }

  const manager = getSessionManager()
  const projectPath = getProjectPath()

  try {
    manager.startSession(taskId, agentType, prompt, {
      worktreePath: projectPath,
      autoApprove,
      timeout,
    })
    return NextResponse.json({ ok: true, taskId })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const taskId = searchParams.get('taskId')

  if (!taskId) {
    return NextResponse.json({ error: 'taskId required' }, { status: 400 })
  }

  const manager = getSessionManager()
  manager.killSession(taskId)
  return NextResponse.json({ ok: true })
}
