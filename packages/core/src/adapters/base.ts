import { EventEmitter } from 'node:events'
import { spawn as cpSpawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import type { AgentType, TaskStatus, SpawnOptions } from '../types.js'

export abstract class AgentAdapter extends EventEmitter {
  abstract readonly name: AgentType
  abstract readonly command: string
  abstract readonly waitingPatterns: RegExp[]

  // 자동으로 응답해야 하는 패턴 (trust 프롬프트 등)
  protected autoRespondPatterns: Array<{ pattern: RegExp; response: string }> = []

  protected ptyProcess: unknown = null
  protected childProcess: ChildProcess | null = null
  protected _status: TaskStatus = 'pending'
  protected outputBuffer: string[] = []
  protected autoApprove = false

  // 패턴 매칭 dedup: 마지막 매칭 시각 추적
  private lastMatchedAt = new Map<string, number>()
  private static readonly DEDUP_INTERVAL_MS = 2000

  get status(): TaskStatus {
    return this._status
  }

  get pid(): number | undefined {
    const ptyPid = (this.ptyProcess as { pid?: number })?.pid
    return ptyPid ?? this.childProcess?.pid
  }

  get isChildProcessMode(): boolean {
    return this.childProcess !== null && this.ptyProcess === null
  }

  protected setStatus(status: TaskStatus): void {
    this._status = status
    this.emit('status', status)
  }

  abstract spawn(prompt: string, options: SpawnOptions): void

  /**
   * child_process.spawn으로 fallback 실행
   */
  protected spawnChildProcess(
    command: string,
    args: string[],
    options: SpawnOptions
  ): ChildProcess {
    const proc = cpSpawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: options.worktreePath,
      env: process.env as Record<string, string>,
    })

    this.childProcess = proc
    this.setStatus('running')

    proc.stdout?.on('data', (data: Buffer) => {
      this.handleOutput(data.toString())
    })

    proc.stderr?.on('data', (data: Buffer) => {
      this.handleOutput(data.toString())
    })

    proc.on('exit', (code: number | null) => {
      this.handleExit(code ?? 1)
    })

    proc.on('error', (err: Error) => {
      this.emit('output', `Process error: ${err.message}\n`)
      this.handleExit(1)
    })

    return proc
  }

  sendInput(text: string): void {
    // PTY mode
    const pty = this.ptyProcess as { write?: (data: string) => void }
    if (pty?.write) {
      pty.write(text + '\n')
      if (this._status === 'waiting') {
        this.setStatus('running')
      }
      return
    }

    // child_process fallback mode
    if (this.childProcess?.stdin?.writable) {
      this.childProcess.stdin.write(text + '\n')
      if (this._status === 'waiting') {
        this.setStatus('running')
      }
    }
  }

  kill(): void {
    // PTY mode
    const pty = this.ptyProcess as { kill?: (signal?: string) => void }
    if (pty?.kill) {
      pty.kill()
    }

    // child_process fallback mode
    if (this.childProcess) {
      this.childProcess.kill('SIGTERM')
      // 3초 후 SIGKILL
      const proc = this.childProcess
      setTimeout(() => {
        if (!proc.killed) {
          proc.kill('SIGKILL')
        }
      }, 3000)
    }

    this.setStatus('error')
  }

  abstract isInstalled(): Promise<boolean>
  abstract getVersion(): Promise<string | null>

  protected stripAnsi(str: string): string {
    return str
      .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
      .replace(/\x1b\][^\x07]*\x07/g, '')
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
  }

  /**
   * dedup 체크: 같은 패턴이 2초 이내 재매칭되면 무시
   */
  private isDuplicate(patternKey: string): boolean {
    const now = Date.now()
    const lastTime = this.lastMatchedAt.get(patternKey)
    if (lastTime && now - lastTime < AgentAdapter.DEDUP_INTERVAL_MS) {
      return true
    }
    this.lastMatchedAt.set(patternKey, now)
    return false
  }

  protected handleOutput(data: string): void {
    this.outputBuffer.push(data)
    this.emit('output', data)

    const clean = this.stripAnsi(data)

    // 자동 응답 패턴 체크 (trust 프롬프트 등)
    for (const { pattern, response } of this.autoRespondPatterns) {
      if (pattern.test(clean)) {
        const key = `auto:${pattern.source}`
        if (this.isDuplicate(key)) continue
        setTimeout(() => this.sendInput(response), 500)
        return
      }
    }

    // autoApprove 모드면 승인 패턴도 자동 응답
    if (this.autoApprove) {
      for (const pattern of this.waitingPatterns) {
        if (pattern.test(clean)) {
          const key = `approve:${pattern.source}`
          if (this.isDuplicate(key)) continue
          setTimeout(() => this.sendInput('y'), 500)
          return
        }
      }
    }

    // 승인 대기 패턴 체크
    for (const pattern of this.waitingPatterns) {
      if (pattern.test(clean)) {
        const key = `waiting:${pattern.source}`
        if (this.isDuplicate(key)) continue
        this.setStatus('waiting')
        this.emit('waiting', clean.trim())
        return
      }
    }
  }

  protected handleExit(code: number): void {
    this.ptyProcess = null
    this.childProcess = null
    if (this._status !== 'error') {
      this.setStatus(code === 0 ? 'complete' : 'error')
    }
    this.emit('exit', code)
  }

  getOutput(): string {
    return this.outputBuffer.join('')
  }
}
