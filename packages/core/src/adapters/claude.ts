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

  spawn(prompt: string, options: SpawnOptions): void {
    if (!pty) {
      this.emit('output', 'Error: node-pty not installed\n')
      this.setStatus('error')
      return
    }

    this.autoApprove = options.autoApprove

    const args: string[] = []
    if (options.autoApprove) {
      args.push('--dangerously-skip-permissions')
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

    // 프롬프트 전달 — Claude가 초기화된 후 전송
    setTimeout(() => {
      proc.write(prompt + '\n')
    }, 2000)

    proc.onData((data: string) => this.handleOutput(data))
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
