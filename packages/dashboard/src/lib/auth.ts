import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateToken } from '@/lib/mixer-instance'

/**
 * Validate bearer token from Authorization header.
 * Returns NextResponse with 401 if invalid, null if valid.
 */
export function requireAuth(req: NextRequest): NextResponse | null {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (token !== getOrCreateToken()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null
}
