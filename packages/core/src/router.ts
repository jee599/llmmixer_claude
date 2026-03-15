import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AgentType, RoutingRules, Task, TaskType } from './types.js'

const DEFAULT_ROUTING: RoutingRules = {
  design: 'claude',
  review: 'claude',
  implement: 'codex',
  scaffold: 'codex',
  research: 'gemini',
  docs: 'gemini',
}

// 에이전트 사용 불가 시 폴백 순서
const FALLBACK_ORDER: Record<TaskType, AgentType[]> = {
  design: ['claude', 'gemini', 'codex'],
  review: ['claude', 'gemini', 'codex'],
  implement: ['codex', 'claude', 'gemini'],
  scaffold: ['codex', 'claude', 'gemini'],
  research: ['gemini', 'claude', 'codex'],
  docs: ['gemini', 'claude', 'codex'],
}

function loadRoutingRules(projectPath: string): RoutingRules {
  try {
    const content = readFileSync(join(projectPath, '.mixer', 'routing.json'), 'utf-8')
    const custom = JSON.parse(content) as Partial<RoutingRules>
    return { ...DEFAULT_ROUTING, ...custom }
  } catch {
    return DEFAULT_ROUTING
  }
}

export function route(
  tasks: Task[],
  projectPath: string,
  availableAgents: Set<AgentType> = new Set(['claude', 'codex', 'gemini'])
): Task[] {
  const rules = loadRoutingRules(projectPath)

  return tasks.map((task) => {
    const preferred = rules[task.type]

    if (availableAgents.has(preferred)) {
      return { ...task, assignedAgent: preferred }
    }

    // 폴백
    const fallback = FALLBACK_ORDER[task.type].find((a) => availableAgents.has(a))
    return { ...task, assignedAgent: fallback ?? 'claude' }
  })
}

export function getDefaultRouting(): RoutingRules {
  return { ...DEFAULT_ROUTING }
}
