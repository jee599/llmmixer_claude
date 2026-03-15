'use client'

import { useState, useEffect } from 'react'
import DagGraph from './DagGraph'
import ApprovalBanner from './ApprovalBanner'

interface FlowTask {
  id: string
  type: string
  prompt: string
  dependsOn: string[]
  assignedAgent: string
  status: string
  output?: string
  error?: string
  startedAt?: number
  completedAt?: number
}

interface Workflow {
  id: string
  prompt: string
  template: string
  tasks: FlowTask[]
  status: string
  createdAt: number
  completedAt?: number
}

interface WaitingInfo {
  taskId: string
  pattern: string
}

interface FlowTabProps {
  workflow: Workflow | null
  waitingMap: Map<string, WaitingInfo>
  onNodeClick?: (taskId: string) => void
  onApprove?: (taskId: string, input: string) => void
}

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: 'text-gray-400', bg: 'bg-gray-800' },
  running: { label: 'Running', color: 'text-blue-400', bg: 'bg-blue-950/50' },
  waiting: { label: 'Waiting', color: 'text-yellow-400', bg: 'bg-yellow-950/50' },
  complete: { label: 'Complete', color: 'text-green-400', bg: 'bg-green-950/50' },
  error: { label: 'Error', color: 'text-red-400', bg: 'bg-red-950/50' },
}

