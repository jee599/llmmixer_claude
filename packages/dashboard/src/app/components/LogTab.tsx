'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import ApprovalBanner from './ApprovalBanner'

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

interface LogTabProps {
  logs: LogLine[]
  sessions: SessionStatus[]
  waitingMap: Map<string, WaitingInfo>
  onApprove: (taskId: string, input: string) => void
  onKill: (taskId: string) => void
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-gray-500',
  running: 'text-blue-400',
  waiting: 'text-yellow-400',
  complete: 'text-green-400',
  error: 'text-red-400',
}

const AGENT_COLORS: Record<string, string> = {
  claude: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  codex: 'bg-green-500/20 text-green-300 border-green-500/30',
  gemini: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
}

export default function LogTab({ logs, sessions, waitingMap, onApprove, onKill }: LogTabProps) {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const logEndRef = useRef<HTMLDivElement>(null)
  const logContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (autoScroll) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, autoScroll])

  const handleScroll = useCallback(() => {
    const container = logContainerRef.current
    if (!container) return
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50
    setAutoScroll(isAtBottom)
  }, [])

  const filteredLogs = activeTaskId
    ? logs.filter((l) => l.taskId === activeTaskId)
    : logs

  const activeWaiting = activeTaskId
    ? waitingMap.get(activeTaskId)
    : Array.from(waitingMap.values())[0]

  return (
    <div className="flex h-full">
      {/* 세션 목록 사이드바 */}
      <div className="w-56 border-r border-gray-800 flex flex-col">
        <div className="p-3 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 uppercase tracking-wider">Sessions</span>
            <span className="text-xs text-gray-600">{sessions.length}</span>
          </div>
        </div>

        <button
          onClick={() => setActiveTaskId(null)}
          className={`px-3 py-2 text-left text-sm border-b border-gray-800/50 transition-colors ${
            activeTaskId === null ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-900'
          }`}
        >
          All logs
        </button>

        <div className="flex-1 overflow-y-auto">
          {sessions.map((s) => (
            <div
              key={s.taskId}
              onClick={() => setActiveTaskId(s.taskId)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setActiveTaskId(s.taskId)}
              className={`w-full px-3 py-2 text-left border-b border-gray-800/50 transition-colors group cursor-pointer ${
                activeTaskId === s.taskId ? 'bg-gray-800' : 'hover:bg-gray-900'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-gray-300 truncate">
                  {s.taskId}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onKill(s.taskId)
                  }}
                  className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 text-xs"
                  title="Kill session"
                >
                  ✕
                </button>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-block px-1.5 py-0.5 text-[10px] rounded border ${AGENT_COLORS[s.agentType] ?? ''}`}>
                  {s.agentType}
                </span>
                <span className={`text-[10px] ${STATUS_COLORS[s.status] ?? ''}`}>
                  {s.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 로그 뷰어 */}
      <div className="flex-1 flex flex-col">
        {activeWaiting && (
          <div className="p-3">
            <ApprovalBanner
              taskId={activeWaiting.taskId}
              pattern={activeWaiting.pattern}
              onApprove={onApprove}
            />
          </div>
        )}

        <div
          ref={logContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 py-2 font-mono text-sm"
        >
          {filteredLogs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-600">
              No logs yet. Start a session to see output here.
            </div>
          ) : (
            filteredLogs.map((line, i) => (
              <div key={i} className="flex gap-2 leading-relaxed hover:bg-gray-900/50">
                {!activeTaskId && (
                  <span className={`text-[10px] shrink-0 mt-1 ${
                    (AGENT_COLORS[sessions.find((s) => s.taskId === line.taskId)?.agentType ?? ''] ?? '').split(' ')[1] ?? 'text-gray-500'
                  }`}>
                    [{line.taskId}]
                  </span>
                )}
                <span className="text-gray-200 whitespace-pre-wrap break-all">{line.text}</span>
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>

        {!autoScroll && (
          <button
            onClick={() => {
              setAutoScroll(true)
              logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
            }}
            className="absolute bottom-20 right-6 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-full text-xs text-gray-300 hover:bg-gray-700 shadow-lg"
          >
            ↓ Scroll to bottom
          </button>
        )}
      </div>
    </div>
  )
}
