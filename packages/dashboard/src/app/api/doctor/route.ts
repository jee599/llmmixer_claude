import { NextResponse } from 'next/server'
import { runDoctor } from '@llmmixer/core'

export const dynamic = 'force-dynamic'

export async function GET() {
  const result = await runDoctor()
  return NextResponse.json(result)
}
