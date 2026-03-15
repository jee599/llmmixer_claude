import { NextRequest, NextResponse } from 'next/server'
import { getWorkflowEngine } from '@/lib/mixer-instance'
import { requireAuth } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const authError = requireAuth(req)
  if (authError) return authError

  const body = await req.json() as { taskId: string }
  const { taskId } = body

  if (!taskId) {
    return NextResponse.json({ error: 'taskId required' }, { status: 400 })
  }

  const engine = getWorkflowEngine()

  try {
    engine.retryTask(taskId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
