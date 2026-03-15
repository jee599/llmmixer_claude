import { NextRequest, NextResponse } from 'next/server'
import { nukeWorktrees } from '@llmmixer/core'
import { getSessionManager, getProjectPath } from '@/lib/mixer-instance'
import { requireAuth } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const authError = requireAuth(req)
  if (authError) return authError

  const manager = getSessionManager()
  const projectPath = getProjectPath()

  // 프로세스 종료
  manager.killAll()

  // worktree 정리
  try {
    nukeWorktrees(projectPath)
  } catch {
    // git repo가 아닐 수 있음
  }

  return NextResponse.json({ ok: true, message: 'All sessions terminated and worktrees cleaned' })
}
