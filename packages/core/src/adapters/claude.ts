import { spawn, execFile } from 'node:child_process'
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
    // -p (print) 모드: 프롬프트를 인수로 전달, stdout으로 결과 출력
    // 대화형 모드는 PTY 필요 → 향후 node-pty로 전환 예정
    const args = ['-p', prompt]

    if (options.autoApprove) {
      args.unshift('--dangerously-skip-permissions')
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
