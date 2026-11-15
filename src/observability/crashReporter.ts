import * as Crypto from 'expo-crypto';
import * as Updates from 'expo-updates';

export interface CrashReportContext {
  mode: string;
  uid?: string | null;
  componentStack?: string | null;
}

export interface ScrubbedCrashPayload {
  message: string;
  mode: string;
  appVersion: string;
  runtimeVersion: string;
  updateId: string | null;
  uidHash: string | null;
  stackPreview?: string;
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const BEARER_RE = /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi;
const JWT_RE = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const QUERY_SECRET_RE = /([?&](?:token|key|secret|password|prompt|imagePrompt)=)[^&\s]+/gi;

/**
 * Redacts emails, OAuth/JWT tokens, and free-form query values before telemetry logging.
 */
export function scrubPii(input: string): string {
  return input
    .replace(EMAIL_RE, '[redacted-email]')
    .replace(BEARER_RE, 'Bearer [redacted]')
    .replace(JWT_RE, '[redacted-jwt]')
    .replace(QUERY_SECRET_RE, '$1[redacted]');
}

/**
 * Produces a short non-reversible identifier from a Firebase UID.
 */
export async function hashUserId(uid: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    uid,
  );
  return digest.slice(0, 16);
}

/**
 * Families-policy-safe crash reporter.
 * Defaults to local PII-scrubbed logging with zero third-party ad/profiling SDKs.
 */
export async function reportCaughtError(
  error: Error,
  context: CrashReportContext,
): Promise<ScrubbedCrashPayload> {
  const appVersion = '1.0.0';
  const runtimeVersion = Updates.runtimeVersion ?? 'unknown';
  const updateId = Updates.updateId ?? null;

  let uidHash: string | null = null;
  if (context.uid) {
    try {
      uidHash = await hashUserId(context.uid);
    } catch {
      uidHash = null;
    }
  }

  const stackSource = error.stack ?? context.componentStack ?? '';
  const payload: ScrubbedCrashPayload = {
    message: scrubPii(error.message || 'Unknown error').slice(0, 240),
    mode: context.mode,
    appVersion,
    runtimeVersion,
    updateId,
    uidHash,
    stackPreview: stackSource ? scrubPii(stackSource).slice(0, 400) : undefined,
  };

  console.warn('[crashReporter] Mode error captured:', JSON.stringify(payload));
  return payload;
}
