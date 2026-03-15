import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type {
  AgentType,
  MixerConfig,
  Task,
  TemplateName,
  Workflow,
  SSEEvent,
} from './types.js'
import { decompose } from './decomposer.js'
import { route } from './router.js'
import { collectContext } from './context.js'
import { SessionManager } from './session-manager.js'
import { createWorktree } from './worktree.js'

const DEFAULT_CONFIG: MixerConfig = {
  decomposer: 'claude',
  maxAgents: 6,
  timeout: 300,
  autoApprove: false,
}

export class WorkflowEngine extends EventEmitter {
  private projectPath: string
  private sessionManager: SessionManager
  private config: MixerConfig
  private activeWorkflow: Workflow | null = null
  private runningCount = 0

  constructor(projectPath: string, sessionManager: SessionManager) {
    super()
    this.projectPath = projectPath
    this.sessionManager = sessionManager
    this.config = this.loadConfig()

    this.sessionManager.on('sse', (event: SSEEvent) => {
      if (event.type === 'status' && this.activeWorkflow) {
        this.onTaskStatusChange(event.taskId, event.status)
      }
      this.emit('sse', event)
    })
  }

  private loadConfig(): MixerConfig {
    try {
      const content = readFileSync(join(this.projectPath, '.mixer', 'config.json'), 'utf-8')
      const custom = JSON.parse(content) as Partial<MixerConfig>
      return { ...DEFAULT_CONFIG, ...custom }
    } catch {
      return { ...DEFAULT_CONFIG }
    }
  }

  async start(
    prompt: string,
    template: TemplateName,
    availableAgents: Set<AgentType>,
    autoApprove?: boolean
  ): Promise<Workflow> {
    const workflow: Workflow = {
      id: randomUUID(),
      prompt,
      template,
      tasks: [],
      status: 'planning',
      createdAt: Date.now(),
    }

    this.activeWorkflow = workflow
    this.broadcastWorkflow()

    try {
      let tasks: Task[]

      if (template === 'auto') {
        const context = collectContext(this.projectPath)
        tasks = decompose(prompt, context, this.config.decomposer)
      } else {
        tasks = this.loadTemplate(template, prompt)
      }

      tasks = route(tasks, this.projectPath, availableAgents)
      workflow.tasks = tasks
      workflow.status = 'running'
      this.broadcastWorkflow()

      this.scheduleReady(autoApprove ?? this.config.autoApprove)
    } catch (err) {
      workflow.status = 'error'
      this.broadcastWorkflow()
      throw err
    }

    return workflow
  }

  private loadTemplate(name: TemplateName, userPrompt: string): Task[] {
    const templatePath = join(this.projectPath, 'config', 'templates', `${name}.json`)
    let content: string
    try {
      content = readFileSync(templatePath, 'utf-8')
    } catch {
      // 패키지 내 기본 템플릿 시도
      const fallback = join(import.meta.dirname, '..', '..', '..', 'config', 'templates', `${name}.json`)
      content = readFileSync(fallback, 'utf-8')
    }

    const template = JSON.parse(content) as {
      tasks: Array<{ id: string; type: string; promptTemplate: string; dependsOn: string[] }>
    }

    return template.tasks.map((t) => ({
      id: t.id,
      type: t.type as Task['type'],
      prompt: t.promptTemplate.replace(/\{\{prompt\}\}/g, userPrompt),
      dependsOn: t.dependsOn,
      assignedAgent: 'claude' as AgentType,
      status: 'pending' as const,
    }))
  }

  private scheduleReady(autoApprove: boolean): void {
    if (!this.activeWorkflow) return

    const { tasks } = this.activeWorkflow

    for (const task of tasks) {
      if (task.status !== 'pending') continue
      if (this.runningCount >= this.config.maxAgents) break

      const depsComplete = task.dependsOn.every((depId) => {
        const dep = tasks.find((t) => t.id === depId)
        return dep?.status === 'complete'
      })

      if (depsComplete) {
        this.runTask(task, autoApprove)
      }
    }
  }

  private runTask(task: Task, autoApprove: boolean): void {
    task.status = 'running'
    task.startedAt = Date.now()
    this.runningCount++

    // worktree 생성 (git repo인 경우)
    let worktreePath = this.projectPath
    try {
      worktreePath = createWorktree(this.projectPath, task.id)
      task.worktreePath = worktreePath
    } catch {
      // git repo가 아니면 프로젝트 루트에서 실행
    }

    const enrichedPrompt = this.enrichPrompt(task)

    this.sessionManager.startSession(task.id, task.assignedAgent, enrichedPrompt, {
      worktreePath,
      autoApprove,
      timeout: this.config.timeout,
    })

    this.broadcastWorkflow()
  }

  private enrichPrompt(task: Task): string {
    if (!this.activeWorkflow) return task.prompt

    let prompt = task.prompt
    for (const depId of task.dependsOn) {
      const output = this.sessionManager.getSessionOutput(depId)
      if (output) {
        prompt = prompt.replace(`{{${depId}.output}}`, output)
      }
    }
    return prompt
  }

  private onTaskStatusChange(taskId: string, status: string): void {
    if (!this.activeWorkflow) return

    const task = this.activeWorkflow.tasks.find((t) => t.id === taskId)
    if (!task) return

    task.status = status as Task['status']

    if (status === 'complete') {
      task.completedAt = Date.now()
      task.output = this.sessionManager.getSessionOutput(taskId)
      this.runningCount = Math.max(0, this.runningCount - 1)
      this.scheduleReady(this.config.autoApprove)

      // 모든 태스크 완료 체크
      if (this.activeWorkflow.tasks.every((t) => t.status === 'complete')) {
        this.activeWorkflow.status = 'complete'
        this.activeWorkflow.completedAt = Date.now()
      }
    } else if (status === 'error') {
      this.runningCount = Math.max(0, this.runningCount - 1)

      // 의존하는 태스크도 에러로
      for (const t of this.activeWorkflow.tasks) {
        if (t.dependsOn.includes(taskId) && t.status === 'pending') {
          t.status = 'error'
          t.error = `Dependency ${taskId} failed`
        }
      }

      // 모든 태스크가 완료 또는 에러인지 체크
      if (this.activeWorkflow.tasks.every((t) => t.status === 'complete' || t.status === 'error')) {
        this.activeWorkflow.status = 'error'
      }
    }

    this.broadcastWorkflow()
  }

  private broadcastWorkflow(): void {
    if (!this.activeWorkflow) return
    const event: SSEEvent = { type: 'workflow', workflow: { ...this.activeWorkflow } }
    this.emit('sse', event)
  }

  getWorkflow(): Workflow | null {
    return this.activeWorkflow
  }

  getConfig(): MixerConfig {
    return { ...this.config }
  }
}
