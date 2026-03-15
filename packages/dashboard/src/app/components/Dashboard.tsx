'use client'

import { useState, useCallback } from 'react'
import type { AgentType, TemplateName } from '@llmmixer/core'
import { useSSE } from '../hooks/useSSE'
import LogTab from './LogTab'
import FlowTab from './FlowTab'
import ResultsTab from './ResultsTab'
import SetupTab from './SetupTab'
import PromptInput from './PromptInput'

type TabName = 'log' | 'flow' | 'results' | 'setup'

const TABS: { name: TabName; label: string }[] = [
  { name: 'log', label: 'Log' },
  { name: 'flow', label: 'Flow' },
  { name: 'results', label: 'Results' },
  { name: 'setup', label: 'Setup' },
]

function generateTaskId(agentType: string): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 5)
  return `${agentType}-${ts}-${rand}`
}

function authHeaders(token: string | null): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabName>('log')
  const [isRunning, setIsRunning] = useState(false)
  const [mode, setMode] = useState<'single' | 'workflow'>('workflow')
  const [template, setTemplate] = useState<TemplateName>('auto')
  const [autoApprove, setAutoApprove] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ type: 'info' | 'error'; text: string } | null>(null)

  const { logs, sessions, waitingMap, workflow, setWorkflow, clearWaiting, clearAll, token } = useSSE(autoApprove)

  const handleApprove = useCallback(async (taskId: string, input: string) => {
    const res = await fetch('/api/approve', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ taskId, input }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Request failed' }))
      setStatusMessage({ type: 'error', text: data.error ?? `Approve failed (${res.status})` })
      return
    }
    clearWaiting(taskId)
  }, [clearWaiting, token])

  const handleKill = useCallback(async (taskId: string) => {
    const res = await fetch(`/api/sessions?taskId=${taskId}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Request failed' }))
      setStatusMessage({ type: 'error', text: data.error ?? `Kill failed (${res.status})` })
    }
  }, [token])

  const handleSubmit = useCallback(async (prompt: string, agentType: AgentType) => {
    setIsRunning(true)
    setStatusMessage(null)

    if (mode === 'workflow') {
      setActiveTab('flow')
      setStatusMessage({ type: 'info', text: 'Decomposing tasks with Codex...' })

      try {
        const res = await fetch('/api/workflow', {
          method: 'POST',
          headers: authHeaders(token),
          body: JSON.stringify({ prompt, template, autoApprove }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
          setStatusMessage({ type: 'error', text: data.error ?? `Workflow failed (${res.status})` })
          setIsRunning(false)
          return
        }
        const data = await res.json()
        if (data.error) {
          setStatusMessage({ type: 'error', text: data.error })
        } else if (data.workflow) {
          setWorkflow(data.workflow)
          const taskCount = data.workflow.tasks?.length ?? 0
          setStatusMessage({ type: 'info', text: `${taskCount} tasks created. Running...` })
          setTimeout(() => setStatusMessage(null), 5000)
        }
      } catch (err) {
        setStatusMessage({ type: 'error', text: `Failed: ${err instanceof Error ? err.message : 'Unknown error'}` })
      }
    } else {
      setStatusMessage({ type: 'info', text: `Starting ${agentType} session...` })
      const taskId = generateTaskId(agentType)
      try {
        const res = await fetch('/api/sessions', {
          method: 'POST',
          headers: authHeaders(token),
          body: JSON.stringify({ taskId, agentType, prompt, autoApprove }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
          setStatusMessage({ type: 'error', text: data.error ?? `Session start failed (${res.status})` })
          setIsRunning(false)
          return
        }
        const data = await res.json()
        if (data.error) {
          setStatusMessage({ type: 'error', text: data.error })
        } else {
          setStatusMessage({ type: 'info', text: `Session ${taskId} started` })
          setTimeout(() => setStatusMessage(null), 3000)
        }
      } catch (err) {
        setStatusMessage({ type: 'error', text: `Failed: ${err instanceof Error ? err.message : 'Unknown error'}` })
      }
    }

    setIsRunning(false)
  }, [mode, template, autoApprove, setWorkflow, token])

  const handleNuke = useCallback(async () => {
    if (!confirm('Kill all sessions and clean up?')) return
    const res = await fetch('/api/nuke', {
      method: 'POST',
      headers: authHeaders(token),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Request failed' }))
      setStatusMessage({ type: 'error', text: data.error ?? `Nuke failed (${res.status})` })
      return
    }
    clearAll()
    setStatusMessage(null)
  }, [clearAll, token])

  // 활성 세션 수
  const runningSessions = sessions.filter((s) => s.status === 'running' || s.status === 'waiting').length

  return (
    <div className="flex flex-col h-screen">
      {/* 헤더 */}
      <header className="flex items-center justify-between border-b border-gray-800 px-4 py-2">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold tracking-tight">LLMMixer</h1>
          <nav className="flex gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.name}
                onClick={() => setActiveTab(tab.name)}
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  activeTab === tab.name
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900'
                }`}
              >
                {tab.label}
                {tab.name === 'log' && runningSessions > 0 && (
                  <span className="ml-1.5 inline-block w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
                )}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoApprove}
              onChange={(e) => setAutoApprove(e.target.checked)}
              className="rounded border-gray-600"
            />
            Auto-approve
          </label>
          <button
            onClick={handleNuke}
            className="px-3 py-1 text-xs text-red-400 border border-red-900 rounded hover:bg-red-950 transition-colors"
          >
            Nuke
          </button>
        </div>
      </header>

      {/* 상태 메시지 바 */}
      {statusMessage && (
        <div className={`px-4 py-2 text-sm flex items-center gap-2 ${
          statusMessage.type === 'error'
            ? 'bg-red-950/50 text-red-300 border-b border-red-900/50'
            : 'bg-blue-950/50 text-blue-300 border-b border-blue-900/50'
        }`}>
          {statusMessage.type === 'info' && isRunning && (
            <span className="inline-block w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          )}
          {statusMessage.type === 'error' && <span>&#10007;</span>}
          {statusMessage.text}
          <button
            onClick={() => setStatusMessage(null)}
            className="ml-auto text-xs opacity-50 hover:opacity-100"
          >
            &#10005;
          </button>
        </div>
      )}

      {/* 탭 콘텐츠 */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'log' && (
          <LogTab
            logs={logs}
            sessions={sessions}
            waitingMap={waitingMap}
            onApprove={handleApprove}
            onKill={handleKill}
          />
        )}
        {activeTab === 'flow' && (
          <FlowTab
            workflow={workflow}
            waitingMap={waitingMap}
            onNodeClick={() => setActiveTab('log')}
            onApprove={handleApprove}
          />
        )}
        {activeTab === 'results' && (
          <ResultsTab workflow={workflow} />
        )}
        {activeTab === 'setup' && (
          <SetupTab />
        )}
      </div>

      {/* 프롬프트 입력 */}
      <PromptInput
        mode={mode}
        template={template}
        onModeChange={setMode}
        onTemplateChange={setTemplate}
        onSubmit={handleSubmit}
        disabled={isRunning}
      />
    </div>
  )
}
