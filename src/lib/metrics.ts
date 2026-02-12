import * as Sentry from '@sentry/react'

const PREFIX = 'draft_room'

type Attributes = Record<string, string | number | boolean>

function prefixed(name: string): string {
  return `${PREFIX}.${name}`
}

export function trackCount(name: string, attributes?: Attributes): void {
  Sentry.metrics.count(prefixed(name), 1, { attributes })
}

export function trackDistribution(
  name: string,
  value: number,
  unit: string,
  attributes?: Attributes
): void {
  Sentry.metrics.distribution(prefixed(name), value, { attributes, unit })
}

export function trackGauge(
  name: string,
  value: number,
  unit?: string,
  attributes?: Attributes
): void {
  Sentry.metrics.gauge(prefixed(name), value, { attributes, unit })
}

/**
 * Returns a function that, when called, returns the elapsed time in milliseconds.
 */
export function startTimer(): () => number {
  const start = performance.now()
  return () => Math.round(performance.now() - start)
}
