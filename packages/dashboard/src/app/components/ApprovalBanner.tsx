'use client'

import { useState } from 'react'

interface ApprovalBannerProps {
  taskId: string
  pattern: string
  onApprove: (taskId: string, input: string) => void
}

export default function ApprovalBanner({ taskId, pattern, onApprove }: ApprovalBannerProps) {
  const [input, setInput] = useState('y')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onApprove(taskId, input)
    setInput('y')
  }

  return (
    <div className="bg-yellow-900/50 border border-yellow-600 rounded-lg px-4 py-3 mb-3">
      <div className="flex items-start gap-3">
        <span className="text-yellow-400 text-lg mt-0.5">⏳</span>
        <div className="flex-1 min-w-0">
          <p className="text-yellow-200 text-sm font-medium mb-1">Waiting for approval</p>
          <p className="text-yellow-100/70 text-xs font-mono truncate mb-2">{pattern}</p>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-white font-mono focus:outline-none focus:border-yellow-500"
              placeholder="Response..."
            />
            <button
              type="submit"
              className="px-3 py-1 bg-yellow-600 hover:bg-yellow-500 text-black text-sm font-medium rounded transition-colors"
            >
              Send
            </button>
            <button
              type="button"
              onClick={() => onApprove(taskId, 'y')}
              className="px-3 py-1 bg-green-700 hover:bg-green-600 text-white text-sm rounded transition-colors"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => onApprove(taskId, 'n')}
              className="px-3 py-1 bg-red-700 hover:bg-red-600 text-white text-sm rounded transition-colors"
            >
              Deny
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
