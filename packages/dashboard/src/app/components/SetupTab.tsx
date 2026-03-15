'use client'

import { useEffect, useState, useCallback, useRef } from 'react'

type AgentType = 'claude' | 'codex' | 'gemini'

interface DoctorCheck {
  installed: boolean
  version?: string
  authenticated?: boolean
}

interface DoctorResult {
  node: DoctorCheck
  git: DoctorCheck
  claude: DoctorCheck
  codex: DoctorCheck
  gemini: DoctorCheck
  availableTemplates: string[]
}

interface Config {
  decomposer: AgentType
  maxAgents: number
  timeout: number
  autoApprove: boolean
}

interface Routing {
  design: AgentType
  review: AgentType
  implement: AgentType
  scaffold: AgentType
  research: AgentType
  docs: AgentType
}

const TASK_TYPES = ['design', 'review', 'implement', 'scaffold', 'research', 'docs'] as const
const AGENTS: AgentType[] = ['claude', 'codex', 'gemini']

function CheckItem({
  label,
  check,
  agentKey,
  onAuth,
}: {
  label: string
  check: DoctorCheck
  agentKey?: AgentType
  onAuth?: (agent: AgentType) => void
}) {
  const icon = check.installed ? '✓' : '✗'
  const color = check.installed ? 'text-green-400' : 'text-red-400'

  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-800/50">
      <div className="flex items-center gap-2">
        <span className={`font-mono ${color}`}>{icon}</span>
        <span className="text-sm text-gray-200">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {check.version && (
          <span className="text-xs text-gray-500 font-mono">{check.version}</span>
        )}
        {check.authenticated !== undefined && (
          <span className={`text-xs ${check.authenticated ? 'text-green-500' : 'text-yellow-500'}`}>
            {check.authenticated ? 'authenticated' : 'not authenticated'}
          </span>
        )}
        {agentKey && check.installed && onAuth && (
          <button
            onClick={() => onAuth(agentKey)}
            className="px-2 py-0.5 text-[10px] bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded transition-colors"
          >
            Auth
          </button>
        )}
      </div>
    </div>
  )
}

function AuthTerminal({ agent, onClose }: { agent: AgentType; onClose: () => void }) {
  const [lines, setLines] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [started, setStarted] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // 터미널 시작
  useEffect(() => {
    fetch('/api/auth-terminal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent }),
    }).then(() => {
      setStarted(true)

      const es = new EventSource(`/api/auth-terminal?agent=${agent}`)
      es.onmessage = (e) => {
        const event = JSON.parse(e.data)
        if (event.type === 'exit') {
          es.close()
          return
        }
        if (event.data) {
          setLines((prev) => {
            const next = [...prev, event.data]
            return next.length > 300 ? next.slice(-300) : next
          })
        }
      }
      return () => es.close()
    })
  }, [agent])

  useEffect(() => {
    containerRef.current?.scrollTo(0, containerRef.current.scrollHeight)
  }, [lines])

  const handleSend = async (text: string) => {
    await fetch('/api/auth-terminal', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent, input: text }),
    })
    setInput('')
  }

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700">
        <span className="text-xs text-gray-300 font-medium">
          {agent} — authentication terminal
        </span>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xs">✕</button>
      </div>

      <div
        ref={containerRef}
        className="h-64 overflow-y-auto px-3 py-2 font-mono text-xs text-gray-300 whitespace-pre-wrap"
      >
        {!started && <span className="text-gray-600">Starting {agent}...</span>}
        {lines.map((line, i) => (
          <span key={i}>{line}</span>
        ))}
      </div>

      <div className="border-t border-gray-700 p-2 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend(input + '\r')
          }}
          placeholder="Type and press Enter..."
          className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-gray-500"
        />
        <button
          onClick={() => handleSend('\r')}
          className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded"
        >
          Enter
        </button>
        <button
          onClick={() => handleSend('y\r')}
          className="px-2 py-1 text-xs bg-green-800 hover:bg-green-700 text-green-200 rounded"
        >
          Yes
        </button>
      </div>
    </div>
  )
}

