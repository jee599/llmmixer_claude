import { spawn } from 'node:child_process'
import { execFile } from 'node:child_process'
import { AgentAdapter } from './base.js'
import type { AgentType, SpawnOptions } from '../types.js'

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
    const args = options.autoApprove
      ? ['--dangerously-skip-permissions']
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

    // 프롬프트를 stdin으로 전달
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
