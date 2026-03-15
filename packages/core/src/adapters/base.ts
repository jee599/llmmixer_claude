import { ChildProcess } from 'node:child_process'
import { EventEmitter } from 'node:events'
import type { AgentType, TaskStatus, SpawnOptions } from '../types.js'

export interface AdapterEvents {
  output: (data: string) => void
  waiting: (pattern: string) => void
  status: (status: TaskStatus) => void
  exit: (code: number | null) => void
}

export abstract class AgentAdapter extends EventEmitter {
  abstract readonly name: AgentType
  abstract readonly command: string
  abstract readonly waitingPatterns: RegExp[]

  protected proc: ChildProcess | null = null
  protected _status: TaskStatus = 'pending'
  protected outputBuffer: string[] = []

  get status(): TaskStatus {
    return this._status
  }

  get pid(): number | undefined {
    return this.proc?.pid
  }

  protected setStatus(status: TaskStatus): void {
    this._status = status
    this.emit('status', status)
  }

  abstract spawn(prompt: string, options: SpawnOptions): void

  sendInput(text: string): void {
    if (!this.proc?.stdin?.writable) return
    this.proc.stdin.write(text + '\n')
    if (this._status === 'waiting') {
      this.setStatus('running')
    }
  }

  kill(): void {
    if (this.proc && !this.proc.killed) {
      this.proc.kill('SIGTERM')
      setTimeout(() => {
        if (this.proc && !this.proc.killed) {
          this.proc.kill('SIGKILL')
        }
      }, 5000)
    }
    this.setStatus('error')
  }

  abstract isInstalled(): Promise<boolean>
  abstract getVersion(): Promise<string | null>

  protected handleStdout(data: Buffer): void {
    const text = data.toString()
    this.outputBuffer.push(text)
    this.emit('output', text)

    for (const pattern of this.waitingPatterns) {
      if (pattern.test(text)) {
        this.setStatus('waiting')
        this.emit('waiting', text.trim())
        return
      }
    }
  }

  protected handleExit(code: number | null): void {
    this.proc = null
    if (this._status !== 'error') {
      this.setStatus(code === 0 ? 'complete' : 'error')
    }
    this.emit('exit', code)
  }

  getOutput(): string {
    return this.outputBuffer.join('')
  }
}
