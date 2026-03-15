import { SessionManager, WorkflowEngine } from '@llmmixer/core'
import { generateToken, loadToken } from '@llmmixer/core'

const PROJECT_PATH = process.cwd()

// Next.js dev 모드에서 핫 리로드 시 인스턴스 유지
const globalForMixer = globalThis as typeof globalThis & {
  __mixerSessionManager?: SessionManager
  __mixerWorkflowEngine?: WorkflowEngine
  __mixerToken?: string
}

export function getSessionManager(): SessionManager {
  if (!globalForMixer.__mixerSessionManager) {
    globalForMixer.__mixerSessionManager = new SessionManager(PROJECT_PATH)
  }
  return globalForMixer.__mixerSessionManager
}

export function getWorkflowEngine(): WorkflowEngine {
  if (!globalForMixer.__mixerWorkflowEngine) {
    globalForMixer.__mixerWorkflowEngine = new WorkflowEngine(PROJECT_PATH, getSessionManager())
  }
  return globalForMixer.__mixerWorkflowEngine
}

export function getOrCreateToken(): string {
  if (!globalForMixer.__mixerToken) {
    globalForMixer.__mixerToken = loadToken(PROJECT_PATH) ?? generateToken(PROJECT_PATH)
  }
  return globalForMixer.__mixerToken
}

export function getProjectPath(): string {
  return PROJECT_PATH
}
