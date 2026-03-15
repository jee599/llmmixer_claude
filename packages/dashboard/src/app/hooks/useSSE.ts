'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

interface LogLine {
  taskId: string
  text: string
  timestamp: number
}

interface WaitingInfo {
  taskId: string
  pattern: string
}

interface SessionStatus {
  taskId: string
  agentType: string
  status: string
}

interface WorkflowData {
  id: string
  prompt: string
  template: string
  tasks: Array<{
    id: string
    type: string
    prompt: string
    dependsOn: string[]
    assignedAgent: string
    status: string
  }>
  status: string
  createdAt: number
  completedAt?: number
}

const MAX_LINES = 5000

export function useSSE(autoApprove: boolean) {
  const [logs, setLogs] = useState<LogLine[]>([])
  const [sessions, setSessions] = useState<SessionStatus[]>([])
  const [waitingMap, setWaitingMap] = useState<Map<string, WaitingInfo>>(new Map())
  const [workflow, setWorkflow] = useState<WorkflowData | null>(null)
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    const es = new EventSource('/api/sse')
    esRef.current = es

    es.onmessage = (e) => {
      const event = JSON.parse(e.data)

      switch (event.type) {
        case 'output':
          setLogs((prev) => {
            const next = [...prev, { taskId: event.taskId, text: event.data, timestamp: Date.now() }]
            return next.length > MAX_LINES ? next.slice(-MAX_LINES) : next
          })
          break

        case 'status':
          if (event.taskId === '__init__') break
          setSessions((prev) => {
            const existing = prev.find((s) => s.taskId === event.taskId)
            if (existing) {
              return prev.map((s) =>
                s.taskId === event.taskId ? { ...s, status: event.status, agentType: event.agentType ?? s.agentType } : s
              )
            }
            return [...prev, { taskId: event.taskId, agentType: event.agentType ?? 'claude', status: event.status }]
          })
          if (event.status !== 'waiting') {
            setWaitingMap((prev) => {
              const next = new Map(prev)
              next.delete(event.taskId)
              return next
            })
          }
          break

        case 'waiting':
          if (autoApprove) {
            fetch('/api/approve', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ taskId: event.taskId, input: 'y' }),
            })
          } else {
            setWaitingMap((prev) => new Map(prev).set(event.taskId, event))
          }
          break

        case 'workflow':
          setWorkflow(event.workflow)
          break
      }
    }

    es.onerror = () => {
      // 자동 재연결은 EventSource가 처리
    }

    return () => {
      es.close()
      esRef.current = null
    }
  }, [autoApprove])

  const clearWaiting = useCallback((taskId: string) => {
    setWaitingMap((prev) => {
      const next = new Map(prev)
      next.delete(taskId)
      return next
    })
  }, [])

  const clearAll = useCallback(() => {
    setLogs([])
    setSessions([])
    setWaitingMap(new Map())
    setWorkflow(null)
  }, [])

  return { logs, sessions, waitingMap, workflow, setWorkflow, clearWaiting, clearAll }
}
