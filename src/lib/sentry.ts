import * as Sentry from '@sentry/react'

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  enabled:
    !import.meta.env.DEV &&
    (import.meta.env.MODE === 'production' || import.meta.env.MODE === 'qa'),
  integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
  tracesSampleRate: import.meta.env.MODE === 'production' ? 0.2 : 1.0,
  tracePropagationTargets: [/^\//],
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
})
