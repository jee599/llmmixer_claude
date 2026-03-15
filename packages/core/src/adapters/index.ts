import type { AgentType } from '../types.js'
import { AgentAdapter } from './base.js'
import { ClaudeAdapter } from './claude.js'
import { CodexAdapter } from './codex.js'
import { GeminiAdapter } from './gemini.js'

export { AgentAdapter } from './base.js'
export { ClaudeAdapter } from './claude.js'
export { CodexAdapter } from './codex.js'
export { GeminiAdapter } from './gemini.js'

export function createAdapter(agentType: AgentType): AgentAdapter {
  switch (agentType) {
    case 'claude': return new ClaudeAdapter()
    case 'codex': return new CodexAdapter()
    case 'gemini': return new GeminiAdapter()
  }
}
