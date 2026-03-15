import { execFile } from 'node:child_process'
import { AgentAdapter } from './base.js'
import type { AgentType, SpawnOptions } from '../types.js'

function getPty(): typeof import('node-pty') | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('node-pty') as typeof import('node-pty')
  } catch {
    return null
  }
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
      args.push('-a', 'never')
    }
    args.push(prompt)

    const pty = getPty()
    if (pty) {
      try {
        const proc = pty.spawn(this.command, args, {
          name: 'xterm-256color',
          cols: 120,
          rows: 40,
          cwd: options.worktreePath,
          env: process.env as Record<string, string>,
        })

        this.ptyProcess = proc
        this.setStatus('running')

        proc.onData((data: string) => this.handleOutput(data))
        proc.onExit(({ exitCode }: { exitCode: number }) => this.handleExit(exitCode))
      } catch (err) {
        this.emit('output', `PTY spawn error: ${err instanceof Error ? err.message : String(err)}\n`)
        this.setStatus('error')
      }
    } else {
      // child_process fallback
      this.spawnChildProcess(this.command, ['exec', ...args], options)
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
