import { NextRequest, NextResponse } from 'next/server'
import { execFileSync } from 'node:child_process'
import { getProjectPath } from '@/lib/mixer-instance'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const taskId = searchParams.get('taskId')

  if (!taskId) {
    return NextResponse.json({ error: 'taskId required' }, { status: 400 })
  }

  const projectPath = getProjectPath()

  try {
    const diff = execFileSync(
      'git',
      ['diff', `main...mixer/${taskId}`],
      { cwd: projectPath, timeout: 10000, encoding: 'utf-8', maxBuffer: 5 * 1024 * 1024 }
    )
    return NextResponse.json({ diff })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get diff'
    return NextResponse.json({ diff: '', error: message })
  }
}
