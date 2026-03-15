import { execFile } from 'node:child_process'
import type { DoctorCheck, DoctorResult, TemplateName } from './types.js'

function checkCommand(cmd: string, versionArgs: string[]): Promise<DoctorCheck> {
  return new Promise((resolve) => {
    execFile('which', [cmd], (whichErr) => {
      if (whichErr) {
        resolve({ installed: false })
        return
      }

      execFile(cmd, versionArgs, { timeout: 10000 }, (err, stdout) => {
        if (err) {
          resolve({ installed: true, version: undefined })
          return
        }
        resolve({ installed: true, version: stdout.trim().split('\n')[0] })
      })
    })
  })
}

function checkAgent(cmd: string, versionArgs: string[]): Promise<DoctorCheck> {
  return new Promise((resolve) => {
    execFile('which', [cmd], (whichErr) => {
      if (whichErr) {
        resolve({ installed: false, authenticated: false })
        return
      }

      execFile(cmd, versionArgs, { timeout: 10000 }, (err, stdout) => {
        if (err) {
          resolve({ installed: true, version: undefined, authenticated: false })
          return
        }
        // 버전 출력이 있으면 설치+인증된 것으로 간주
        resolve({ installed: true, version: stdout.trim().split('\n')[0], authenticated: true })
      })
    })
  })
}

export async function runDoctor(): Promise<DoctorResult> {
  const [node, git, claude, codex, gemini] = await Promise.all([
    checkCommand('node', ['--version']),
    checkCommand('git', ['--version']),
    checkAgent('claude', ['--version']),
    checkAgent('codex', ['--version']),
    checkAgent('gemini', ['--version']),
  ])

  const agents = { claude, codex, gemini }
  const available = (Object.keys(agents) as Array<keyof typeof agents>).filter(
    (k) => agents[k].installed
  )

  const availableTemplates: TemplateName[] = ['auto']

  // quick: design(claude) + implement(codex)
  if (available.includes('claude') || available.includes('codex')) {
    availableTemplates.push('quick')
  }
  // review: implement(codex) + review(claude)
  if (available.includes('claude') && available.includes('codex')) {
    availableTemplates.push('review')
  }
  // docs: research(gemini) + docs(gemini)
  if (available.includes('gemini')) {
    availableTemplates.push('docs')
  }
  // full: 모든 에이전트 필요
  if (available.length >= 2) {
    availableTemplates.push('full')
  }

  return {
    node,
    git,
    claude,
    codex,
    gemini,
    availableTemplates,
  }
}
