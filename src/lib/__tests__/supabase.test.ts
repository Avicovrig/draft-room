import { describe, it, expect } from 'vitest'
import { parseEdgeFunctionError } from '../edgeFunctionUtils'

describe('parseEdgeFunctionError', () => {
  it('extracts error from JSON response body', async () => {
    const response = new Response(JSON.stringify({ error: 'Pick already made' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    })
    const result = await parseEdgeFunctionError(response, 'fallback')
    expect(result).toBe('Pick already made')
  })

  it('returns fallback when response is undefined', async () => {
    const result = await parseEdgeFunctionError(undefined, 'fallback message')
    expect(result).toBe('fallback message')
  })

  it('returns fallback when response body is not JSON', async () => {
    const response = new Response('Internal Server Error', { status: 500 })
    const result = await parseEdgeFunctionError(response, 'fallback')
    expect(result).toBe('fallback')
  })

  it('returns fallback when JSON has no error field', async () => {
    const response = new Response(JSON.stringify({ success: false }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
    const result = await parseEdgeFunctionError(response, 'fallback')
    expect(result).toBe('fallback')
  })

  it('returns fallback when response body is already consumed', async () => {
    const response = new Response(JSON.stringify({ error: 'test' }), { status: 400 })
    await response.json() // consume the body
    const result = await parseEdgeFunctionError(response, 'fallback')
    expect(result).toBe('fallback')
  })
})
