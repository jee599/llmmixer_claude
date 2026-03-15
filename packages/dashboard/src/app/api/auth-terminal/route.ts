import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

let pty: typeof import('node-pty') | null = null
try {
  pty = await import('node-pty')
} catch { /* */ }

type AgentType = 'claude' | 'codex' | 'gemini'

interface AuthSession {
  proc: ReturnType<NonNullable<typeof pty>['spawn']>
  output: string[]
}

const authSessions = new Map<string, AuthSession>()

// SSE로 인증 터미널 출력 스트리밍
export async function GET(req: NextRequest) {
  const agent = req.nextUrl.searchParams.get('agent') as AgentType
  if (!agent) {
    return NextResponse.json({ error: 'agent required' }, { status: 400 })
  }

  const session = authSessions.get(agent)
  if (!session) {
    return NextResponse.json({ error: 'no auth session' }, { status: 404 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      // 기존 출력 전송
      for (const line of session.output) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ data: line })}\n\n`))
      }

      const onData = (data: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ data })}\n\n`))
        } catch { /* */ }
      }

      session.proc.onData(onData)
      session.proc.onExit(() => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'exit' })}\n\n`))
          controller.close()
        } catch { /* */ }
        authSessions.delete(agent)
      })
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  })
}

// 인증 터미널 시작
export async function POST(req: NextRequest) {
  const body = await req.json() as { agent: AgentType }
  const { agent } = body

  if (!pty) {
    return NextResponse.json({ error: 'node-pty not available' }, { status: 500 })
  }

  // 기존 세션 정리
  const existing = authSessions.get(agent)
  if (existing) {
    existing.proc.kill()
    authSessions.delete(agent)
  }

  const proc = pty.spawn(agent, [], {
    name: 'xterm-256color',
    cols: 100,
    rows: 30,
    cwd: process.cwd(),
    env: process.env as Record<string, string>,
  })

  const session: AuthSession = { proc, output: [] }
  proc.onData((data: string) => {
    session.output.push(data)
    if (session.output.length > 500) session.output.shift()
  })

  authSessions.set(agent, session)

  return NextResponse.json({ ok: true, agent })
}

// 인증 터미널에 입력 전달
export async function PUT(req: NextRequest) {
  const body = await req.json() as { agent: AgentType; input: string }
  const session = authSessions.get(body.agent)
  if (!session) {
    return NextResponse.json({ error: 'no auth session' }, { status: 404 })
  }
  session.proc.write(body.input)
  return NextResponse.json({ ok: true })
}
