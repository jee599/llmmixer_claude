'use client'

import { useEffect, useState, useCallback } from 'react'

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

function CheckItem({ label, check }: { label: string; check: DoctorCheck }) {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600">
        Loading...
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8 overflow-y-auto h-full">
      {/* Doctor */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Environment</h2>
        <div className="bg-gray-900 rounded-lg p-4">
          {doctor && (
            <>
              <CheckItem label="Node.js" check={doctor.node} />
              <CheckItem label="Git" check={doctor.git} />
              <CheckItem label="Claude Code" check={doctor.claude} />
              <CheckItem label="Codex CLI" check={doctor.codex} />
              <CheckItem label="Gemini CLI" check={doctor.gemini} />
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
