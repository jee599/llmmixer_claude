import { execFile } from 'node:child_process'
import { AgentAdapter } from './base.js'
import type { AgentType, SpawnOptions } from '../types.js'

let pty: typeof import('node-pty') | null = null
try {
  pty = await import('node-pty')
} catch {
  // node-pty not available
}

export class GeminiAdapter extends AgentAdapter {
  readonly name: AgentType = 'gemini'
  readonly command = 'gemini'
  readonly waitingPatterns = [
    /\[y\/n\]/i,
    /approve/i,
    /confirm/i,
  ]

  protected autoRespondPatterns = [
    // Trust folder 프롬프트 — 항상 자동 승인
    { pattern: /Trust folder/i, response: 't' },
    { pattern: /trust this folder/i, response: 't' },
    { pattern: /Trusting a folder/i, response: 't' },
  ]

  spawn(prompt: string, options: SpawnOptions): void {
    if (!pty) {
      this.emit('output', 'Error: node-pty not installed\n')
      this.setStatus('error')
      return
    }

    this.autoApprove = options.autoApprove

    const args: string[] = []
    if (options.autoApprove) {
      args.push('--sandbox=none')
    }

    const proc = pty.spawn(this.command, args, {
      name: 'xterm-256color',
      cols: 120,
      rows: 40,
      cwd: options.worktreePath,
      env: process.env as Record<string, string>,
    })

    this.ptyProcess = proc
    this.setStatus('running')

    // Gemini는 대화형 — 초기화 후 프롬프트 전달
    let promptSent = false
    proc.onData((data: string) => {
      this.handleOutput(data)

      // "Ready" 또는 프롬프트 입력 가능 상태 감지 후 프롬프트 전달
      if (!promptSent && (/Ready/i.test(data) || />/i.test(data) || /Tips for/i.test(data))) {
        promptSent = true
        setTimeout(() => {
          const p = this.ptyProcess as { write?: (d: string) => void }
          p?.write?.(prompt + '\n')
        }, 1000)
      }
    })

    proc.onExit(({ exitCode }: { exitCode: number }) => this.handleExit(exitCode))
  }

  async isInstalled(): Promise<boolean> {
    return new Promise((resolve) => {
      execFile('which', [this.command], (error) => resolve(!error))
    })
  }

  async getVersion(): Promise<string | null> {
    return new Promise((resolve) => {
      execFile(this.command, ['--version'], (error, stdout) => {
        resolve(error ? null : stdout.trim())
      })
    })
  }
}
