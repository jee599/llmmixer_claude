import { EventEmitter } from 'node:events'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { AgentType, TaskStatus, SpawnOptions, SessionInfo, SSEEvent } from './types.js'
import { AgentAdapter } from './adapters/base.js'
import { createAdapter } from './adapters/index.js'

interface ActiveSession {
  info: SessionInfo
  adapter: AgentAdapter
  timeout?: ReturnType<typeof setTimeout>
}

export class SessionManager extends EventEmitter {
  private sessions = new Map<string, ActiveSession>()
  private projectPath: string
  private saveDebounce: ReturnType<typeof setTimeout> | null = null

  constructor(projectPath: string) {
    super()
    this.projectPath = projectPath
  }

  startSession(
    taskId: string,
    agentType: AgentType,
    prompt: string,
    options: SpawnOptions
  ): void {
    if (this.sessions.has(taskId)) {
      throw new Error(`Session ${taskId} already exists`)
    }

    const adapter = createAdapter(agentType)

    const info: SessionInfo = {
      taskId,
      agentType,
      status: 'pending',
      startedAt: Date.now(),
    }

    const session: ActiveSession = { info, adapter }
    this.sessions.set(taskId, session)

    adapter.on('output', (data: string) => {
      const event: SSEEvent = { type: 'output', taskId, data }
      this.emit('sse', event)
    })

    adapter.on('status', (status: TaskStatus) => {
      info.status = status
      info.pid = adapter.pid
      const event: SSEEvent = { type: 'status', taskId, status, agentType }
      this.emit('sse', event)
      this.debouncedSave()
    })

    adapter.on('waiting', (pattern: string) => {
      const event: SSEEvent = { type: 'waiting', taskId, pattern }
      this.emit('sse', event)
    })

    adapter.on('exit', () => {
      if (session.timeout) clearTimeout(session.timeout)
      this.debouncedSave()
    })

    // 타임아웃 설정
    if (options.timeout > 0) {
      session.timeout = setTimeout(() => {
        if (adapter.status === 'running' || adapter.status === 'waiting') {
          adapter.kill()
          const event: SSEEvent = {
            type: 'error',
            taskId,
            message: `Session timed out after ${options.timeout}s`,
          }
          this.emit('sse', event)
        }
      }, options.timeout * 1000)
    }

    adapter.spawn(prompt, options)
  }

  approveSession(taskId: string, input: string): void {
    const session = this.sessions.get(taskId)
    if (!session) throw new Error(`Session ${taskId} not found`)
    session.adapter.sendInput(input)
  }

  killSession(taskId: string): void {
    const session = this.sessions.get(taskId)
    if (!session) return
    if (session.timeout) clearTimeout(session.timeout)
    session.adapter.kill()
  }

  killAll(): void {
    for (const [taskId] of this.sessions) {
      this.killSession(taskId)
    }
    this.sessions.clear()
    this.debouncedSave()
  }

  getSession(taskId: string): ActiveSession | undefined {
    return this.sessions.get(taskId)
  }

  getAllSessions(): SessionInfo[] {
    return Array.from(this.sessions.values()).map((s) => s.info)
  }

  getSessionOutput(taskId: string): string {
    const session = this.sessions.get(taskId)
    if (!session) return ''
    return session.adapter.getOutput()
  }

  private debouncedSave(): void {
    if (this.saveDebounce) clearTimeout(this.saveDebounce)
    this.saveDebounce = setTimeout(() => this.saveState(), 500)
  }

  private saveState(): void {
    const stateDir = join(this.projectPath, '.mixer')
    mkdirSync(stateDir, { recursive: true })
    const state = {
      sessions: this.getAllSessions(),
      savedAt: Date.now(),
    }
    writeFileSync(join(stateDir, 'state.json'), JSON.stringify(state, null, 2))
  }
}
