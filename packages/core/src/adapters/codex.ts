import { execFile } from 'node:child_process'
import { AgentAdapter } from './base.js'
import type { AgentType, SpawnOptions } from '../types.js'

let pty: typeof import('node-pty') | null = null
try {
  pty = await import('node-pty')
} catch {
  // node-pty not available
}

export class CodexAdapter extends AgentAdapter {
  readonly name: AgentType = 'codex'
  readonly command = 'codex'
  readonly waitingPatterns = [
    /approve/i,
    /\[y\/n\]/i,
    /confirm/i,
    /allow/i,
  ]

  spawn(prompt: string, options: SpawnOptions): void {
    this.autoApprove = options.autoApprove

    const args: string[] = []
    if (options.autoApprove) {
      args.push('--approval-mode', 'full-auto')
    }
    // 프롬프트를 CLI arg로 전달하지 않음 (ARG_MAX 한계)
    // stdin으로 전달

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

      // stdin으로 프롬프트 전달
      setTimeout(() => {
        proc.write(prompt + '\n')
      }, 500)

      proc.onData((data: string) => this.handleOutput(data))
      proc.onExit(({ exitCode }: { exitCode: number }) => this.handleExit(exitCode))
    } else {
      // child_process fallback: stdin으로 프롬프트 전달
      const proc = this.spawnChildProcess(this.command, args, options)
      if (proc.stdin?.writable) {
        proc.stdin.write(prompt + '\n')
        proc.stdin.end()
      }
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
