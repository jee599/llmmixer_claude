import { NextRequest, NextResponse } from 'next/server'
import { getSessionManager } from '@/lib/mixer-instance'

export async function POST(req: NextRequest) {
  const body = await req.json() as { taskId: string; input: string }
  const { taskId, input } = body

  if (!taskId || input === undefined) {
    return NextResponse.json(
      { error: 'taskId and input are required' },
      { status: 400 }
    )
  }

  const manager = getSessionManager()
  try {
    manager.approveSession(taskId, input)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
