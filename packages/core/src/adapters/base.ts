import { EventEmitter } from 'node:events'
import type { AgentType, TaskStatus, SpawnOptions } from '../types.js'

export abstract class AgentAdapter extends EventEmitter {
  abstract readonly name: AgentType
  abstract readonly command: string
  abstract readonly waitingPatterns: RegExp[]

  // 자동으로 응답해야 하는 패턴 (trust 프롬프트 등)
  protected autoRespondPatterns: Array<{ pattern: RegExp; response: string }> = []

  protected ptyProcess: unknown = null
  protected _status: TaskStatus = 'pending'
  protected outputBuffer: string[] = []
  protected autoApprove = false

  get status(): TaskStatus {
    return this._status
  }

  get pid(): number | undefined {
    return (this.ptyProcess as { pid?: number })?.pid
  }

  protected setStatus(status: TaskStatus): void {
    this._status = status
    this.emit('status', status)
  }

  abstract spawn(prompt: string, options: SpawnOptions): void

  sendInput(text: string): void {
    const pty = this.ptyProcess as { write?: (data: string) => void }
    if (pty?.write) {
      pty.write(text + '\n')
      if (this._status === 'waiting') {
        this.setStatus('running')
      }
    }
  }

  kill(): void {
    const pty = this.ptyProcess as { kill?: (signal?: string) => void }
    if (pty?.kill) {
      pty.kill()
    }
    this.setStatus('error')
  }

  abstract isInstalled(): Promise<boolean>
  abstract getVersion(): Promise<string | null>

  protected handleOutput(data: string): void {
    this.outputBuffer.push(data)
    this.emit('output', data)

    // 자동 응답 패턴 체크 (trust 프롬프트 등)
    for (const { pattern, response } of this.autoRespondPatterns) {
      if (pattern.test(data)) {
        setTimeout(() => this.sendInput(response), 500)
        return
      }
    }

    // autoApprove 모드면 승인 패턴도 자동 응답
    if (this.autoApprove) {
      for (const pattern of this.waitingPatterns) {
        if (pattern.test(data)) {
          setTimeout(() => this.sendInput('y'), 500)
          return
        }
      }
    }

    // 승인 대기 패턴 체크
    for (const pattern of this.waitingPatterns) {
      if (pattern.test(data)) {
        this.setStatus('waiting')
        this.emit('waiting', data.trim())
        return
      }
    }
  }

  protected handleExit(code: number): void {
    this.ptyProcess = null
    if (this._status !== 'error') {
      this.setStatus(code === 0 ? 'complete' : 'error')
    }
    this.emit('exit', code)
  }

  getOutput(): string {
    return this.outputBuffer.join('')
  }
}
