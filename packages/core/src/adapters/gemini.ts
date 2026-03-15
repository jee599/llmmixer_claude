import { spawn, execFile } from 'node:child_process'
import { AgentAdapter } from './base.js'
import type { AgentType, SpawnOptions } from '../types.js'

export class GeminiAdapter extends AgentAdapter {
  readonly name: AgentType = 'gemini'
  readonly command = 'gemini'
  readonly waitingPatterns = [
    /\[y\/n\]/i,
    /approve/i,
    /confirm/i,
    /allow/i,
  ]

  spawn(prompt: string, options: SpawnOptions): void {
    // -p (prompt) 모드
    const args = ['-p', prompt]

    if (options.autoApprove) {
      args.unshift('--sandbox=none')
    }

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
