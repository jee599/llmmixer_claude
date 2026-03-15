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

  private trustHandled = false
  private authHandled = false
  private promptSent = false
  private outputAccum = ''

  spawn(prompt: string, options: SpawnOptions): void {
    this.autoApprove = options.autoApprove
    this.trustHandled = false
    this.authHandled = false
    this.promptSent = false
    this.outputAccum = ''

    const args: string[] = []
    if (options.autoApprove) {
      args.push('--sandbox=none')
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
        const clean = this.stripAnsi(data)
        this.outputAccum += clean

        // Trust folder 프롬프트 — 번호 "1" + Enter 로 선택
        if (!this.trustHandled && /Do you trust/i.test(this.outputAccum)) {
          this.trustHandled = true
          this.outputAccum = ''
          setTimeout(() => {
            const p = this.ptyProcess as { write?: (d: string) => void }
            p?.write?.('1\r')
          }, 800)
          this.emit('output', data)
          return
        }

        // 인증 프롬프트 — 번호 "1" + Enter 로 "Login with Google" 선택
        if (!this.authHandled && /How would you like to authenticate/i.test(this.outputAccum)) {
          this.authHandled = true
          this.outputAccum = ''
          setTimeout(() => {
            const p = this.ptyProcess as { write?: (d: string) => void }
            p?.write?.('1\r')
          }, 800)
          this.emit('output', data)
          return
        }

        // "Waiting for auth" — 브라우저에서 인증 중, 대시보드에 알림
        if (/Waiting for auth/i.test(clean)) {
          this.setStatus('waiting')
          this.emit('waiting', 'Gemini: Waiting for browser authentication. Complete login in your browser.')
          this.emit('output', data)
          return
        }

        this.handleOutput(data)

        // Ready 감지 후 프롬프트 전달
        if (!this.promptSent && /Ready/i.test(this.outputAccum)) {
          this.promptSent = true
          this.outputAccum = ''
          setTimeout(() => {
            const p = this.ptyProcess as { write?: (d: string) => void }
            p?.write?.(prompt + '\n')
          }, 1500)
        }
      })

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
