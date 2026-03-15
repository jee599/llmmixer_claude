import { execFile } from 'node:child_process'
import { AgentAdapter } from './base.js'
import type { AgentType, SpawnOptions } from '../types.js'

let pty: typeof import('node-pty') | null = null
try {
  pty = await import('node-pty')
} catch {
  // node-pty not available
}

export class ClaudeAdapter extends AgentAdapter {
  readonly name: AgentType = 'claude'
  readonly command = 'claude'
  readonly waitingPatterns = [
    /Do you want to/i,
    /Allow\s/i,
    /\[y\/n\]/i,
    /\[Y\/n\]/i,
    /Press enter/i,
    /approve/i,
    /permission/i,
  ]

  private readyAccum = ''
  private promptDelivered = false
  private readyTimeout: ReturnType<typeof setTimeout> | null = null

  spawn(prompt: string, options: SpawnOptions): void {
    this.autoApprove = options.autoApprove
    this.readyAccum = ''
    this.promptDelivered = false

    const args: string[] = []
    if (options.autoApprove) {
      args.push('--dangerously-skip-permissions')
    }

    if (pty) {
      const proc = pty.spawn(this.command, args, {
        name: 'xterm-256color',
        cols: 120,
        rows: 40,
        cwd: options.worktreePath,
        env: process.env as Record<string, string>,
      })

      this.ptyProcess = proc
      this.setStatus('running')

      proc.onData((data: string) => {
        this.handleOutput(data)
        this.detectReadyAndSend(prompt, data)
      })

      proc.onExit(({ exitCode }: { exitCode: number }) => {
        if (this.readyTimeout) clearTimeout(this.readyTimeout)
        this.handleExit(exitCode)
      })

      // 최대 10초 후 강제 전송
      this.readyTimeout = setTimeout(() => {
        this.deliverPrompt(prompt)
      }, 10000)
    } else {
      // child_process fallback: -p 플래그로 프롬프트 직접 전달
      const cpArgs = [...args, '-p', prompt]
      this.spawnChildProcess(this.command, cpArgs, options)
    }
  }

  private detectReadyAndSend(prompt: string, data: string): void {
    if (this.promptDelivered) return

    const clean = this.stripAnsi(data)
    this.readyAccum += clean

    // Claude CLI ready 시그널: 프롬프트 표시자 (>, ❯, 또는 빈 줄 후 커서)
    const readyPattern = /[>❯]\s*$|^\s*$.*\n[>❯]/m
    if (readyPattern.test(this.readyAccum)) {
      this.deliverPrompt(prompt)
    }
  }

  private deliverPrompt(prompt: string): void {
    if (this.promptDelivered) return
    this.promptDelivered = true

    if (this.readyTimeout) {
      clearTimeout(this.readyTimeout)
      this.readyTimeout = null
    }

    const ptyProc = this.ptyProcess as { write?: (d: string) => void }
    if (ptyProc?.write) {
      ptyProc.write(prompt + '\n')
    }
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
