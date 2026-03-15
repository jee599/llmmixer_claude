'use client'

import { useState } from 'react'

type AgentType = 'claude' | 'codex' | 'gemini'

interface PromptInputProps {
  onSubmit: (prompt: string, agentType: AgentType) => void
  disabled?: boolean
}

const AGENTS: { value: AgentType; label: string }[] = [
  { value: 'claude', label: 'Claude' },
  { value: 'codex', label: 'Codex' },
  { value: 'gemini', label: 'Gemini' },
]

export default function PromptInput({ onSubmit, disabled }: PromptInputProps) {
  const [prompt, setPrompt] = useState('')
  const [agentType, setAgentType] = useState<AgentType>('claude')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim() || disabled) return
    onSubmit(prompt.trim(), agentType)
    setPrompt('')
  }

  return (
    <form onSubmit={handleSubmit} className="border-t border-gray-800 p-4">
      <div className="flex gap-3">
        <div className="flex-1">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleSubmit(e)
              }
            }}
            placeholder="Enter your prompt... (Cmd+Enter to send)"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-gray-500"
            rows={2}
            disabled={disabled}
          />
        </div>
        <div className="flex flex-col gap-2">
          <select
            value={agentType}
            onChange={(e) => setAgentType(e.target.value as AgentType)}
            className="bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-gray-500"
          >
            {AGENTS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!prompt.trim() || disabled}
            className="px-4 py-2 bg-white text-black text-sm font-medium rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Run
          </button>
        </div>
      </div>
    </form>
  )
}
