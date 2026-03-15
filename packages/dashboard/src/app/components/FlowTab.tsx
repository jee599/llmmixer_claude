'use client'

import DagGraph from './DagGraph'

interface FlowTask {
  id: string
  type: string
  prompt: string
  dependsOn: string[]
  assignedAgent: string
  status: string
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

interface FlowTabProps {
  workflow: Workflow | null
  onNodeClick?: (taskId: string) => void
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  planning: { label: 'Planning', color: 'text-gray-400' },
  running: { label: 'Running', color: 'text-blue-400' },
  complete: { label: 'Complete', color: 'text-green-400' },
  error: { label: 'Error', color: 'text-red-400' },
}

export default function FlowTab({ workflow, onNodeClick }: FlowTabProps) {
  if (!workflow) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600">
        No workflow active. Enter a prompt with a template to begin.
      </div>
    )
  }

  const statusInfo = STATUS_LABELS[workflow.status] ?? STATUS_LABELS.planning
  const elapsed = workflow.completedAt
    ? ((workflow.completedAt - workflow.createdAt) / 1000).toFixed(1)
    : ((Date.now() - workflow.createdAt) / 1000).toFixed(1)

  const completed = workflow.tasks.filter((t) => t.status === 'complete').length
  const errored = workflow.tasks.filter((t) => t.status === 'error').length

  return (
    <div className="flex flex-col h-full">
      {/* 워크플로우 헤더 */}
      <div className="border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className={`text-sm font-medium ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
            <span className="text-xs text-gray-500">
              Template: {workflow.template}
            </span>
            <span className="text-xs text-gray-500">
              {elapsed}s elapsed
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

      {/* DAG */}
      <div className="flex-1 overflow-auto p-4">
        <DagGraph tasks={workflow.tasks} onNodeClick={onNodeClick} />
      </div>
    </div>
  )
}