export default function SetupTab() {
  const [doctor, setDoctor] = useState<DoctorResult | null>(null)
  const [config, setConfig] = useState<Config | null>(null)
  const [routing, setRouting] = useState<Routing | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [authAgent, setAuthAgent] = useState<AgentType | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/doctor').then((r) => r.json()),
      fetch('/api/config').then((r) => r.json()),
    ]).then(([doctorData, configData]) => {
      setDoctor(doctorData)
      setConfig(configData.config)
      setRouting(configData.routing)
      setLoading(false)
    })
  }, [])

  const handleSave = useCallback(async () => {
    if (!config || !routing) return
    setSaving(true)
    await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, routing }),
    })
    setSaving(false)
  }, [config, routing])

  const refreshDoctor = useCallback(async () => {
    const data = await fetch('/api/doctor').then((r) => r.json())
    setDoctor(data)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600">Loading...</div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8 overflow-y-auto h-full">
      {/* Doctor */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Environment</h2>
          <button
            onClick={refreshDoctor}
            className="px-2 py-1 text-xs text-gray-400 hover:text-gray-200 border border-gray-700 rounded"
          >
            Refresh
          </button>
        </div>
        <div className="bg-gray-900 rounded-lg p-4">
          {doctor && (
            <>
              <CheckItem label="Node.js" check={doctor.node} />
              <CheckItem label="Git" check={doctor.git} />
              <CheckItem label="Claude Code" check={doctor.claude} agentKey="claude" onAuth={setAuthAgent} />
              <CheckItem label="Codex CLI" check={doctor.codex} agentKey="codex" onAuth={setAuthAgent} />
              <CheckItem label="Gemini CLI" check={doctor.gemini} agentKey="gemini" onAuth={setAuthAgent} />
              <div className="mt-3 pt-3 border-t border-gray-800">
                <p className="text-xs text-gray-500">
                  Available templates:{' '}
                  {doctor.availableTemplates.map((t) => (
                    <span key={t} className="inline-block px-1.5 py-0.5 bg-gray-800 rounded text-gray-300 mr-1">
                      {t}
                    </span>
                  ))}
                </p>
              </div>
            </>
          )}
        </div>
      </section>

      {/* 인증 터미널 */}
      {authAgent && (
        <section>
          <AuthTerminal
            agent={authAgent}
            onClose={() => {
              setAuthAgent(null)
              refreshDoctor()
            }}
          />
        </section>
      )}

      {/* Config */}
      {config && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Configuration</h2>
          <div className="bg-gray-900 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-300">Decomposer LLM</label>
              <select
                value={config.decomposer}
                onChange={(e) => setConfig({ ...config, decomposer: e.target.value as AgentType })}
                className="bg-gray-800 border border-gray-700 rounded px-3 py-1 text-sm text-white"
              >
                {AGENTS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-300">Max concurrent agents</label>
              <input
                type="number"
                min={1}
                max={10}
                value={config.maxAgents}
                onChange={(e) => setConfig({ ...config, maxAgents: parseInt(e.target.value) || 6 })}
                className="bg-gray-800 border border-gray-700 rounded px-3 py-1 text-sm text-white w-20 text-center"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-300">Timeout (seconds)</label>
              <input
                type="number"
                min={30}
                max={3600}
                value={config.timeout}
                onChange={(e) => setConfig({ ...config, timeout: parseInt(e.target.value) || 300 })}
                className="bg-gray-800 border border-gray-700 rounded px-3 py-1 text-sm text-white w-20 text-center"
              />
            </div>
          </div>
        </section>
      )}

      {/* Routing */}
      {routing && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Routing Rules</h2>
          <div className="bg-gray-900 rounded-lg p-4 space-y-3">
            {TASK_TYPES.map((type) => (
              <div key={type} className="flex items-center justify-between">
                <span className="text-sm text-gray-300 font-mono">{type}</span>
                <select
                  value={routing[type]}
                  onChange={(e) => setRouting({ ...routing, [type]: e.target.value as AgentType })}
                  className="bg-gray-800 border border-gray-700 rounded px-3 py-1 text-sm text-white"
                >
                  {AGENTS.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Save */}
      <div className="flex justify-end gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-white text-black text-sm font-medium rounded hover:bg-gray-200 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>
    </div>
  )
}
