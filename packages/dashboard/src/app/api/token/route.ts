import { NextResponse } from 'next/server'
import { getOrCreateToken } from '@/lib/mixer-instance'

export async function GET() {
  return NextResponse.json({ token: getOrCreateToken() })
}
