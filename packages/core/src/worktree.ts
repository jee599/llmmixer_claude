import { execFileSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'

function git(args: string[], cwd: string): string {
  return execFileSync('git', args, { cwd, encoding: 'utf-8', timeout: 30000 }).trim()
}

export function createWorktree(projectPath: string, taskId: string): string {
  const agentsDir = join(projectPath, '.mixer', 'agents')
  const worktreePath = join(agentsDir, taskId)
  const branchName = `mixer/${taskId}`

  if (existsSync(worktreePath)) {
    return worktreePath
  }

  try {
    git(['worktree', 'add', worktreePath, '-b', branchName], projectPath)
  } catch {
    // 브랜치가 이미 존재하는 경우
    try {
      git(['worktree', 'add', worktreePath, branchName], projectPath)
    } catch (err) {
      throw new Error(`Failed to create worktree: ${err instanceof Error ? err.message : 'unknown'}`)
    }
  }

  return worktreePath
}

export function removeWorktree(projectPath: string, taskId: string): void {
  const worktreePath = join(projectPath, '.mixer', 'agents', taskId)
  const branchName = `mixer/${taskId}`

  try {
    git(['worktree', 'remove', worktreePath, '--force'], projectPath)
  } catch {
    // worktree 직접 삭제
    if (existsSync(worktreePath)) {
      rmSync(worktreePath, { recursive: true, force: true })
    }
    try {
      git(['worktree', 'prune'], projectPath)
    } catch {
      // ignore
    }
  }

  // 브랜치 정리
  try {
    git(['branch', '-D', branchName], projectPath)
  } catch {
    // ignore
  }
}

export function mergeWorktree(
  projectPath: string,
  taskId: string,
  targetBranch?: string
): { success: boolean; conflicts?: string[]; message: string } {
  const branchName = `mixer/${taskId}`

  if (!targetBranch) {
    try {
      targetBranch = git(['branch', '--show-current'], projectPath)
    } catch {
      targetBranch = 'main'
    }
  }

  // dry-run으로 충돌 확인
  try {
    git(['merge', '--no-commit', '--no-ff', branchName], projectPath)
    git(['merge', '--abort'], projectPath)
  } catch {
    try {
      git(['merge', '--abort'], projectPath)
    } catch {
      // ignore
    }

    // 충돌 파일 목록
    try {
      const conflicts = git(['diff', '--name-only', '--diff-filter=U'], projectPath)
      return {
        success: false,
        conflicts: conflicts.split('\n').filter(Boolean),
        message: 'Merge conflicts detected. Please resolve manually.',
      }
    } catch {
      return {
        success: false,
        message: 'Merge failed. Check for conflicts.',
      }
    }
  }

  // 실제 머지
  try {
    const result = git(['merge', branchName, '--no-ff', '-m', `Merge mixer/${taskId}`], projectPath)
    return { success: true, message: result || 'Merged successfully' }
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Merge failed',
    }
  }
}

export function nukeWorktrees(projectPath: string): void {
  const agentsDir = join(projectPath, '.mixer', 'agents')

  if (existsSync(agentsDir)) {
    rmSync(agentsDir, { recursive: true, force: true })
  }

  try {
    git(['worktree', 'prune'], projectPath)
  } catch {
    // ignore
  }

  // mixer/* 브랜치 정리
  try {
    const branches = git(['branch', '--list', 'mixer/*'], projectPath)
    for (const branch of branches.split('\n').filter(Boolean)) {
      try {
        git(['branch', '-D', branch.trim()], projectPath)
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
}
