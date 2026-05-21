import { readFileSync } from 'node:fs'
import { NextResponse } from 'next/server'

const SCREENSHOT_PATH = '/app/data/error-screenshot.png'

export const dynamic = 'force-dynamic'

export function GET(): NextResponse {
  try {
    const buf = readFileSync(SCREENSHOT_PATH)
    return new NextResponse(buf, {
      status: 200,
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
    })
  } catch {
    return new NextResponse('No screenshot found. Trigger a publish attempt first.', {
      status: 404,
      headers: { 'Content-Type': 'text/plain' },
    })
  }
}
