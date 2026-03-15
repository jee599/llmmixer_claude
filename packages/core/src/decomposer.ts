import { execFileSync } from 'node:child_process'
import type { AgentType, Task, TaskType } from './types.js'

const VALID_TYPES: TaskType[] = ['design', 'implement', 'review', 'scaffold', 'research', 'docs']

const DECOMPOSE_PROMPT = `You are a task decomposer for a multi-LLM orchestration system.
Analyze the following user prompt and break it down into a list of tasks.

Rules:
- Each task must have: id (t1, t2, ...), type (design|implement|review|scaffold|research|docs), prompt (clear instruction), depends_on (array of task ids)
- Tasks with no dependencies can run in parallel
- Keep the number of tasks between 2-6
- Be practical: don't over-decompose simple requests
- Output ONLY valid JSON, no explanation

User prompt: {{PROMPT}}

Project context:
{{CONTEXT}}

Respond with JSON only:
{"tasks": [{"id": "t1", "type": "research", "prompt": "...", "depends_on": []}, ...]}`

interface DecomposeResult {
  tasks: Array<{
    id: string
    type: string
    prompt: string
    depends_on: string[]
  }>
}

function buildCliCommand(agent: AgentType, prompt: string): string[] {
  switch (agent) {
    case 'claude':
      return ['claude', '-p', prompt]
    case 'codex':
      return ['codex', '-q', prompt]
    case 'gemini':
      return ['gemini', '-p', prompt]
  }
}

function parseJsonFromOutput(output: string): DecomposeResult {
  // LLM 출력에서 JSON 추출 — ```json 블록이나 순수 JSON
  const jsonMatch = output.match(/```(?:json)?\s*([\s\S]*?)```/) ?? output.match(/(\{[\s\S]*\})/)
  if (!jsonMatch) throw new Error('No JSON found in LLM output')

  return JSON.parse(jsonMatch[1].trim())
}

function validateTasks(result: DecomposeResult): Task[] {
  if (!result.tasks || !Array.isArray(result.tasks)) {
    throw new Error('Invalid decompose result: missing tasks array')
  }

  const taskIds = new Set(result.tasks.map((t) => t.id))

  return result.tasks.map((t) => {
    const type = VALID_TYPES.includes(t.type as TaskType) ? (t.type as TaskType) : 'implement'

    const dependsOn = (t.depends_on ?? []).filter((dep: string) => taskIds.has(dep))

    return {
      id: t.id,
      type,
      prompt: t.prompt,
      dependsOn,
      assignedAgent: 'claude' as AgentType, // Router가 이후 할당
      status: 'pending' as const,
    }
  })
}

export function decompose(
  userPrompt: string,
  context: string,
  decomposerAgent: AgentType
): Task[] {
  const fullPrompt = DECOMPOSE_PROMPT
    .replace('{{PROMPT}}', userPrompt)
    .replace('{{CONTEXT}}', context || 'No context available')

  const [cmd, ...args] = buildCliCommand(decomposerAgent, fullPrompt)

  let output: string
  try {
    output = execFileSync(cmd, args, {
      timeout: 60000,
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024,
    })
  } catch (err) {
    throw new Error(`Decomposer (${decomposerAgent}) failed: ${err instanceof Error ? err.message : 'unknown'}`)
  }

  let result: DecomposeResult
  try {
    result = parseJsonFromOutput(output)
  } catch {
    // 재시도 1회
    try {
      output = execFileSync(cmd, args, {
        timeout: 60000,
        encoding: 'utf-8',
        maxBuffer: 1024 * 1024,
      })
      result = parseJsonFromOutput(output)
    } catch (retryErr) {
      throw new Error(`Failed to parse decompose output after retry: ${retryErr instanceof Error ? retryErr.message : 'unknown'}`)
    }
  }

  return validateTasks(result)
}
