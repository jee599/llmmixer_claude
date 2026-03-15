import { spawn, execFile } from 'node:child_process'
import { AgentAdapter } from './base.js'
import type { AgentType, SpawnOptions } from '../types.js'

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
    const args = options.autoApprove
      ? ['--approval-mode', 'full-auto']
      : []

    this.proc = spawn(this.command, args, {
      cwd: options.worktreePath,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    })

    this.setStatus('running')

    this.proc.stdout?.on('data', (data: Buffer) => this.handleStdout(data))
    this.proc.stderr?.on('data', (data: Buffer) => {
      this.emit('output', data.toString())
    })
    this.proc.on('exit', (code) => this.handleExit(code))
    this.proc.on('error', (err) => {
      this.emit('output', `Error: ${err.message}\n`)
      this.setStatus('error')
    })

    if (this.proc.stdin) {
      this.proc.stdin.write(prompt + '\n')
    }
  }

  async isInstalled(): Promise<boolean> {
    return new Promise((resolve) => {
      execFile('which', [this.command], (error) => {
        resolve(!error)
      })
    })
  }

  async getVersion(): Promise<string | null> {
    return new Promise((resolve) => {
      execFile(this.command, ['--version'], (error, stdout) => {
        if (error) {
          resolve(null)
          return
        }
        resolve(stdout.trim())
      })
    })
  }
}
