import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { AgentType, Task, TaskType } from './types.js'

const execFileAsync = promisify(execFile)

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
      return ['codex', 'exec', prompt]
    case 'gemini':
      return ['gemini', '-p', prompt]
  }
}

function stripAnsi(str: string): string {
  return str
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\x1b\][^\x07]*\x07/g, '')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
}

function parseJsonFromOutput(output: string): DecomposeResult {
  const clean = stripAnsi(output)

  // codex exec 출력에서 실제 응답 부분만 추출 (헤더 제거)
  const codexMatch = clean.match(/codex\n([\s\S]*?)(?:\ntokens used|\n?$)/)
  const content = codexMatch ? codexMatch[1].trim() : clean

  // ```json 블록 → 중괄호 JSON → 배열 JSON
  const jsonMatch =
    content.match(/```(?:json)?\s*([\s\S]*?)```/) ??
    content.match(/(\{[\s\S]*\})/) ??
    content.match(/(\[[\s\S]*\])/)

  if (!jsonMatch) throw new Error(`No JSON found in LLM output:\n${content.slice(0, 300)}`)

  const parsed = JSON.parse(jsonMatch[1].trim())

  // 배열로 반환된 경우 wrapping
  if (Array.isArray(parsed)) {
    return { tasks: parsed }
  }

  return parsed
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

async function runAgent(cmd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync(cmd, args, {
    timeout: 60000,
    maxBuffer: 1024 * 1024,
  })
  return stdout
}

export async function decompose(
  userPrompt: string,
  context: string,
  decomposerAgent: AgentType
): Promise<Task[]> {
  const fullPrompt = DECOMPOSE_PROMPT
    .replace('{{PROMPT}}', userPrompt)
    .replace('{{CONTEXT}}', context || 'No context available')

  const [cmd, ...args] = buildCliCommand(decomposerAgent, fullPrompt)

  let output: string
  try {
    output = await runAgent(cmd, args)
  } catch (err) {
    throw new Error(`Decomposer (${decomposerAgent}) failed: ${err instanceof Error ? err.message : 'unknown'}`)
  }

  let result: DecomposeResult
  try {
    result = parseJsonFromOutput(output)
  } catch {
    // 재시도 1회
    try {
      output = await runAgent(cmd, args)
      result = parseJsonFromOutput(output)
    } catch (retryErr) {
      throw new Error(`Failed to parse decompose output after retry: ${retryErr instanceof Error ? retryErr.message : 'unknown'}`)
    }
  }

  return validateTasks(result)
}
