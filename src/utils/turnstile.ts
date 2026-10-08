import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify"
const MAX_TOKEN_LENGTH = 2048
const DEFAULT_TIMEOUT_MS = 10000

/**
 * Codes that point at our configuration or at Cloudflare rather than at the
 * visitor. Refusing everyone over a mistyped secret would be worse than the
 * spam it stops, so these let the submission through (the caller logs them).
 */
const UNAVAILABLE_CODES = new Set([
  "missing-input-secret",
  "invalid-input-secret",
  "bad-request",
  "internal-error",
])

export type TurnstileOutcome =
  /** No secret configured: the feature is off. */
  | { status: "skipped" }
  | { status: "passed" }
  /** The visitor's token is missing, invalid, expired or already used. */
  | { status: "rejected"; codes: string[] }
  /** Cloudflare could not be reached or understood, or our secret is wrong. */
  | { status: "unavailable"; reason: string }

export type VerifyTurnstileOptions = {
  secret?: string
  /** The visitor's IP address, passed to Cloudflare as a hint. */
  ip?: string | null
  /** How long to wait for Cloudflare before giving up. Default 10 seconds. */
  timeoutMs?: number
  /** For tests. Defaults to the global fetch. */
  fetchImpl?: typeof fetch
}

/**
 * Asks Cloudflare whether a Turnstile token is genuine. A token can be
 * checked only once, so call this exactly once per submission.
 *
 * The HTTP status is not consulted: Cloudflare documents the JSON body, and a
 * failed check can arrive with a non-200 status.
 */
export async function verifyTurnstile(
  token: unknown,
  {
    secret,
    ip,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    fetchImpl = fetch,
  }: VerifyTurnstileOptions
): Promise<TurnstileOutcome> {
  if (!secret) {
    return { status: "skipped" }
  }

  if (
    typeof token !== "string" ||
    token.length === 0 ||
    token.length > MAX_TOKEN_LENGTH
  ) {
    return { status: "rejected", codes: ["missing-input-response"] }
  }

  const body = new URLSearchParams({ secret, response: token })
  if (ip) {
    body.append("remoteip", ip)
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let result: { success?: unknown; "error-codes"?: unknown } | null
  try {
    const response = await fetchImpl(SITEVERIFY_URL, {
      method: "POST",
      body,
      signal: controller.signal,
    })
    result = await response.json()
  } catch (error) {
    return {
      status: "unavailable",
      reason: error instanceof Error ? error.message : String(error),
    }
  } finally {
    clearTimeout(timer)
  }

  if (!result || typeof result.success !== "boolean") {
    return {
      status: "unavailable",
      reason: "unexpected reply from Cloudflare",
    }
  }

  if (result.success) {
    return { status: "passed" }
  }

  const codes = Array.isArray(result["error-codes"])
    ? result["error-codes"].map(String)
    : []
  const problem = codes.find((code) => UNAVAILABLE_CODES.has(code))
  if (problem) {
    return { status: "unavailable", reason: `Cloudflare reported ${problem}` }
  }

  return { status: "rejected", codes }
}

/**
 * Medusa middleware: turns away a request whose Turnstile token Cloudflare
 * refuses. The storefront sends the token in the `x-turnstile-token` header.
 * Does nothing when `TURNSTILE_SECRET_KEY` is not set.
 */
export async function requireTurnstile(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): Promise<void> {
  const tokenHeader = req.headers["x-turnstile-token"]
  const ipHeader = req.headers["cf-connecting-ip"]

  const outcome = await verifyTurnstile(
    Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader,
    {
      secret: process.env.TURNSTILE_SECRET_KEY,
      ip: Array.isArray(ipHeader) ? ipHeader[0] : ipHeader,
    }
  )

  if (outcome.status === "rejected") {
    res
      .status(403)
      .json({ type: "not_allowed", message: "Verification failed" })
    return
  }

  if (outcome.status === "unavailable") {
    // A visitor cannot cause this, so let the request through and say so.
    req.scope
      .resolve("logger")
      .warn(`[turnstile] verification unavailable: ${outcome.reason}`)
  }

  next()
}
