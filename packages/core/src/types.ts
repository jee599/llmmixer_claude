export type TaskType = 'design' | 'implement' | 'review' | 'scaffold' | 'research' | 'docs'

export type AgentType = 'claude' | 'codex' | 'gemini'

export type TaskStatus = 'pending' | 'running' | 'waiting' | 'complete' | 'error'

export type WorkflowStatus = 'planning' | 'running' | 'complete' | 'error'

export type TemplateName = 'full' | 'quick' | 'review' | 'docs' | 'auto' | 'custom'

export interface Task {
  id: string
  type: TaskType
  prompt: string
  dependsOn: string[]
  assignedAgent: AgentType
  status: TaskStatus
  output?: string
  error?: string
  startedAt?: number
  completedAt?: number
  worktreePath?: string
}

export interface Workflow {
  id: string
  prompt: string
  template: TemplateName
  tasks: Task[]
  status: WorkflowStatus
  createdAt: number
  completedAt?: number
}

export interface MixerConfig {
  decomposer: AgentType
  maxAgents: number
  timeout: number
  autoApprove: boolean
}

export interface RoutingRules {
  design: AgentType
  implement: AgentType
  review: AgentType
  scaffold: AgentType
  research: AgentType
  docs: AgentType
}

export interface DoctorCheck {
  installed: boolean
  version?: string
  authenticated?: boolean
}

export interface DoctorResult {
  node: DoctorCheck
  git: DoctorCheck
  claude: DoctorCheck
  codex: DoctorCheck
  gemini: DoctorCheck
  availableTemplates: TemplateName[]
}

export interface SpawnOptions {
  worktreePath: string
  autoApprove: boolean
  timeout: number
}

export type SSEEvent =
  | { type: 'output'; taskId: string; data: string }
  | { type: 'status'; taskId: string; status: TaskStatus; agentType?: AgentType }
  | { type: 'waiting'; taskId: string; pattern: string }
  | { type: 'workflow'; workflow: Workflow }
  | { type: 'error'; taskId: string; message: string }

export interface SessionInfo {
  taskId: string
  agentType: AgentType
  status: TaskStatus
  startedAt: number
  pid?: number
}

export interface TemplateDefinition {
  name: TemplateName
  description: string
  tasks: Array<{
    id: string
    type: TaskType
    promptTemplate: string
    dependsOn: string[]
  }>
}

export interface MixerState {
  activeWorkflow: Workflow | null
  sessions: SessionInfo[]
  config: MixerConfig
}
