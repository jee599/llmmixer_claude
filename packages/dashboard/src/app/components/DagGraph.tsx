'use client'

import { useMemo } from 'react'

interface DagTask {
  id: string
  type: string
  prompt: string
  dependsOn: string[]
  assignedAgent: string
  status: string
}

interface DagGraphProps {
  tasks: DagTask[]
  onNodeClick?: (taskId: string) => void
}

const STATUS_STYLES: Record<string, { bg: string; border: string; pulse?: boolean }> = {
  pending: { bg: '#374151', border: '#4B5563' },
  running: { bg: '#1E3A5F', border: '#3B82F6', pulse: true },
  waiting: { bg: '#78350F', border: '#D97706', pulse: true },
  complete: { bg: '#14532D', border: '#22C55E' },
  error: { bg: '#7F1D1D', border: '#EF4444' },
}

const AGENT_ICONS: Record<string, string> = {
  claude: '🟠',
  codex: '🟢',
  gemini: '🔵',
}

const NODE_W = 180
const NODE_H = 70
const GAP_X = 60
const GAP_Y = 30

function topologicalLayers(tasks: DagTask[]): DagTask[][] {
  const layers: DagTask[][] = []
  const placed = new Set<string>()
  const remaining = [...tasks]

  while (remaining.length > 0) {
    const layer = remaining.filter((t) =>
      t.dependsOn.every((dep) => placed.has(dep))
    )

    if (layer.length === 0) {
      // 순환 의존 — 남은 것 전부 마지막 레이어에
      layers.push(remaining)
      break
    }

    layers.push(layer)
    for (const t of layer) placed.add(t.id)
    for (const t of layer) {
      const idx = remaining.indexOf(t)
      if (idx >= 0) remaining.splice(idx, 1)
    }
  }

  return layers
}

export default function DagGraph({ tasks, onNodeClick }: DagGraphProps) {
  const { nodes, edges, width, height } = useMemo(() => {
    const layers = topologicalLayers(tasks)
    const positions = new Map<string, { x: number; y: number }>()

    let maxX = 0
    let maxY = 0

    layers.forEach((layer, layerIdx) => {
      const x = layerIdx * (NODE_W + GAP_X) + 40
      layer.forEach((task, nodeIdx) => {
        const y = nodeIdx * (NODE_H + GAP_Y) + 40
        positions.set(task.id, { x, y })
        maxX = Math.max(maxX, x + NODE_W)
        maxY = Math.max(maxY, y + NODE_H)
      })
    })

    const nodeData = tasks.map((t) => ({
      ...t,
      pos: positions.get(t.id) ?? { x: 0, y: 0 },
    }))

    const edgeData: Array<{ from: { x: number; y: number }; to: { x: number; y: number }; fromId: string; toId: string }> = []
    for (const task of tasks) {
      const toPos = positions.get(task.id)
      if (!toPos) continue
      for (const dep of task.dependsOn) {
        const fromPos = positions.get(dep)
        if (!fromPos) continue
        edgeData.push({
          fromId: dep,
          toId: task.id,
          from: { x: fromPos.x + NODE_W, y: fromPos.y + NODE_H / 2 },
          to: { x: toPos.x, y: toPos.y + NODE_H / 2 },
        })
      }
    }

    return {
      nodes: nodeData,
      edges: edgeData,
      width: maxX + 40,
      height: maxY + 40,
    }
  }, [tasks])

  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600">
        No workflow active. Enter a prompt with a template to begin.
      </div>
    )
  }

  return (
    <svg width={width} height={height} className="w-full h-full">
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#6B7280" />
        </marker>
      </defs>

      {/* Edges */}
      {edges.map((e, i) => {
        const midX = (e.from.x + e.to.x) / 2
        return (
          <path
            key={i}
            d={`M${e.from.x},${e.from.y} C${midX},${e.from.y} ${midX},${e.to.y} ${e.to.x},${e.to.y}`}
            fill="none"
            stroke="#4B5563"
            strokeWidth={2}
            markerEnd="url(#arrowhead)"
          />
        )
      })}

      {/* Nodes */}
      {nodes.map((node) => {
        const style = STATUS_STYLES[node.status] ?? STATUS_STYLES.pending
        return (
          <g
            key={node.id}
            transform={`translate(${node.pos.x}, ${node.pos.y})`}
            onClick={() => onNodeClick?.(node.id)}
            className="cursor-pointer"
          >
            {style.pulse && (
              <rect
                width={NODE_W}
                height={NODE_H}
                rx={8}
                fill="none"
                stroke={style.border}
                strokeWidth={2}
                opacity={0.3}
              >
                <animate attributeName="opacity" values="0.3;0.1;0.3" dur="2s" repeatCount="indefinite" />
              </rect>
            )}
            <rect
              width={NODE_W}
              height={NODE_H}
              rx={8}
              fill={style.bg}
              stroke={style.border}
              strokeWidth={2}
            />
            <text x={12} y={22} fill="white" fontSize={12} fontWeight="600">
              {AGENT_ICONS[node.assignedAgent] ?? '⚪'} {node.type}
            </text>
            <text x={12} y={40} fill="#9CA3AF" fontSize={10}>
              {node.id} · {node.assignedAgent}
            </text>
            <text x={12} y={56} fill="#6B7280" fontSize={9}>
              {node.prompt.slice(0, 25)}{node.prompt.length > 25 ? '...' : ''}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
