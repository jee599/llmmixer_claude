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

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabName>('log')
  const [isRunning, setIsRunning] = useState(false)
  const [mode, setMode] = useState<'single' | 'workflow'>('single')
  const [template, setTemplate] = useState<TemplateName>('quick')
  const [autoApprove, setAutoApprove] = useState(false)

  const { logs, sessions, waitingMap, workflow, setWorkflow, clearWaiting, clearAll } = useSSE(autoApprove)

  const handleApprove = useCallback(async (taskId: string, input: string) => {
    await fetch('/api/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, input }),
    })
    clearWaiting(taskId)
  }, [clearWaiting])

  const handleKill = useCallback(async (taskId: string) => {
    await fetch(`/api/sessions?taskId=${taskId}`, { method: 'DELETE' })
  }, [])

  const handleSingleSubmit = useCallback(async (prompt: string, agentType: AgentType) => {
    setIsRunning(true)
    const taskId = generateTaskId(agentType)
    try {
      await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, agentType, prompt, autoApprove }),
      })
    } catch (err) {
      console.error('Failed to start session:', err)
    } finally {
      setIsRunning(false)
    }
  }, [autoApprove])

  const handleWorkflowSubmit = useCallback(async (prompt: string, _agentType?: AgentType) => {
    setIsRunning(true)
    setActiveTab('flow')
    try {
      const res = await fetch('/api/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, template, autoApprove }),
      })
      const data = await res.json()
      if (data.workflow) setWorkflow(data.workflow)
    } catch (err) {
      console.error('Failed to start workflow:', err)
    } finally {
      setIsRunning(false)
    }
  }, [template, autoApprove, setWorkflow])

  const handleNuke = useCallback(async () => {
    if (!confirm('Kill all sessions and clean up?')) return
    await fetch('/api/nuke', { method: 'POST' })
    clearAll()
  }, [clearAll])

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
          <div className="flex items-center gap-2 text-xs">
            <label className="flex items-center gap-1.5 text-gray-400 cursor-pointer">
              <input
                type="radio"
                name="mode"
                checked={mode === 'single'}
                onChange={() => setMode('single')}
              />
              Single
            </label>
            <label className="flex items-center gap-1.5 text-gray-400 cursor-pointer">
              <input
                type="radio"
                name="mode"
                checked={mode === 'workflow'}
                onChange={() => setMode('workflow')}
              />
              Workflow
            </label>
            {mode === 'workflow' && (
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value as TemplateName)}
                className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300"
              >
                <option value="auto">Auto</option>
                <option value="full">Full</option>
                <option value="quick">Quick</option>
                <option value="review">Review</option>
                <option value="docs">Docs</option>
              </select>
            )}
          </div>
          <button
            onClick={handleNuke}
            className="px-3 py-1 text-xs text-red-400 border border-red-900 rounded hover:bg-red-950 transition-colors"
          >
            Nuke
          </button>
        </div>
      </header>

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
            onNodeClick={() => setActiveTab('log')}
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
        onSubmit={mode === 'workflow' ? handleWorkflowSubmit : handleSingleSubmit}
        disabled={isRunning}
      />
    </div>
  )
}
