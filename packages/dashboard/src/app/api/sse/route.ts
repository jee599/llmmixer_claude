import type { SSEEvent } from '@llmmixer/core'
import { getSessionManager, getWorkflowEngine } from '@/lib/mixer-instance'

export const dynamic = 'force-dynamic'

export async function GET() {
  const sessionManager = getSessionManager()
  const workflowEngine = getWorkflowEngine()
  const encoder = new TextEncoder()
  let cleanedUp = false
  let interval: ReturnType<typeof setInterval> | null = null
  let onSessionSSE: ((event: SSEEvent) => void) | null = null
  let onWorkflowSSE: ((event: SSEEvent) => void) | null = null

  function cleanup() {
    if (cleanedUp) return
    cleanedUp = true
    if (onSessionSSE) sessionManager.off('sse', onSessionSSE)
    if (onWorkflowSSE) workflowEngine.off('sse', onWorkflowSSE)
    if (interval) clearInterval(interval)
  }

  const stream = new ReadableStream({
    start(controller) {
      function send(event: SSEEvent) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        } catch {
          cleanup()
        }
      }

      // SessionManager: output, status, waiting, error 이벤트
      onSessionSSE = (event: SSEEvent) => send(event)
      sessionManager.on('sse', onSessionSSE)

      // WorkflowEngine: workflow 타입 이벤트만 (나머지는 SessionManager에서 이미 전송)
      onWorkflowSSE = (event: SSEEvent) => {
        if (event.type === 'workflow') send(event)
      }
      workflowEngine.on('sse', onWorkflowSSE)

      // 초기 상태 전송
      for (const session of sessionManager.getAllSessions()) {
        send({ type: 'status', taskId: session.taskId, status: session.status, agentType: session.agentType })
      }

      const workflow = workflowEngine.getWorkflow()
      if (workflow) {
        send({ type: 'workflow', workflow })
      }

      interval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'))
        } catch {
          cleanup()
        }
      }, 30000)
    },
    cancel() {
      cleanup()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
