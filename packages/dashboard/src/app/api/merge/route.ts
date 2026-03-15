import { NextRequest, NextResponse } from 'next/server'
import { mergeWorktree, removeWorktree } from '@llmmixer/core'
import { getProjectPath } from '@/lib/mixer-instance'

export async function POST(req: NextRequest) {
  const body = await req.json() as { taskId: string; targetBranch?: string; cleanup?: boolean }
  const { taskId, targetBranch, cleanup = true } = body

  if (!taskId) {
    return NextResponse.json({ error: 'taskId required' }, { status: 400 })
  }

  const projectPath = getProjectPath()
  const result = mergeWorktree(projectPath, taskId, targetBranch)

  if (result.success && cleanup) {
    removeWorktree(projectPath, taskId)
  }

  return NextResponse.json(result)
}
