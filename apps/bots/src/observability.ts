import * as Sentry from '@sentry/node';
import pino, { type Logger } from 'pino';

/**
 * Observability: Sentry error capture + a pino logger that ships to Loki when
 * configured. Both are opt-in via env, so local/dev runs need no setup.
 *
 *   SENTRY_DSN   enable Sentry
 *   LOKI_URL     ship logs to Grafana Loki (e.g. http://localhost:3100)
 */

let sentryReady = false;

export function initObservability(): void {
  const dsn = process.env.SENTRY_DSN;
  if (dsn) {
    Sentry.init({ dsn, tracesSampleRate: 0.1, environment: process.env.CLUSTER ?? 'devnet' });
    sentryReady = true;
  }
}

export function captureError(err: unknown, context?: Record<string, unknown>): void {
  if (sentryReady) {
    Sentry.captureException(err, context ? { extra: context } : undefined);
  }
}

/** Build the shared logger, adding a Loki transport when LOKI_URL is set. */
export function buildLogger(): Logger {
  const level = process.env.LOG_LEVEL ?? 'info';
  const lokiUrl = process.env.LOKI_URL;
  if (lokiUrl) {
    return pino({
      level,
      transport: {
        target: 'pino-loki',
        options: {
          host: lokiUrl,
          labels: { app: 'float-bots', cluster: process.env.CLUSTER ?? 'devnet' },
          batching: true,
          interval: 5,
        },
      },
    });
  }
  return pino({ level });
}
