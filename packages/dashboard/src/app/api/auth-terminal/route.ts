import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function getPty(): typeof import('node-pty') | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('node-pty') as typeof import('node-pty')
  } catch {
    return null
  }
}

type AgentType = 'claude' | 'codex' | 'gemini'

interface AuthSession {
  proc: { onData: (cb: (data: string) => void) => void; onExit: (cb: () => void) => void; write: (data: string) => void; kill: () => void }
  output: string[]
}

const authSessions = new Map<string, AuthSession>()

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
      for (const line of session.output) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ data: line })}\n\n`))
      }

      session.proc.onData((data: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ data })}\n\n`))
        } catch { /* closed */ }
      })

      session.proc.onExit(() => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'exit' })}\n\n`))
          controller.close()
        } catch { /* closed */ }
        authSessions.delete(agent)
      })
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { agent: AgentType }
  const { agent } = body

  const pty = getPty()
  if (!pty) {
    return NextResponse.json({ error: 'node-pty not available' }, { status: 500 })
  }

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

export async function PUT(req: NextRequest) {
  const body = await req.json() as { agent: AgentType; input: string }
  const session = authSessions.get(body.agent)
  if (!session) {
    return NextResponse.json({ error: 'no auth session' }, { status: 404 })
  }
  session.proc.write(body.input)
  return NextResponse.json({ ok: true })
}