const AGENT_BADGE: Record<string, string> = {
  claude: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  codex: 'bg-green-500/20 text-green-300 border-green-500/30',
  gemini: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

export default function FlowTab({ workflow, waitingMap, onNodeClick, onApprove }: FlowTabProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [, setTick] = useState(0)

  // 경과 시간 타이머: 워크플로우 진행 중일 때 매 초 업데이트
  useEffect(() => {
    if (!workflow || workflow.completedAt || workflow.status === 'complete' || workflow.status === 'error') return

    const interval = setInterval(() => {
      setTick((t) => t + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [workflow?.completedAt, workflow?.status, workflow])

  if (!workflow) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600">
        No workflow active. Enter a prompt to begin.
      </div>
    )
  }

  const statusInfo = STATUS_BADGE[workflow.status] ?? STATUS_BADGE.pending
  const elapsed = workflow.completedAt
    ? formatDuration(workflow.completedAt - workflow.createdAt)
    : formatDuration(Date.now() - workflow.createdAt)
  const completed = workflow.tasks.filter((t) => t.status === 'complete').length
  const errored = workflow.tasks.filter((t) => t.status === 'error').length

  const selectedTask = selectedTaskId
    ? workflow.tasks.find((t) => t.id === selectedTaskId)
    : null

  const handleNodeClick = (taskId: string) => {
    setSelectedTaskId(taskId === selectedTaskId ? null : taskId)
  }

  return (
    <div className="flex flex-col h-full">
      {/* 워크플로우 헤더 */}
      <div className="border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className={`text-sm font-medium ${statusInfo.color}`}>
              {workflow.status === 'running' && (
                <span className="inline-block w-2 h-2 bg-blue-400 rounded-full animate-pulse mr-1.5" />
              )}
              {statusInfo.label}
            </span>
            <span className="text-xs text-gray-500">
              {workflow.template}
            </span>
            <span className="text-xs text-gray-500">
              {elapsed}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1 truncate max-w-xl">
            {workflow.prompt}
          </p>
        </div>
        <div className="flex gap-4 text-xs">
          <span className="text-green-400">{completed} done</span>
          {errored > 0 && <span className="text-red-400">{errored} failed</span>}
          <span className="text-gray-500">{workflow.tasks.length} total</span>
        </div>
      </div>

      {/* 승인 대기 배너 */}
      {Array.from(waitingMap.values()).map((w) => (
        <div key={w.taskId} className="px-4 pt-3">
          <ApprovalBanner
            taskId={w.taskId}
            pattern={w.pattern}
            onApprove={onApprove ?? (() => {})}
          />
        </div>
      ))}

      {/* DAG + 디테일 패널 */}
      <div className="flex-1 flex overflow-hidden">
        {/* DAG */}
        <div className={`overflow-auto p-4 ${selectedTask ? 'flex-1' : 'w-full'}`}>
          <DagGraph tasks={workflow.tasks} onNodeClick={handleNodeClick} />
        </div>

        {/* 디테일 패널 */}
        {selectedTask && (
          <div className="w-96 border-l border-gray-800 flex flex-col overflow-hidden">
            {/* 패널 헤더 */}
            <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-200">{selectedTask.id}</span>
                <span className={`inline-block px-1.5 py-0.5 text-[10px] rounded border ${AGENT_BADGE[selectedTask.assignedAgent] ?? ''}`}>
                  {selectedTask.assignedAgent}
                </span>
              </div>
              <button
                onClick={() => setSelectedTaskId(null)}
                className="text-gray-500 hover:text-gray-300 text-sm"
              >
                ✕
              </button>
            </div>

            {/* 패널 내용 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* 상태 */}
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Status</p>
                <span className={`inline-block px-2 py-1 text-xs rounded ${STATUS_BADGE[selectedTask.status]?.bg} ${STATUS_BADGE[selectedTask.status]?.color}`}>
                  {selectedTask.status === 'running' && (
                    <span className="inline-block w-2 h-2 bg-blue-400 rounded-full animate-pulse mr-1" />
                  )}
                  {STATUS_BADGE[selectedTask.status]?.label}
                </span>
                {selectedTask.startedAt && (
                  <span className="ml-2 text-xs text-gray-600">
                    {selectedTask.completedAt
                      ? formatDuration(selectedTask.completedAt - selectedTask.startedAt)
                      : formatDuration(Date.now() - selectedTask.startedAt)
                    }
                  </span>
                )}
              </div>

              {/* 타입 */}
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Type</p>
                <span className="text-sm text-gray-300">{selectedTask.type}</span>
              </div>

              {/* 의존성 */}
              {selectedTask.dependsOn.length > 0 && (
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Depends on</p>
                  <div className="flex gap-1.5">
                    {selectedTask.dependsOn.map((dep) => {
                      const depTask = workflow.tasks.find((t) => t.id === dep)
                      return (
                        <button
                          key={dep}
                          onClick={() => setSelectedTaskId(dep)}
                          className={`px-2 py-0.5 text-xs rounded border border-gray-700 hover:border-gray-500 transition-colors ${
                            depTask?.status === 'complete' ? 'text-green-400' : 'text-gray-400'
                          }`}
                        >
                          {dep}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* 프롬프트 */}
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Prompt</p>
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{selectedTask.prompt}</p>
              </div>

              {/* 에러 */}
              {selectedTask.error && (
                <div>
                  <p className="text-[10px] text-red-500 uppercase tracking-wider mb-1">Error</p>
                  <p className="text-sm text-red-300 bg-red-950/30 rounded p-2">{selectedTask.error}</p>
                </div>
              )}

              {/* 출력 */}
              {selectedTask.output && (
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Output</p>
                  <pre className="text-xs text-gray-300 bg-gray-900/70 rounded p-3 overflow-x-auto max-h-80 overflow-y-auto whitespace-pre-wrap">
                    {selectedTask.output}
                  </pre>
                </div>
              )}

              {/* 실행 중이면 안내 */}
              {selectedTask.status === 'running' && (
                <div className="flex items-center gap-2 text-xs text-blue-400">
                  <span className="inline-block w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  Agent is working...
                </div>
              )}

              {/* Log 탭으로 이동 */}
              {(selectedTask.status === 'running' || selectedTask.status === 'waiting') && (
                <button
                  onClick={() => onNodeClick?.(selectedTask.id)}
                  className="w-full px-3 py-2 text-xs text-center bg-gray-800 hover:bg-gray-700 rounded transition-colors"
                >
                  View live logs →
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
