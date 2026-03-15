'use client'

import { useState, useRef, useEffect } from 'react'

type AgentType = 'claude' | 'codex' | 'gemini'
type Mode = 'single' | 'workflow'
type TemplateName = 'auto' | 'full' | 'quick' | 'review' | 'docs'

interface PromptInputProps {
  mode: Mode
  template: TemplateName
  onModeChange: (mode: Mode) => void
  onTemplateChange: (template: TemplateName) => void
  onSubmit: (prompt: string, agentType: AgentType) => void
  disabled?: boolean
}

const AGENTS: { value: AgentType; label: string; desc: string }[] = [
  { value: 'claude', label: 'Claude', desc: 'Design & Review' },
  { value: 'codex', label: 'Codex', desc: 'Implementation' },
  { value: 'gemini', label: 'Gemini', desc: 'Research & Docs' },
]

const TEMPLATES: { value: TemplateName; label: string; desc: string }[] = [
  { value: 'auto', label: 'Auto', desc: 'LLM decides task breakdown' },
  { value: 'full', label: 'Full', desc: 'Research → Design → Implement → Review → Docs' },
  { value: 'quick', label: 'Quick', desc: 'Design → Implement' },
  { value: 'review', label: 'Review', desc: 'Implement → Review' },
  { value: 'docs', label: 'Docs', desc: 'Research → Docs' },
]

export default function PromptInput({
  mode,
  template,
  onModeChange,
  onTemplateChange,
  onSubmit,
  disabled,
}: PromptInputProps) {
  const [prompt, setPrompt] = useState('')
  const [agentType, setAgentType] = useState<AgentType>('claude')
  const [expanded, setExpanded] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // 외부 클릭 시 축소
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (!prompt.trim()) setExpanded(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [prompt])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim() || disabled) return
    onSubmit(prompt.trim(), agentType)
    setPrompt('')
    setExpanded(false)
  }

  const handleFocus = () => {
    setExpanded(true)
  }

  return (
    <div ref={containerRef} className="border-t border-gray-800">
      <form onSubmit={handleSubmit} className="p-4">
        {/* 펼쳐진 상태: 모드/템플릿 선택 */}
        {expanded && (
          <div className="mb-3 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
            {/* 모드 토글 */}
            <div className="flex bg-gray-900 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => onModeChange('single')}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  mode === 'single'
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                Single Agent
              </button>
              <button
                type="button"
                onClick={() => onModeChange('workflow')}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  mode === 'workflow'
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                Workflow
              </button>
            </div>

            {/* Single: 에이전트 선택 */}
            {mode === 'single' && (
              <div className="flex gap-1.5">
                {AGENTS.map((a) => (
                  <button
                    key={a.value}
                    type="button"
                    onClick={() => setAgentType(a.value)}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                      agentType === a.value
                        ? 'border-gray-500 bg-gray-800 text-white'
                        : 'border-gray-800 text-gray-500 hover:border-gray-700 hover:text-gray-300'
                    }`}
                    title={a.desc}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            )}

            {/* Workflow: 템플릿 선택 */}
            {mode === 'workflow' && (
              <div className="flex gap-1.5">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => onTemplateChange(t.value)}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                      template === t.value
                        ? 'border-gray-500 bg-gray-800 text-white'
                        : 'border-gray-800 text-gray-500 hover:border-gray-700 hover:text-gray-300'
                    }`}
                    title={t.desc}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 입력 영역 */}
        <div className="flex gap-3 items-end">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onFocus={handleFocus}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleSubmit(e)
                }
              }}
              placeholder={
                mode === 'workflow'
                  ? 'Describe what you want to build...'
                  : 'Enter your prompt...'
              }
              className={`w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-gray-500 transition-all duration-200 ${
                expanded ? 'min-h-[120px]' : 'min-h-[44px]'
              }`}
              rows={expanded ? 5 : 1}
              disabled={disabled}
            />
            {/* 우측 하단 힌트 */}
            {expanded && (
              <span className="absolute bottom-2 right-3 text-[10px] text-gray-600">
                ⌘+Enter to send
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={!prompt.trim() || disabled}
            className="px-5 py-3 bg-white text-black text-sm font-medium rounded-lg hover:bg-gray-200 disabled:opacity-20 disabled:cursor-not-allowed transition-colors shrink-0 flex items-center gap-2"
          >
            {disabled && (
              <span className="inline-block w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            )}
            {disabled ? 'Running...' : mode === 'workflow' ? 'Run Workflow' : 'Run'}
          </button>
        </div>

        {/* 축소 상태에서 현재 모드 표시 */}
        {!expanded && (
          <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-600">
            <span>{mode === 'workflow' ? `Workflow · ${template}` : `Single · ${agentType}`}</span>
            <span>·</span>
            <span>Click to expand options</span>
          </div>
        )}
      </form>
    </div>
  )
}
