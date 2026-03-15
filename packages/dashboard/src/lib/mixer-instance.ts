import { SessionManager, WorkflowEngine } from '@llmmixer/core'
import { generateToken, loadToken } from '@llmmixer/core'

const PROJECT_PATH = process.cwd()

let sessionManager: SessionManager | null = null
let workflowEngine: WorkflowEngine | null = null
let sessionToken: string | null = null

export function getSessionManager(): SessionManager {
  if (!sessionManager) {
    sessionManager = new SessionManager(PROJECT_PATH)
  }
  return sessionManager
}

export function getWorkflowEngine(): WorkflowEngine {
  if (!workflowEngine) {
    workflowEngine = new WorkflowEngine(PROJECT_PATH, getSessionManager())
  }
  return workflowEngine
}

export function getOrCreateToken(): string {
  if (!sessionToken) {
    sessionToken = loadToken(PROJECT_PATH)
    if (!sessionToken) {
      sessionToken = generateToken(PROJECT_PATH)
    }
  }
  return sessionToken
}

export function getProjectPath(): string {
  return PROJECT_PATH
}
