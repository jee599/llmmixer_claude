'use client'

import { useState, useCallback } from 'react'

interface TaskResult {
  id: string
  type: string
  assignedAgent: string
  status: string
  prompt: string
  output?: string
  startedAt?: number
  completedAt?: number
}

interface WorkflowData {
  tasks: TaskResult[]
  status: string
  createdAt: number
  completedAt?: number
}

interface ResultsTabProps {
  workflow: WorkflowData | null
}

const AGENT_COLORS: Record<string, string> = {
  claude: 'border-orange-500/30 bg-orange-500/10',
  codex: 'border-green-500/30 bg-green-500/10',
  gemini: 'border-blue-500/30 bg-blue-500/10',
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m ${seconds % 60}s`
}

export default function ResultsTab({ workflow }: ResultsTabProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [merging, setMerging] = useState<string | null>(null)

  const handleMerge = useCallback(async (taskId: string) => {
    setMerging(taskId)
    try {
      const res = await fetch('/api/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      })
      const result = await res.json()
      alert(result.success ? `Merged: ${result.message}` : `Failed: ${result.message}`)
    } catch {
      alert('Merge request failed')
    } finally {
      setMerging(null)
    }
  }, [])

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text)
  }, [])

  if (!workflow) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600">
        No workflow results yet.
      </div>
    )
  }

  const completedTasks = workflow.tasks.filter((t) => t.status === 'complete' || t.status === 'error')
  const totalDuration = workflow.completedAt
    ? workflow.completedAt - workflow.createdAt
    : Date.now() - workflow.createdAt

  return (
    <div className="h-full overflow-y-auto">
      {/* 요약 */}
      <div className="border-b border-gray-800 px-6 py-4">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-400">
            {completedTasks.length}/{workflow.tasks.length} tasks done
          </span>
          <span className="text-gray-600">·</span>
          <span className="text-gray-400">
            Total: {formatDuration(totalDuration)}
          </span>
          <span className="text-gray-600">·</span>
          <span className={workflow.status === 'complete' ? 'text-green-400' : workflow.status === 'error' ? 'text-red-400' : 'text-blue-400'}>
            {workflow.status}
          </span>
        </div>
      </div>

      {/* 결과 카드 */}
      <div className="p-6 space-y-4">
        {workflow.tasks.map((task) => {
          const isExpanded = expandedId === task.id
          const duration = task.startedAt && task.completedAt
            ? formatDuration(task.completedAt - task.startedAt)
            : '—'

          return (
            <div
              key={task.id}
              className={`border rounded-lg overflow-hidden ${AGENT_COLORS[task.assignedAgent] ?? 'border-gray-700'}`}
            >
              {/* 카드 헤더 */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : task.id)}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-800/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={`text-xs ${task.status === 'complete' ? 'text-green-400' : task.status === 'error' ? 'text-red-400' : 'text-gray-400'}`}>
                    {task.status === 'complete' ? '✓' : task.status === 'error' ? '✗' : '○'}
                  </span>
                  <span className="text-sm font-medium text-gray-200">{task.id}</span>
                  <span className="text-xs text-gray-500">{task.type}</span>
                  <span className="text-xs text-gray-600">{task.assignedAgent}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">{duration}</span>
                  <span className="text-gray-600">{isExpanded ? '▾' : '▸'}</span>
                </div>
              </button>

              {/* 카드 내용 */}
              {isExpanded && (
                <div className="border-t border-gray-800/50 px-4 py-3">
                  <div className="mb-2">
                    <p className="text-xs text-gray-500 mb-1">Prompt</p>
                    <p className="text-sm text-gray-300">{task.prompt}</p>
                  </div>

                  {task.output && (
                    <div className="mb-3">
                      <p className="text-xs text-gray-500 mb-1">Output</p>
                      <pre className="bg-gray-900/70 rounded p-3 text-xs text-gray-300 overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap">
                        {task.output}
                      </pre>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {task.output && (
                      <button
                        onClick={() => handleCopy(task.output!)}
                        className="px-3 py-1 text-xs bg-gray-800 hover:bg-gray-700 rounded transition-colors"
                      >
                        Copy output
                      </button>
                    )}
                    {task.status === 'complete' && (
                      <button
                        onClick={() => handleMerge(task.id)}
                        disabled={merging === task.id}
                        className="px-3 py-1 text-xs bg-green-800 hover:bg-green-700 text-green-200 rounded transition-colors disabled:opacity-50"
                      >
                        {merging === task.id ? 'Merging...' : 'Merge'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
