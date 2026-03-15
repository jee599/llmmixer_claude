import { execSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

function safeExec(cmd: string, cwd: string): string {
  try {
    return execSync(cmd, { cwd, timeout: 5000, encoding: 'utf-8' }).trim()
  } catch {
    return ''
  }
}

function safeRead(filePath: string, maxLines = 100): string {
  try {
    const content = readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')
    return lines.slice(0, maxLines).join('\n')
  } catch {
    return ''
  }
}

function collectFileTree(dir: string, depth = 0, maxFiles = 50): string[] {
  if (depth > 3) return []
  const results: string[] = []

  try {
    const entries = readdirSync(dir)
    for (const entry of entries) {
      if (results.length >= maxFiles) break
      if (entry === 'node_modules' || entry === '.git' || entry === '.next' || entry === '.mixer' || entry === 'dist') continue

      const fullPath = join(dir, entry)
      try {
        const stat = statSync(fullPath)
        if (stat.isDirectory()) {
          results.push(`${entry}/`)
          results.push(...collectFileTree(fullPath, depth + 1, maxFiles - results.length).map((f) => `  ${entry}/${f}`))
        } else {
          results.push(entry)
        }
      } catch {
        // skip inaccessible
      }
    }
  } catch {
    // skip
  }

  return results
}

export function collectContext(projectPath: string): string {
  const parts: string[] = []

  const branch = safeExec('git branch --show-current', projectPath)
  if (branch) parts.push(`Current branch: ${branch}`)

  const log = safeExec('git log --oneline -5', projectPath)
  if (log) parts.push(`Recent commits:\n${log}`)

  const diff = safeExec('git diff --name-only', projectPath)
  if (diff) parts.push(`Changed files:\n${diff}`)

  const readme = safeRead(join(projectPath, 'README.md'))
  if (readme) parts.push(`README.md:\n${readme}`)

  const pkg = safeRead(join(projectPath, 'package.json'), 30)
  if (pkg) parts.push(`package.json:\n${pkg}`)

  const tree = collectFileTree(projectPath)
  if (tree.length > 0) parts.push(`Project structure:\n${tree.join('\n')}`)

  return parts.join('\n\n---\n\n')
}
